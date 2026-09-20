# Plugin skills compose regenerating skills by prose only

Codex 插件无法声明式依赖或 RPC 调用用户已安装的 skill（如 `regenerating-ui-redbox-assets`）。Handoff「自动编排」因此实现为：插件自带 skill 在 `SKILL.md` 中规定步骤、输入路径与顺序，并书面要求 agent 遵循那两个现有 skill 的契约。不把编排做成独立运行时。

**Consequences**: 行为依赖模型遵从书面流程；需在 prompt/skill 里写清门禁（缺 AnnotatedImage / 缺 PageScaffold 则停止）。重装插件后新线程才加载更新后的插件 skills。
