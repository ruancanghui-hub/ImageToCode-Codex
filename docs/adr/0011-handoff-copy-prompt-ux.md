# Handoff UX: write bundle then copy prompt

AnnotatorApp「发给 Codex」= 写入 HandoffBundle（含 source 原图、annotated.png、annotation.json）并复制标准 prompt 到剪贴板，由用户粘贴进 Codex 以触发 HandoffSkill。v1 不依赖自定义协议唤起 Codex。FlutterPagePath 为 AnnotationDocument 可选字段。
