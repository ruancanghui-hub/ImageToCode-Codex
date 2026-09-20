# ImageToCode v1 shared understanding

## Goal
设计图 → AnnotatorApp 标注 → HandoffBundle → Codex HandoffSkill（书面编排）→ AssetPackage，Flutter 时再生成单页；不接线业务逻辑。

## Pieces
| 块 | 职责 |
|---|---|
| `apps/annotator` | ReactBits 亮色画布；Vite/React/TS/Tailwind |
| `plugins/image-to-code` | HandoffSkill only（v1 无 MCP App 画布） |
| 现有 skills | `regenerating-ui-redbox-assets`、`regenerating-ui-assets-to-flutter-page` |

## Tools
- **IconMark** — 红框；必填 SemanticName
- **BackgroundCallout** — 箭头；标签自动（页面/卡片背景）
- **RegionCallout** — 背景指向 + 手工 CalloutCopy

## Artifacts
- **AnnotatorProject** `.itc.json` — 可再编辑
- **HandoffBundle** `output/image-to-code/<page-slug>/` → `source.*` + `annotated.png` + `annotation.json`
- 写盘：File System Access → WorkspaceRoot；否则下载回退
- Handoff 按钮：写盘 + 复制 prompt

## TargetStack
- `flutter`：资源 + 页面（需 PageScaffold；可选 FlutterPagePath）
- `react` / `html`：v1 只到资源 Handoff

## v1 不做
插件内再生、React/HTML 出页、MCP App 画布、业务/API 接线、多图批量、OCR、高级对齐辅助线。

## ADRs
0001–0011 under `docs/adr/`；术语见 `CONTEXT.md`。
