# RegionCallout copy is manual entry, not OCR

RegionCallout 的周围文案以用户侧栏手工录入（CalloutCopy）为准，写入 AnnotationDocument。v1 不做 OCR；也不依赖下游仅从 AnnotatedImage「自己读字」。带非空 CalloutCopy 的背景与文案一起再生为一张图片；下游 manifest 记录 bakedText，Flutter 不重复显示该文案。空文案背景仍保持无字。
