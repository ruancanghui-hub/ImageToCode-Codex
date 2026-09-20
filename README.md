# ImageToCode

设计图标注 → HandoffBundle → Codex 技能编排 → code-ready 资源 / Flutter 单页。

## 结构

| 路径 | 说明 |
|---|---|
| `apps/annotator` | 亮色 AnnotatorApp（Vite + React + TS + Tailwind，ReactBits 风格组件） |
| `plugins/image-to-code` | Codex 插件，含 `image-to-code-handoff` skill |
| `CONTEXT.md` | 领域术语 |
| `docs/SHARED-UNDERSTANDING.md` | v1 共享理解 |
| `docs/adr/` | 架构决策 |

## Annotator

```bash
cd apps/annotator
npm install
npm run dev
```

流程：上传图 → 填 PageSlug / TargetStack → 标注 →（可选）授权工作区 → **发给 Codex**（写盘或下载 + 复制 prompt）。

Handoff 约定路径：`output/image-to-code/<page-slug>/`（`source.*`、`annotated.png`、`annotation.json`）。

## Codex 插件

```bash
# 本机路径安装
codex plugin marketplace add /absolute/path/to/ImageToCode-Codex
codex plugin add image-to-code@image-to-code-codex

# 或从 GitHub 安装
codex plugin marketplace add https://github.com/ruancanghui-hub/ImageToCode-Codex
codex plugin add image-to-code@image-to-code-codex
```

新线程后才会加载更新后的 skills。粘贴 Annotator 复制的 prompt，或手动说明 HandoffBundle 路径以触发 `image-to-code-handoff`。

依赖本机已安装：

- `regenerating-ui-redbox-assets`
- `regenerating-ui-assets-to-flutter-page`（仅 Flutter）
