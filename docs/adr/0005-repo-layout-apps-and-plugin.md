# Repo layout: apps/annotator + plugins/

v1 同时需要独立 AnnotatorApp 与 Codex 插件。仓库采用 `apps/annotator`、`plugins/image-to-code`，并以 `.agents/plugins/marketplace.json` 作为 Codex marketplace 清单。拒绝「插件内塞静态 Web」以免和 MCP Apps 约束缠在一起；拒绝双 git 仓库以免 Handoff 路径与文档漂移。
