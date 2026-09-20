# HandoffBundle path under output/image-to-code/<page-slug>

Handoff 输入固定为工作区相对路径 `output/image-to-code/<page-slug>/annotated.png` 与 `annotation.json`。与既有 brand-ip 的 `output/` 习惯兼容，又用独立命名空间避免和其它流水线互相覆盖。v1 每次会话一个 PageSlug、一张源图。
