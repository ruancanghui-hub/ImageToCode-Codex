# v1 UI is AnnotatorApp; plugin is Handoff-only

用户要 ReactBits 亮色画布，而 Codex 自定义 UI 受 MCP Apps/CSP 约束。v1 主 UI 放在仓库内独立 **AnnotatorApp**；Codex 插件包名 `image-to-code`，v1 只提供 HandoffSkill 与约定路径，不嵌入完整画布。MCP App 画布留到后续迭代。

**Consequences**: 仓库至少两块：`apps/annotator`（或等价）与 `plugin/`；用户工作流是「浏览器标注 → 产物入工作区 → Codex 按 HandoffSkill 执行」。
