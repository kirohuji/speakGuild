# 离线缓存与同步架构

本文记录 SpeakGuild 前端当前的离线缓存系统。重点说明三件事：

1. 哪些业务层正在使用缓存系统。
2. 当前缓存系统的模块边界。
3. outbox 和 sync 机制如何工作。

## 当前结论

前端离线系统已经收敛为一套统一入口：

```txt
业务页面 / store
  -> '@/lib/offline' 导出的 repository / service
  -> unified-storage
  -> SQLite
```

业务层不应该直接导入 `localDb`、`syncOutbox` 或具体 SQLite adapter。长期数据读写应通过 `learningRepository`、`learningContentRepository`、`practiceRepository`、`learningPackService`、`offlineStorageService` 等模块完成。

当前本地结构化数据统一使用 SQLite：

| 平台 | 存储 |
|---|---|
| iOS / Android | `@capacitor-community/sqlite` |
| Web | `@capacitor-community/sqlite` + `jeep-sqlite` |

资源文件的边界是：

| 平台 | 资源缓存 |
|---|---|
| iOS / Android | 用 Capacitor Filesystem 缓存图片、音频、录音等二进制资源 |
| Web | 不缓存二进制资源，直接返回原始 URL |

所以 Web 端也可以用 SQLite 保存结构化缓存，但不要在 Web 上缓存资源文件。

## 业务层使用点

当前业务层使用缓存系统的位置如下。

| 文件 | 使用内容 |
|---|---|
| `apps/frontend/src/stores/learning.store.ts` | 我的学习单元、单元详情、报名和退出单元 |
| `apps/frontend/src/features/learning/pages/learning-unit-page.tsx` | 收藏词汇、chunk、pattern，读取已收藏文本 |
| `apps/frontend/src/features/practice/pages/practice-session-page.tsx` | 练习中的表达收藏、练习 session / turn / progress |
| `apps/frontend/src/features/practice/components/learning-insight-dialog.tsx` | 字典查询缓存、表达收藏 |
| `apps/frontend/src/features/expression/pages/expression-library-page.tsx` | 表达库列表、掌握状态更新、删除表达 |
| `apps/frontend/src/features/profile/pages/profile-page.tsx` | 离线存储统计、缓存清理、词库展示和删除 |
| `apps/frontend/src/features/vn-engine/vn-player.tsx` | 通过 `assetCacheService.resolve()` 解析资源 URL |
| `apps/frontend/src/providers/auth-provider.tsx` | 登录后触发 `offlineSyncService.sync(userId)` |
| `apps/frontend/src/lib/practice-ai-api.ts` | 字典查询结果缓存 |

这些业务代码应该只依赖 `@/lib/offline` 的公开导出，不应该关心底层是 Native SQLite、Web SQLite 还是 Filesystem。

## 公开模块

`apps/frontend/src/lib/offline/index.ts` 是业务层入口。

| 导出 | 职责 |
|---|---|
| `learningRepository` | 我的学习单元、单元详情、报名和退出 |
| `learningContentRepository` | 字典缓存、表达库、本地学习内容查询 |
| `practiceRepository` | 练习 topic、session、turn、progress |
| `learningPackService` | 学习包安装、卸载、资源预下载 |
| `assetCacheService` | Native 资源下载、删除、URL resolve |
| `offlineSyncService` | outbox push、用户数据 pull、内容更新检查 |
| `offlineStorageService` | 离线数据统计和清理 |
| `syncApi` | 远端同步接口封装 |

`localDb` 是内部存储 facade，不从 `index.ts` 导出。这样可以避免业务页面直接绕过 repository 写表。

## 底层存储

### unified-storage

`apps/frontend/src/lib/offline/unified-storage.ts` 负责选择底层 adapter：

```txt
Capacitor.isNativePlatform()
  true  -> sqlite/sqlite-storage.ts
  false -> sqlite/web-sqlite-storage.ts
```

两个 adapter 对外都实现同一套 `ILocalDb` 接口：

```txt
get
put
putMany
delete
list
count
clear
deleteWhere
saveBlob
getBlob
deleteBlob
close
isAvailable
```

结构化数据通过 SQLite 保存 JSON。Native blob 不进 SQLite，实际文件写入 Capacitor Filesystem，SQLite 只保存录音元信息。

### SQLite JSON Store

`apps/frontend/src/lib/offline/sqlite/sqlite-json-store.ts` 是 web/native 共享的 JSON CRUD 层。它把每个 store 映射成 SQLite 表：

```txt
id TEXT PRIMARY KEY
data TEXT NOT NULL
updated_at TEXT NOT NULL
```

业务对象仍然是 TypeScript object，进入 SQLite 前序列化成 JSON。

### 表结构

当前 SQLite 表定义在 `apps/frontend/src/lib/offline/sqlite/schema.ts`。

| 表 | 作用 |
|---|---|
| `kv` | cursor、版本号、临时映射等键值数据 |
| `my_learning_units` | 我的学习单元 |
| `downloaded_packs` | 已安装学习包记录 |
| `downloaded_unit_details` | 已下载单元详情、topic 详情 |
| `ink_scripts` | VN / 练习脚本 |
| `dictionary_entries` | 用户查过的字典结果 |
| `expression_entries` | 统一表达库，包含 word / chunk / pattern |
| `user_progress` | 用户学习进度 |
| `practice_records` | 练习 session / turn 本地记录 |
| `local_assets` | 本地资源元信息 |
| `outbox` | 等待上传的本地变更 |
| `recordings` | Native 录音文件元信息 |

注意：`word_entry`、`chunk_entry`、`pattern_entry` 不是三张表。它们只是 outbox 里的同步事件类型。真正的本地表达库只有一张 `expression_entries`。

## 表达库设计

表达库由 `learningContentRepository` 管理。

本地统一表：

```txt
expression_entries
```

本地统一类型：

```txt
ExpressionEntry.kind = 'word' | 'chunk' | 'pattern'
```

业务层收藏表达时调用：

```txt
saveExpressionEntryAndSync()
deleteExpressionByTextAndSync()
updateExpressionStatusAndSync()
listExpressionEntries()
listExpressionTexts()
getExpressionByText()
```

repository 内部会把三类表达统一保存到 `expression_entries`，同时按 kind 映射出 outbox entityType：

| kind | outbox entityType |
|---|---|
| `word` | `word_entry` |
| `chunk` | `chunk_entry` |
| `pattern` | `pattern_entry` |

这样做的原因是：本地存储已经统一，但同步协议和后端兼容仍然按三类表达事件处理。

## 资源缓存边界

资源缓存由 `assetCacheService` 管理。

Native 流程：

```txt
AssetRef
  -> 下载 remoteUrl
  -> 写入 Capacitor Filesystem
  -> SQLite local_assets 记录状态
  -> resolve() 返回本地可播放 / 可渲染 URI
```

Web 流程：

```txt
AssetRef
  -> 不下载
  -> 不写 blob
  -> resolve() 返回原 remoteUrl
```

这个边界很重要：Web 端不做资源离线缓存，避免为了浏览器资源缓存引入额外复杂度。

用户录音也是 Native 文件优先：

```txt
录音 blob
  -> Native Filesystem
  -> recordings 表保存元信息
  -> recording outbox 等待上传
  -> 上传成功后删除本地 blob 或标记已同步
```

Web adapter 的二进制接口不提供真实缓存能力。

## Outbox 机制

`apps/frontend/src/lib/offline/sync-outbox.ts` 管理本地待同步队列。

当前支持的实体类型：

```txt
my_unit
word_entry
chunk_entry
pattern_entry
practice_session
practice_turn
learning_pack
recording
```

每条 outbox 数据包含：

```txt
id
entityType
entityId
operation
payload
clientMutationId
createdAt
updatedAt
retryCount
status
lastError
```

操作流程：

```txt
用户操作
  -> 先写本地业务表
  -> 写 outbox pending
  -> 立即尝试调用远端 API
  -> 成功：删除 outbox
  -> 失败：标记 failed，等待下次 sync 重试
```

`markSynced()` 现在会直接删除 outbox 记录，避免 outbox 无限膨胀。`cleanup()` 只负责清理旧版本遗留的 synced 记录和长时间失败记录。

## Sync 流程

`apps/frontend/src/lib/offline/offline-sync.service.ts` 是同步入口。

登录后 `auth-provider.tsx` 会调用：

```txt
offlineSyncService.sync(userId)
```

完整流程：

```txt
sync()
  -> flush()
  -> pull(userId)
  -> checkContentUpdates()
```

### flush

`flush()` 负责把本地 outbox 上传到服务端。

可批量推送的类型：

```txt
my_unit
word_entry
chunk_entry
pattern_entry
practice_session
practice_turn
```

这些类型会走：

```txt
syncApi.push([...])
```

每批最多 100 条。服务端返回每条结果后：

| 结果 | 本地处理 |
|---|---|
| `synced` | 删除 outbox |
| `skipped` | 计入 skipped |
| 失败 | `markFailed()`，下次重试 |

如果批量 push 整体失败，会回退到逐条 replay。

复杂类型单独处理，例如：

```txt
recording
```

因为录音涉及本地文件读取和上传，不能简单塞进批量 JSON push。

### pull

`pull(userId)` 负责从服务端拉取用户数据变更。

cursor 存在 `kv` 表：

```txt
sync:user:<userId>:cursor
```

如果没有 userId，则使用匿名/默认 cursor key。pull 会分页执行，直到服务端返回 `hasMore = false`。

当前会写回本地的数据包括：

```txt
ExpressionItem
UserSceneProgress
UserChunkProgress
PracticeSession
PracticeTurn
```

删除数据也会被应用到本地，例如删除远端表达库项后，本地 `expression_entries` 会按 `remoteId` 删除。

### checkContentUpdates

`checkContentUpdates()` 用于检查公共内容 manifest 是否变化。

它不会自动重写所有学习包，只会判断哪些已安装学习包可能过期，并提示用户重新下载。

当前版本记录在：

```txt
kv['sync:content:since']
```

## 数据读写原则

业务层应该遵守下面几条：

1. 页面和 store 只调用 `@/lib/offline` 的 repository / service。
2. 不从业务层直接导入 `localDb`。
3. 不从业务层直接导入 `syncOutbox`。
4. 表达库统一走 `learningContentRepository`。
5. 我的学习单元统一走 `learningRepository`。
6. 练习记录统一走 `practiceRepository`。
7. 学习包安装、卸载和资源预下载统一走 `learningPackService`。
8. 资源 URL 解析统一走 `assetCacheService.resolve()`。
9. Web 端不做二进制资源缓存。
10. Native 端资源文件写 Filesystem，SQLite 只保存元信息。

## 当前不是要做的事

下面这些现在不是当前架构目标：

1. 恢复 IndexedDB fallback。
2. Web 端缓存图片、音频、录音 blob。
3. 业务页面直接操作 SQLite 表。
4. 把 `word_entry`、`chunk_entry`、`pattern_entry` 做成本地三张表。
5. 为了 adapter 复用再引入很大的抽象层。

当前优先级是保持离线系统简单、明确：

```txt
结构化缓存：SQLite
Native 资源：Filesystem
Web 资源：不缓存
用户变更：outbox
同步入口：offlineSyncService
业务入口：repository / service
```

## 一句话总结

当前离线架构是 local-first 的 repository 模式：业务先写本地 SQLite，再通过 outbox 同步到服务端；Native 资源走 Filesystem，Web 不缓存二进制资源；表达库本地统一为 `expression_entries`，但同步事件仍保留 `word_entry`、`chunk_entry`、`pattern_entry` 以兼容当前同步协议。
