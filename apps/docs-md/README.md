# 教学文档目录

这里的 Markdown 文件与数据库中的 `TrainingTopic.teachingMarkdown` 对应，目录结构为：

```text
类型/学习包名/话题.md
```

在仓库根目录运行：

```bash
# 把数据库中的全部教学文档重新导出到这里（会覆盖本地文件）
pnpm docs:export

# 只从数据库更新 .learning.md，不改动教学正文 .md
pnpm docs:export-learning

# 预览哪些本地修改会写回数据库
pnpm docs:sync -- --dry-run

# 把本地 Markdown 修改写回数据库
pnpm docs:sync

# 只把本地 .learning.md 的材料和练习写回数据库，不更新教学正文 .md
pnpm docs:sync-learning

# 先预览仅学习配置的写回结果
pnpm docs:sync-learning -- --dry-run

# 忽略数据库侧的新改动，强制以本地 Markdown 覆盖（建议先加 --dry-run 预览）
pnpm docs:sync -- --force
```

`.teaching-docs.json` 保存文件与数据库话题 ID 的映射，请勿手动修改。同步时，本地被删除的文件会跳过，不会清空数据库；若本地和数据库在导出后都发生了修改，同步会停止并提示冲突。只有明确需要用本地内容覆盖数据库新改动时，才使用 `--force`。

## 话题材料与知识点练习

每个话题导出为同目录的一对文件：`话题.md` 只保存用户端展示的教学正文；`话题.learning.md` 只保存材料和知识点练习配置。`docs:sync` 分别同步两者；`docs:sync-learning` 只同步后者，不读取或更新教学正文。旧清单中的文档仍只同步教学正文；运行一次 `docs:export` 即可升级为双文件结构。

`酒店入住.learning.md`：

```md
---
learning:
  vocabulary:
    - reservation
    - confirm
  chunks:
    - I have a reservation under [name].
    - Could I check in early?
  patterns:
    - Could I + verb ...?
  exercises:
    enabled: true
    pipeline:
      - key: early-check-in
        type: chunk_substitution
        kind: chunk
        title: 提前入住
        chunk: Could I check in early?
        chunkMeaning: 我可以提前入住吗？
        direction: zh_to_en
        items:
          - zh: 我可以提前入住吗？
            answer: Could I check in early?
          - zh: 我可以晚点退房吗？
            answer: Could I check out late?
---
```

`酒店入住.md` 保持为普通教学 Markdown：

```md
# 酒店入住

这里是教学正文。
```

材料只需要写对应的英文值。同步时会优先复用已有的单词、句块或句型；不存在时创建最小记录（释义标记为“待补充”）后再关联到当前话题。声明空数组会清空该话题对应类型的关联，但不会删除全局材料。

`pipeline` 直接使用现有知识点练习格式，支持 `chunk_substitution`、`vocab_drill`、`vn_dialogue`、`vocab_sentence_building`、`sentence_decomposition` 与 `pattern_drill`。每个练习组必须有唯一的 `key`（字母、数字、`_`、`-`）；同步器会据此生成稳定题组 ID，避免普通文案调整丢失学习进度。
