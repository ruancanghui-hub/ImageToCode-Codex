# RegionCallout copy is manual entry, not OCR

RegionCallout 的周围文案以用户侧栏手工录入（CalloutCopy）为准，写入 AnnotationDocument。v1 不做 OCR；也不依赖下游仅从 AnnotatedImage「自己读字」。背景仍按 BackgroundCallout 规则再生，文案默认代码渲染。
