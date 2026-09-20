# Annotation contract: AnnotatedImage + AnnotationDocument

下游 `regenerating-ui-redbox-assets` 以视觉读取红框/箭头为主。我们决定每次保存/Handoff 同时产出 **AnnotatedImage（兼容现有技能）** 与 **AnnotationDocument（JSON sidecar）**，以便语义命名与后续技能演进，而不在 v1 强制改写现有技能。

**Considered Options**: 仅视觉图；仅 JSON（需改技能）；双产物（采用）。
