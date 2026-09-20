# Hybrid Codex host: skills first, MCP App canvas later

Codex 不能直接挂普通 React SPA；自定义 UI 须走 MCP Apps（沙箱 iframe + CSP）。我们决定 v1 以 **skills-only 插件 + Handoff** 打通 AnnotatedImage → AssetPackage → Flutter 页；ReactBits 亮色标注画布作为 MCP App 并行或紧随其后的 v1.5，避免把闭环阻塞在 iframe 打包约束上。

**Considered Options**: 完整 MCP Apps 画布先行；纯 skills、永不做画布；混合（采用）。

**Consequences**: v1 需有画布外的标注来源（临时简易编辑器、外部工具、或手工红框）；插件清单先暴露 skills/prompts，再加 MCP UI。
