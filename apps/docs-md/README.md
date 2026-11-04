# 教学文档目录

这里的 Markdown 文件与数据库中的 `TrainingTopic.teachingMarkdown` 对应，目录结构为：

```text
类型/学习包名/话题.md
```

在仓库根目录运行：

```bash
# 把数据库中的全部教学文档重新导出到这里（会覆盖本地文件）
pnpm docs:export

# 预览哪些本地修改会写回数据库
pnpm docs:sync -- --dry-run

# 把本地 Markdown 修改写回数据库
pnpm docs:sync

# 忽略数据库侧的新改动，强制以本地 Markdown 覆盖（建议先加 --dry-run 预览）
pnpm docs:sync -- --force
```

`.teaching-docs.json` 保存文件与数据库话题 ID 的映射，请勿手动修改。同步时，本地被删除的文件会跳过，不会清空数据库；若本地和数据库在导出后都发生了修改，同步会停止并提示冲突。只有明确需要用本地内容覆盖数据库新改动时，才使用 `--force`。
