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

流程：从目标 Codex 任务打开 Annotator → 上传图 → 填 PageSlug / TargetStack → 标注 → **发送 Codex**。插件保存标注图、原图和完整标注数据，再通过 `codex queue` 把 HandoffBundle 路径和技能指令发送到打开页面的任务。Flutter 目标继续调用 `regenerating-ui-assets-to-flutter-page` 完成资源生成和单页实现。

Region 的非空文案会与箭头指向的背景一起生成到图片中；普通背景仍为无字背景。Flutter 不重复叠加图片里已有的文字。

每次发送保存独立快照：`output/image-to-code/<page-slug>/<request-id>/`（`source.*`、`annotated.png`、`annotation.json`、项目 JSON 和 `handoff.txt`），避免下一次编辑覆盖排队中的图片。单独运行 Vite 时仍使用下载/复制提示词回退。

## Codex 插件

安装后的插件自带可运行的 Annotator 静态页面。对 Codex 说“在右侧打开 ImageToCode Annotator”即可启动本地页面并在右侧 Web 面板显示；不需要另外克隆或启动 `apps/annotator`。

```bash
# 本机路径安装
codex plugin marketplace add /absolute/path/to/ImageToCode-Codex
codex plugin add image-to-code@image-to-code-codex

# 或从 GitHub 安装
codex plugin marketplace add https://github.com/ruancanghui-hub/ImageToCode-Codex
codex plugin add image-to-code@image-to-code-codex
```

从 GitHub 安装后，在新建 Codex 任务中使用：

```text
打开 ImageToCode Annotator 到右侧
```

新任务才会加载更新后的 skills。启动脚本从当前任务继承 `CODEX_THREAD_ID` 和工作区；也可显式传参：`open-annotator.sh 4173 /absolute/workspace <task-id>`。请从目标项目的 Codex 任务启动，发送时会使用该任务的现有上下文。需要 Python 3 和支持 `codex queue --message` 的 Codex CLI。

验证：`python3 -m unittest discover -s plugins/image-to-code/tests -v`；前端在 `apps/annotator` 执行 `npm run build`。

依赖本机已安装：

- `regenerating-ui-redbox-assets`
- `regenerating-ui-assets-to-flutter-page`（仅 Flutter）
