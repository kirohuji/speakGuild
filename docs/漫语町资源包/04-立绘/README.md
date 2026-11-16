# 04-立绘

一位角色一个文件夹，文件夹名 = 角色键。角色键与 `GameCharacter.name` 一致，不要翻译。

**角色 ↔ 图片的实查对应关系见 [`角色-头像对应表.md`](./角色-头像对应表.md)。**

```text
04-立绘/
├─ _模板/            画布参考线与导出预设
├─ fox-lilia/        ← 键是 fox，文件夹带中文便于人看
├─ ash/
├─ maya/
├─ sari/
├─ yoyo/
├─ iris/
├─ vivi/
├─ nora/
├─ eira/
├─ sian/
├─ riggs/
├─ lux/
├─ wooly/
├─ noel/
├─ basil/
├─ tank/
├─ rico/
└─ polar/
```

**文件夹名可以带中文，文件名不行。** 文件一律 `chr_<角色键>_<表情>.png`。

## 当前实际内容

18 个文件夹里各有一张 `chr_<角色键>_default.png`，全部 **512 × 768 PNG（RGBA，透明底）**，构图是半身、正面、从腰部裁切。

这批图在数据库里**同时充当头像和立绘**（`avatarUrl` 与 `spriteBaseUrl` 指向同一个 `asset://`），所以暂时不需要单独的 `avatar_<key>.png`。

## 还需要补什么

```text
chr_fox_default.png        ✅ 已有（512×768）
chr_fox_happy.png          ⬜ 待补
chr_fox_thinking.png       ⬜ 待补
chr_fox_surprised.png      ⬜ 待补
chr_fox_sad.png            ⬜ 待补
chr_fox_happy_festival.png ⬜ 可选（庆典配饰差分）
avatar_fox.png             ⬜ 可选（从 default 裁 512×512 头部特写）
```

优先级：先补齐 **T0 五人**（fox、iris、maya、ash、lux）的 `default / happy / thinking`，纵切片才有得播；其余角色保持 `default` 一张也能跑通。

## 差分规矩

1. **同画布、同构图、同尺寸**：512×768 出图，表情差分只改头，不改姿势、不缩放。
2. 头顶与肩线基线一致，否则两个角色同框时会出现「一个在飘、一个在蹲」。
3. 导出保留 1px 透明边距，防黑边。
4. 这批图来自同一套 prompt 模板，风格已经统一；**新增差分必须沿用同一模板**，不要换模型或换分辨率。

## 落库

```json
{
  "avatarUrl": "asset://<fileAssetId>",
  "spriteBaseUrl": "asset://<fileAssetId>",
  "expressions": {
    "default": { "avatarUrl": "asset://<id>", "spriteUrl": "asset://<id>" },
    "happy": { "avatarUrl": "asset://<id2>", "spriteUrl": "asset://<id2>" }
  }
}
```

- 存 `asset://` 或稳定别名，**绝不存带 `q-signature` 的 COS 链接**——签名会过期，过期后整批立绘一起失效。
- 目前 `spriteBaseUrl` 只有 `fox` 填了，其余 17 个为空；探索模式的 VN 渲染依赖它落位，建议批量补上。

谁需要哪些表情，见 `01-剧本/角色立绘与表情表.md`。
