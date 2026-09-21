import type { Annotation, AnnotationDocument, AnnotatorProject, TargetStack } from '../types'
import { backgroundLabel } from './labels'

export function buildAnnotationDocument(input: {
  pageSlug: string
  targetStack: TargetStack
  flutterPagePath?: string
  sourceFileName: string
  imageWidth: number
  imageHeight: number
  annotations: Annotation[]
}): AnnotationDocument {
  return {
    version: 1,
    pageSlug: input.pageSlug,
    targetStack: input.targetStack,
    flutterPagePath: input.flutterPagePath || undefined,
    sourceFileName: input.sourceFileName,
    imageWidth: input.imageWidth,
    imageHeight: input.imageHeight,
    annotations: input.annotations,
    exportedAt: new Date().toISOString(),
  }
}

export function buildAnnotatorProject(
  doc: Omit<AnnotationDocument, 'exportedAt'>,
  sourceMimeType: string,
): AnnotatorProject {
  return {
    version: 1,
    pageSlug: doc.pageSlug,
    targetStack: doc.targetStack,
    flutterPagePath: doc.flutterPagePath,
    sourceFileName: doc.sourceFileName,
    sourceMimeType,
    imageWidth: doc.imageWidth,
    imageHeight: doc.imageHeight,
    annotations: doc.annotations,
  }
}

export function buildHandoffPrompt(pageSlug: string, targetStack: TargetStack): string {
  const bundle = `output/image-to-code/${pageSlug}`
  const flutterStep =
    targetStack === 'flutter'
      ? `\n3. Before cutting assets, follow original-image-design-json-to-flutter-page: analyze source.* into design-system-profile.json containing style/layout only (no screenshot content), then use it with the AssetPackage to implement the existing Flutter page. Do not create a new Flutter app or wire new business/API logic.`
      : `\n3. TargetStack is ${targetStack}: produce the AssetPackage only. Do not generate a page in v1.`

  return `Use the image-to-code HandoffSkill and $original-image-design-json-to-flutter-page for Flutter targets.

HandoffBundle path (workspace-relative):
- ${bundle}/annotated.png
- ${bundle}/annotation.json
- ${bundle}/source.* (original design)

Steps:
1. Confirm the HandoffBundle files exist.
2. For Flutter, first create design-system-profile.json from source.* using the exact prompt in original-image-design-json-to-flutter-page. It must exclude all screenshot content/data and retain only reusable visual/layout roles. Validate it before cutting assets. Then follow regenerating-ui-redbox-assets on annotated.png. Treat red rectangles as IconMarks. Treat arrows labeled 背景/background as BackgroundCallouts. Use SemanticName values from annotation.json when present. For RegionCallout with non-empty calloutCopy, regenerate the indicated background and ALL exact copy together in one image. Use full annotation.json copy, preserve source typography, remove annotation marks, and record textRendering=baked plus bakedText in manifest.json. Do not duplicate the baked copy with Flutter Text; provide semantics. Backgrounds without copy remain clean backgrounds.${flutterStep}
4. Stop if PageScaffold is missing for Flutter page generation; ask for the destination route/path.`
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string,
) {
  const head = 14
  const angle = Math.atan2(toY - fromY, toX - fromX)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(fromX, fromY)
  ctx.lineTo(toX, toY)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(toX, toY)
  ctx.lineTo(toX - head * Math.cos(angle - Math.PI / 6), toY - head * Math.sin(angle - Math.PI / 6))
  ctx.lineTo(toX - head * Math.cos(angle + Math.PI / 6), toY - head * Math.sin(angle + Math.PI / 6))
  ctx.closePath()
  ctx.fill()
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
) {
  ctx.font = 'bold 16px IBM Plex Sans, sans-serif'
  const paddingX = 8
  const metrics = ctx.measureText(text)
  const w = metrics.width + paddingX * 2
  const h = 24
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(x, y - h, w, h, 6)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = color
  ctx.fillText(text, x + paddingX, y - 7)
}

export async function renderAnnotatedPng(
  image: HTMLImageElement,
  annotations: Annotation[],
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unsupported')

  ctx.drawImage(image, 0, 0)
  const mark = '#e11d48'

  for (const a of annotations) {
    if (a.type === 'iconMark') {
      ctx.strokeStyle = mark
      ctx.lineWidth = 3
      ctx.strokeRect(a.x, a.y, a.width, a.height)
      drawLabel(ctx, a.semanticName, a.x, a.y - 4, mark)
    } else {
      drawArrow(ctx, a.from.x, a.from.y, a.to.x, a.to.y, mark)
      const label = a.label || backgroundLabel(a.backgroundKind)
      drawLabel(ctx, label, a.from.x + 8, a.from.y - 8, mark)
      if (a.type === 'regionCallout' && a.calloutCopy.length > 0) {
        const joined = a.calloutCopy.join(' · ')
        drawLabel(ctx, joined.slice(0, 40), a.to.x + 10, a.to.y + 28, mark)
      }
    }
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Failed to export PNG')
  return blob
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function writeHandoffBundle(options: {
  root: FileSystemDirectoryHandle
  pageSlug: string
  sourceFile: File
  annotatedPng: Blob
  annotationJson: AnnotationDocument
  project: AnnotatorProject
}): Promise<string> {
  const output = await getOrCreateDir(options.root, 'output')
  const itc = await getOrCreateDir(output, 'image-to-code')
  const page = await getOrCreateDir(itc, options.pageSlug)

  const sourceExt = extensionFor(options.sourceFile.name, options.sourceFile.type)
  await writeFile(page, `source${sourceExt}`, options.sourceFile)
  await writeFile(page, 'annotated.png', options.annotatedPng)
  await writeFile(page, 'annotation.json', new Blob([JSON.stringify(options.annotationJson, null, 2)], { type: 'application/json' }))
  await writeFile(page, `${options.pageSlug}.itc.json`, new Blob([JSON.stringify(options.project, null, 2)], { type: 'application/json' }))

  return `output/image-to-code/${options.pageSlug}`
}

async function getOrCreateDir(parent: FileSystemDirectoryHandle, name: string) {
  return parent.getDirectoryHandle(name, { create: true })
}

async function writeFile(dir: FileSystemDirectoryHandle, name: string, data: Blob) {
  const handle = await dir.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  await writable.write(data)
  await writable.close()
}

function extensionFor(name: string, mime: string): string {
  const fromName = name.includes('.') ? `.${name.split('.').pop()}` : ''
  if (fromName && fromName.length <= 5) return fromName
  if (mime === 'image/jpeg') return '.jpg'
  if (mime === 'image/webp') return '.webp'
  return '.png'
}

export function supportsDirectoryPicker(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}


async function blobBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(reader.error ?? new Error('图片读取失败'))
    reader.readAsDataURL(blob)
  })
}

/** A 404 means a standalone static/dev host; bridge errors must not pretend delivery succeeded. */
export async function sendHandoffToCodex(options: {
  sourceFile: File
  annotatedPng: Blob
  annotationJson: AnnotationDocument
  project: AnnotatorProject
}): Promise<{ bundlePath: string } | null> {
  const context = await fetch('/api/context')
  if (context.status === 404 || !context.headers.get('content-type')?.includes('application/json')) return null
  if (!context.ok) throw new Error('无法连接 Codex，请重新从目标任务打开 Annotator')
  const connection = await context.json()
  if (!connection.available) throw new Error('当前页面未连接 Codex 任务，请在目标任务中重新打开 Annotator')
  const response = await fetch('/api/handoff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId: crypto.randomUUID(),
      annotationJson: options.annotationJson,
      project: options.project,
      source: { type: options.sourceFile.type, base64: await blobBase64(options.sourceFile) },
      annotatedPng: await blobBase64(options.annotatedPng),
    }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? '发送 Codex 失败')
  return result
}
