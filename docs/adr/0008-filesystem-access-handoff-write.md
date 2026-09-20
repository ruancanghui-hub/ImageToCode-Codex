# Annotator writes via File System Access API, download fallback

浏览器不能默认写入任意路径。AnnotatorApp 以 File System Access API 让用户授权 WorkspaceRoot，再写入 `output/image-to-code/<page-slug>/`。不支持的环境回退为下载 AnnotatedImage + AnnotationDocument（或 zip），由用户放入约定路径。不在 v1 引入本地写盘后端。
