# ImageToCode

将设计截图标注为下游技能可消费的输入，并把手递交给 Codex，以生成 code-ready 资源与（可选）Flutter 页面。

## Language

**ImageToCode**:
面向 Codex 的标注与手递交工作流；v1 负责产出标注产物并触发技能，不在插件内执行图像再生。
_Avoid_: 切图工具, 页面生成器, 业务代码生成器

**IconMark**:
红色矩形选区，标出需独立再生为透明 PNG 的图标或控件。
_Avoid_: 裁切框, crop, 红框（口语可保留，文档用 IconMark）

**BackgroundCallout**:
箭头加「背景」类标签，指向页面场景或卡片底，要求生成独立背景资产。
_Avoid_: 背景箭头, 背景切图

**RegionCallout**:
指向背景区域的 callout，并携带周围文案上下文供页面生成使用；文字默认由代码渲染，不烤进背景图。
_Avoid_: 箭头+文字工具, 组合标注, OCR 框（录入方式另定）

**AnnotatedImage**:
合成后的视觉标注图（含红框、箭头、标签），供现有 regenerating 技能视觉读取。
_Avoid_: 导出图, 标注截图（可作同义说明，术语用 AnnotatedImage）

**AnnotationDocument**:
与 AnnotatedImage 配对的 JSON sidecar，记录标注类型、几何、语义名与目标栈。
_Avoid_: 配置文件, meta.json

**AssetPackage**:
`regenerating-ui-redbox-assets` 产出的分组资源目录与 `manifest.json`（可再打成 zip）。
_Avoid_: 切图包, 素材包

**Handoff**:
把 AnnotatedImage（及 AnnotationDocument）交给 Codex，按目标栈调用约定技能的动作。
_Avoid_: 发送, 上传给 AI

**TargetStack**:
页面生成目标技术栈。v1 仅 `flutter` 会触发页面技能；`react` / `html` 只影响标注与资源手递交。
_Avoid_: 语言界面, 框架选择

**PageScaffold**:
目标工程中已存在、可写入单页实现的 Flutter 路由/页面落点；ImageToCode 不新建第二套应用。
_Avoid_: 新工程, 完整 App

**AnnotatorApp**:
本仓库内的独立亮色 Web 应用（ReactBits），是 v1 的主标注 UI；导出 AnnotatedImage 与 AnnotationDocument。
_Avoid_: Codex 内画布, MCP App（那是后续宿主形态）

**SemanticName**:
放置 IconMark（及需要落盘的资产）时必填的小写 snake_case 角色名，写入 AnnotationDocument 并 ideally 反映在标注标签上。
_Avoid_: 自动文件名, id, 临时编号

**HandoffSkill**:
插件 `image-to-code` 内用书面步骤编排 regenerating 技能的 skill；无 RPC 调用其它 skill 的能力。
_Avoid_: 工作流引擎, pipeline runner

**AnnotatorProject**:
可再编辑的会话文件（扩展名 `.itc.json`），含源图引用、page-slug、TargetStack 与全部标注；与导出的 AnnotatedImage 分离。
_Avoid_: 工程文件, workspace

**PageSlug**:
单次会话对应的一页短名；决定 `output/image-to-code/<page-slug>/` 目录名。
_Avoid_: 页面标题, route name（可相关但术语用 PageSlug）

**HandoffBundle**:
一次 Handoff 的约定产物目录：`output/image-to-code/<page-slug>/annotated.png` 与 `annotation.json`（及可选源图副本）。
_Avoid_: 输出包, export folder

**WorkspaceRoot**:
用户通过 File System Access API 授权给 AnnotatorApp 的目录；App 在其下写入 HandoffBundle。不支持时回退为下载文件由用户手动放置。
_Avoid_: 自动挂载磁盘, 本地后端

**CalloutCopy**:
RegionCallout 附带的、由用户手工录入的文案上下文；供页面生成时用代码 Text 渲染，不进入背景资产。
_Avoid_: OCR 结果, 图中文字自动识别

**FlutterPagePath**:
AnnotationDocument 中的可选字段，指向目标工程内已有或将写入的页面路径；缺省时由 HandoffSkill 在对话中询问或推断。
_Avoid_: 强制生成路径, generated 固定目录
