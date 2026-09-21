import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CanvasStage } from './components/CanvasStage'
import { GradientText } from './components/GradientText'
import { SpotlightCard } from './components/SpotlightCard'
import {
  buildAnnotationDocument,
  buildAnnotatorProject,
  buildHandoffPrompt,
  downloadBlob,
  renderAnnotatedPng,
  sendHandoffToCodex,
  supportsDirectoryPicker,
  writeHandoffBundle,
} from './lib/export'
import { useAnnotationHistory } from './lib/history'
import { isValidPageSlug, isValidSemanticName, suggestPageSlug } from './lib/labels'
import type {
  Annotation,
  BackgroundKind,
  RegionCallout,
  TargetStack,
  ToolId,
} from './types'

const tools: { id: ToolId; label: string; hint: string }[] = [
  { id: 'select', label: '选择', hint: '移动 / 缩放标注' },
  { id: 'iconMark', label: 'IconMark', hint: '拖拽红框，自动命名' },
  { id: 'backgroundCallout', label: 'Background', hint: '两点画箭头，标签自动' },
  { id: 'regionCallout', label: 'Region', hint: '箭头 + 侧栏 CalloutCopy' },
]

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageUrlRef = useRef<string | null>(null)
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null)
  const [pageSlug, setPageSlug] = useState('')
  const [targetStack, setTargetStack] = useState<TargetStack>('flutter')
  const [flutterPagePath, setFlutterPagePath] = useState('')
  const [metaReady, setMetaReady] = useState(false)
  const [tool, setTool] = useState<ToolId>('iconMark')
  const [backgroundKind, setBackgroundKind] = useState<BackgroundKind>('page')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [fitToken, setFitToken] = useState(0)
  const [sidePanel, setSidePanel] = useState<'tools' | 'props' | null>(null)
  const [calloutDraft, setCalloutDraft] = useState('')

  const togglePanel = (panel: 'tools' | 'props') => {
    setSidePanel((prev) => {
      const next = prev === panel ? null : panel
      if (next === null) setFitToken((n) => n + 1)
      return next
    })
  }
  const [workspace, setWorkspace] = useState<FileSystemDirectoryHandle | null>(null)
  const [status, setStatus] = useState<string>('上传设计图开始标注')
  const [busy, setBusy] = useState(false)
  const [dragDepth, setDragDepth] = useState(0)
  const [metaError, setMetaError] = useState<string | null>(null)
  const draggingFile = dragDepth > 0

  const { annotations, commit, mutate, checkpoint, replaceAnnotations, undo, redo, canUndo, canRedo } =
    useAnnotationHistory()

  const loadImageFile = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.src = url
    await img.decode()
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current)
    imageUrlRef.current = url
    setSourceFile(file)
    setImageUrl(url)
    setImageEl(img)
    setMetaReady(false)
    setMetaError(null)
    replaceAnnotations([])
    setSelectedId(null)
    setPageSlug((prev) => prev || suggestPageSlug(file.name))
    setStatus(`已载入 ${file.name}，确认 PageSlug 后点击「开始标注」`)
  }, [replaceAnnotations])

  const onPickFile = useCallback(
    async (file: File | null) => {
      if (!file) return
      if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) {
        setStatus('请选择图片文件（PNG / JPG / WebP）')
        return
      }
      await loadImageFile(file)
    },
    [loadImageFile],
  )

  const takeImageFromDataTransfer = (dt: DataTransfer | null): File | null => {
    if (!dt) return null
    const files = Array.from(dt.files ?? [])
    const fromFiles = files.find(
      (f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name),
    )
    if (fromFiles) return fromFiles
    const item = Array.from(dt.items ?? []).find((i) => i.kind === 'file' && i.type.startsWith('image/'))
    return item?.getAsFile() ?? null
  }

  useEffect(() => {
    return () => {
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  // 阻止浏览器默认打开拖入的图片，并支持整页拖放上传
  useEffect(() => {
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files')

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragDepth((d) => d + 1)
    }
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragDepth((d) => Math.max(0, d - 1))
    }
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragDepth(0)
      const file = takeImageFromDataTransfer(e.dataTransfer)
      if (!file) {
        setStatus('未识别到图片文件')
        return
      }
      void onPickFile(file)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [onPickFile])

  const selected = useMemo(
    () => annotations.find((a) => a.id === selectedId) ?? null,
    [annotations, selectedId],
  )

  const confirmMeta = () => {
    const slug = pageSlug.trim().toLowerCase()
    if (!slug) {
      setMetaError('请填写 PageSlug，例如 home-sleep')
      setStatus('请填写 PageSlug')
      return
    }
    if (!isValidPageSlug(slug)) {
      setMetaError('格式：小写字母开头，仅含 a-z、0-9、连字符，如 home-sleep')
      setStatus('PageSlug 格式无效')
      return
    }
    setPageSlug(slug)
    setMetaError(null)
    setMetaReady(true)
    setFitToken((n) => n + 1)
    setStatus('可以开始标注')
  }

  const requestCalloutCopy = useCallback((): string[] => {
    // 文案可在侧栏补填；内置浏览器不支持原生 prompt 弹窗。
    return calloutDraft
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  }, [calloutDraft])

  const updateSelectedCopy = (text: string) => {
    if (!selected || selected.type !== 'regionCallout') return
    const copies = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    commit((prev) =>
      prev.map((a) => (a.id === selected.id && a.type === 'regionCallout' ? { ...a, calloutCopy: copies } : a)),
    )
  }

  const updateSelectedName = (name: string) => {
    if (!selected || selected.type !== 'iconMark') return
    if (!isValidSemanticName(name) && name !== '') return
    commit((prev) =>
      prev.map((a) => (a.id === selected.id && a.type === 'iconMark' ? { ...a, semanticName: name } : a)),
    )
  }

  const pickWorkspace = async () => {
    if (!supportsDirectoryPicker()) {
      setStatus('当前浏览器不支持目录授权，Handoff 将回退为下载')
      return
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
      setWorkspace(handle)
      setStatus(`已授权工作区：${handle.name}`)
    } catch {
      setStatus('未选择工作区目录')
    }
  }

  const runHandoff = async () => {
    if (!sourceFile || !imageEl || !metaReady) {
      setStatus('请先完成上传与 PageSlug 设置')
      return
    }
    setBusy(true)
    try {
      const annotationJson = buildAnnotationDocument({
        pageSlug,
        targetStack,
        flutterPagePath: flutterPagePath.trim() || undefined,
        sourceFileName: sourceFile.name,
        imageWidth: imageEl.naturalWidth,
        imageHeight: imageEl.naturalHeight,
        annotations,
      })
      const project = buildAnnotatorProject(annotationJson, sourceFile.type)
      const annotatedPng = await renderAnnotatedPng(imageEl, annotations)
      const delivered = await sendHandoffToCodex({ sourceFile, annotatedPng, annotationJson, project })
      if (delivered) {
        setStatus(`已发送标注图到 Codex，等待处理 · ${delivered.bundlePath}`)
        return
      }
      const prompt = buildHandoffPrompt(pageSlug, targetStack)

      if (workspace) {
        const path = await writeHandoffBundle({
          root: workspace,
          pageSlug,
          sourceFile,
          annotatedPng,
          annotationJson,
          project,
        })
        await navigator.clipboard.writeText(prompt)
        setStatus(`已写入 ${path}，标准 prompt 已复制，请粘贴到 Codex`)
      } else {
        downloadBlob(annotatedPng, 'annotated.png')
        downloadBlob(
          new Blob([JSON.stringify(annotationJson, null, 2)], { type: 'application/json' }),
          'annotation.json',
        )
        downloadBlob(
          new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }),
          `${pageSlug}.itc.json`,
        )
        downloadBlob(sourceFile, `source-${sourceFile.name}`)
        await navigator.clipboard.writeText(prompt)
        setStatus('已下载 Handoff 文件，prompt 已复制。请放到 output/image-to-code/<page-slug>/ 后粘贴到 Codex')
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Handoff 失败')
    } finally {
      setBusy(false)
    }
  }

  const saveProjectOnly = async () => {
    if (!sourceFile || !imageEl || !metaReady) return
    const annotationJson = buildAnnotationDocument({
      pageSlug,
      targetStack,
      flutterPagePath: flutterPagePath.trim() || undefined,
      sourceFileName: sourceFile.name,
      imageWidth: imageEl.naturalWidth,
      imageHeight: imageEl.naturalHeight,
      annotations,
    })
    const project = buildAnnotatorProject(annotationJson, sourceFile.type)
    downloadBlob(
      new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }),
      `${pageSlug}.itc.json`,
    )
    setStatus('已下载 AnnotatorProject (.itc.json)')
  }

  const openProject = async (file: File) => {
    const text = await file.text()
    const data = JSON.parse(text) as {
      pageSlug: string
      targetStack: TargetStack
      flutterPagePath?: string
      annotations: Annotation[]
    }
    setPageSlug(data.pageSlug)
    setTargetStack(data.targetStack)
    setFlutterPagePath(data.flutterPagePath ?? '')
    replaceAnnotations(data.annotations ?? [])
    setMetaReady(true)
    setStatus('已载入 AnnotatorProject；请重新选择对应源图')
    fileInputRef.current?.click()
  }

  return (
    <div className="relative flex h-dvh min-h-0 flex-col gap-1 overflow-hidden p-1 sm:gap-1.5 sm:p-2">
      {draggingFile && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.28)] backdrop-blur-[2px]">
          <div className="rounded-2xl border-2 border-dashed border-[var(--accent)] bg-white/95 px-6 py-5 text-center shadow-xl">
            <p className="text-lg font-bold text-[var(--ink)]" style={{ fontFamily: 'var(--font-display)' }}>
              松开以上传设计图
            </p>
          </div>
        </div>
      )}

      <header className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--line)] bg-white/90 px-1.5 py-1 backdrop-blur sm:gap-2 sm:px-2">
        <h1 className="min-w-0 flex-1 truncate text-sm font-bold sm:text-base">
          <GradientText>Annotator</GradientText>
        </h1>
        <button type="button" className={btnSecondary} onClick={() => togglePanel('tools')}>
          工具
        </button>
        <button type="button" className={btnSecondary} onClick={() => togglePanel('props')}>
          属性
        </button>
        <button type="button" className={btnSecondary} onClick={() => fileInputRef.current?.click()}>
          上传
        </button>
        <button type="button" className={btnSecondary} onClick={() => void pickWorkspace()}>
          区
        </button>
        <button type="button" className={btnPrimary} disabled={busy || !metaReady} onClick={() => void runHandoff()}>
          {busy ? '发送中…' : '发送 Codex'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
        />
      </header>

      {/* 窄屏工具条：始终占一行，不抢画布高度 */}
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto rounded-lg border border-[var(--line)] bg-white/90 px-1 py-1 xl:hidden">
        {tools.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${chip} shrink-0 ${tool === t.id ? chipActive : ''}`}
            onClick={() => setTool(t.id)}
            title={t.hint}
          >
            {t.label}
          </button>
        ))}
        <span className="mx-0.5 h-4 w-px shrink-0 bg-[var(--line)]" />
        {(['page', 'card'] as BackgroundKind[]).map((k) => (
          <button
            key={k}
            type="button"
            className={`${chip} shrink-0 ${backgroundKind === k ? chipActive : ''}`}
            onClick={() => setBackgroundKind(k)}
          >
            {k === 'page' ? '页背景' : '卡背景'}
          </button>
        ))}
        <span className="mx-0.5 h-4 w-px shrink-0 bg-[var(--line)]" />
        <button type="button" className={`${btnSecondary} shrink-0`} disabled={!canUndo} onClick={undo}>
          撤
        </button>
        <button type="button" className={`${btnSecondary} shrink-0`} disabled={!canRedo} onClick={redo}>
          重
        </button>
        <button type="button" className={`${btnSecondary} shrink-0`} onClick={() => setFitToken((n) => n + 1)}>
          适应{Math.round(zoom * 100)}%
        </button>
      </div>

      <div className="relative grid min-h-0 flex-1 gap-1.5 xl:grid-cols-[168px_minmax(0,1fr)_168px]">
        {/* 大屏左侧工具 */}
        <SpotlightCard className="hidden min-h-0 flex-col overflow-auto p-2 xl:flex">
          <SectionTitle>工具箱</SectionTitle>
          <div className="mt-2 flex flex-col gap-1">
            {tools.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`${toolBtn} ${tool === t.id ? toolBtnActive : ''}`}
                onClick={() => setTool(t.id)}
              >
                <span className="text-sm font-semibold">{t.label}</span>
                <span className="block text-[11px] leading-snug text-[var(--muted)]">{t.hint}</span>
              </button>
            ))}
          </div>
          <SectionTitle className="mt-3">背景</SectionTitle>
          <div className="mt-1.5 flex gap-1">
            {(['page', 'card'] as BackgroundKind[]).map((k) => (
              <button
                key={k}
                type="button"
                className={`${chip} ${backgroundKind === k ? chipActive : ''}`}
                onClick={() => setBackgroundKind(k)}
              >
                {k === 'page' ? '页面' : '卡片'}
              </button>
            ))}
          </div>
          <SectionTitle className="mt-3">Region 文案</SectionTitle>
          <textarea
            className={`${inputClass} mt-1 min-h-16`}
            placeholder={'与背景一起生成的文字，每行一句'}
            value={calloutDraft}
            onChange={(e) => setCalloutDraft(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-1">
            <button type="button" className={btnSecondary} disabled={!canUndo} onClick={undo}>
              撤销
            </button>
            <button type="button" className={btnSecondary} disabled={!canRedo} onClick={redo}>
              重做
            </button>
            <button type="button" className={btnSecondary} onClick={() => setFitToken((n) => n + 1)}>
              适应 {Math.round(zoom * 100)}%
            </button>
          </div>
        </SpotlightCard>

        {/* 主画布：永远占满剩余空间 */}
        <SpotlightCard className="flex min-h-0 min-w-0 flex-col overflow-hidden p-1">
          {!imageUrl || !imageEl ? (
            <button
              type="button"
              className={`flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-[var(--muted)] transition ${
                draggingFile
                  ? 'border-[var(--accent)] bg-[rgba(0,180,216,0.08)] text-[var(--accent-strong)]'
                  : 'border-[var(--line)] bg-[var(--bg-elevated)]'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="text-base font-semibold text-[var(--ink)]" style={{ fontFamily: 'var(--font-display)' }}>
                拖放设计图
              </span>
              <span className="text-xs">或点击上传</span>
            </button>
          ) : !metaReady ? (
            <div className="flex h-full min-h-0 flex-col overflow-auto p-3">
              <div className="mx-auto w-full max-w-sm space-y-2 rounded-lg border border-[var(--line)] bg-white/90 p-3">
                <h2 className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                  会话设置
                </h2>
                <Field label="PageSlug">
                  <input
                    className={`${inputClass} ${metaError ? 'border-[var(--danger)]' : ''}`}
                    value={pageSlug}
                    onChange={(e) => {
                      setPageSlug(e.target.value)
                      setMetaError(null)
                    }}
                    placeholder="home-sleep"
                    autoFocus
                  />
                </Field>
                {metaError && <p className="text-xs text-[var(--danger)]">{metaError}</p>}
                <Field label="TargetStack">
                  <select
                    className={inputClass}
                    value={targetStack}
                    onChange={(e) => setTargetStack(e.target.value as TargetStack)}
                  >
                    <option value="flutter">flutter</option>
                    <option value="react">react</option>
                    <option value="html">html</option>
                  </select>
                </Field>
                {targetStack === 'flutter' && (
                  <Field label="FlutterPagePath">
                    <input
                      className={inputClass}
                      value={flutterPagePath}
                      onChange={(e) => setFlutterPagePath(e.target.value)}
                      placeholder="lib/.../page.dart"
                    />
                  </Field>
                )}
                <button type="button" className={`${btnPrimary} w-full`} onClick={confirmMeta}>
                  开始标注
                </button>
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1">
              <CanvasStage
                imageUrl={imageUrl}
                imageWidth={imageEl.naturalWidth}
                imageHeight={imageEl.naturalHeight}
                annotations={annotations}
                selectedId={selectedId}
                tool={tool}
                backgroundKind={backgroundKind}
                zoom={zoom}
                fitToken={fitToken}
                onZoomChange={setZoom}
                onSelect={setSelectedId}
                onCreated={(id) => {
                  setSelectedId(id)
                  setTool('select')
                }}
                onCommit={commit}
                onMutate={mutate}
                onDragStart={checkpoint}
                onRequestCalloutCopy={requestCalloutCopy}
              />
            </div>
          )}
        </SpotlightCard>

        {/* 大屏右侧属性 */}
        <SpotlightCard className="hidden min-h-0 flex-col overflow-auto p-2 xl:flex">
          <SectionTitle>选中项</SectionTitle>
          {!selected ? (
            <p className="mt-2 text-xs text-[var(--muted)]">选择一个标注</p>
          ) : selected.type === 'iconMark' ? (
            <div className="mt-2 space-y-2">
              <Field label="SemanticName">
                <input
                  className={inputClass}
                  value={selected.semanticName}
                  onChange={(e) => updateSelectedName(e.target.value)}
                />
              </Field>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-xs">
                {selected.type === 'backgroundCallout' ? 'Background' : 'Region'} · {selected.label}
              </p>
              {selected.type === 'regionCallout' && (
                <Field label="CalloutCopy">
                  <textarea
                    className={`${inputClass} min-h-20`}
                    value={(selected as RegionCallout).calloutCopy.join('\n')}
                    onChange={(e) => updateSelectedCopy(e.target.value)}
                  />
                </Field>
              )}
            </div>
          )}
          <SectionTitle className="mt-3">列表</SectionTitle>
          <ul className="mt-1 max-h-[36vh] space-y-0.5 overflow-auto text-xs">
            {annotations.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className={`w-full rounded-md px-2 py-1 text-left hover:bg-[var(--bg)] ${
                    a.id === selectedId ? 'bg-[var(--bg)] ring-1 ring-[var(--accent)]' : ''
                  }`}
                  onClick={() => setSelectedId(a.id)}
                >
                  {a.type === 'iconMark'
                    ? `Icon · ${a.semanticName}`
                    : a.type === 'backgroundCallout'
                      ? `BG · ${a.label}`
                      : `Region · ${a.calloutCopy[0] ?? a.label}`}
                </button>
              </li>
            ))}
          </ul>
          <SectionTitle className="mt-3">导出</SectionTitle>
          <button type="button" className={`${btnSecondary} mt-1`} disabled={!metaReady} onClick={() => void saveProjectOnly()}>
            保存 .itc.json
          </button>
          <p className="mt-1 break-all text-[10px] text-[var(--muted)]">
            <code className="text-[var(--ink)]">output/image-to-code/{pageSlug || '<slug>'}/</code>
          </p>
        </SpotlightCard>

        {/* 窄屏抽屉 */}
        {sidePanel && (
          <div className="absolute inset-0 z-40 flex xl:hidden" onClick={() => { setSidePanel(null); setFitToken((n) => n + 1) }}>
            <div className="absolute inset-0 bg-black/25" />
            <div
              className={`relative z-10 flex h-full w-[min(280px,88%)] flex-col overflow-auto bg-white p-3 shadow-xl ${
                sidePanel === 'props' ? 'ml-auto' : ''
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between">
                <SectionTitle>{sidePanel === 'tools' ? '工具箱' : '属性 / 导出'}</SectionTitle>
                <button type="button" className={btnSecondary} onClick={() => { setSidePanel(null); setFitToken((n) => n + 1) }}>
                  关闭
                </button>
              </div>
              {sidePanel === 'tools' ? (
                <>
                  <div className="flex flex-col gap-1">
                    {tools.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`${toolBtn} ${tool === t.id ? toolBtnActive : ''}`}
                        onClick={() => {
                          setTool(t.id)
                          setSidePanel(null)
                        }}
                      >
                        <span className="text-sm font-semibold">{t.label}</span>
                        <span className="block text-[11px] text-[var(--muted)]">{t.hint}</span>
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 block text-[11px] text-[var(--muted)]">Region CalloutCopy</label>
                  <textarea
                    className={`${inputClass} min-h-20`}
                    value={calloutDraft}
                    onChange={(e) => setCalloutDraft(e.target.value)}
                  />
                </>
              ) : (
                <>
                  {!selected ? (
                    <p className="text-xs text-[var(--muted)]">未选中标注</p>
                  ) : selected.type === 'iconMark' ? (
                    <Field label="SemanticName">
                      <input
                        className={inputClass}
                        value={selected.semanticName}
                        onChange={(e) => updateSelectedName(e.target.value)}
                      />
                    </Field>
                  ) : selected.type === 'regionCallout' ? (
                    <Field label="CalloutCopy">
                      <textarea
                        className={`${inputClass} min-h-24`}
                        value={selected.calloutCopy.join('\n')}
                        onChange={(e) => updateSelectedCopy(e.target.value)}
                      />
                    </Field>
                  ) : (
                    <p className="text-xs">{selected.label}</p>
                  )}
                  <SectionTitle className="mt-3">列表 · {annotations.length}</SectionTitle>
                  <ul className="mt-1 max-h-48 space-y-0.5 overflow-auto text-xs">
                    {annotations.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          className="w-full rounded-md px-2 py-1 text-left hover:bg-[var(--bg)]"
                          onClick={() => setSelectedId(a.id)}
                        >
                          {a.type === 'iconMark'
                            ? a.semanticName
                            : a.type === 'backgroundCallout'
                              ? `BG ${a.label}`
                              : a.calloutCopy[0] ?? 'Region'}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className={`${btnSecondary} mt-3`}
                    disabled={!metaReady}
                    onClick={() => void saveProjectOnly()}
                  >
                    保存 .itc.json
                  </button>
                  <button
                    type="button"
                    className={`${btnSecondary} mt-1`}
                    onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = '.itc.json,application/json'
                      input.onchange = () => {
                        const f = input.files?.[0]
                        if (f) void openProject(f)
                      }
                      input.click()
                    }}
                  >
                    打开 .itc.json
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="shrink-0 truncate rounded-md border border-[var(--line)] bg-white/80 px-2 py-0.5 text-[10px] text-[var(--muted)] sm:text-xs">
        {status}
        {workspace ? ` · ${workspace.name}` : ''}
        {` · ${annotations.length}`}
      </footer>
    </div>
  )
}


function SectionTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={`text-sm font-bold tracking-wide text-[var(--ink)] ${className}`}
      style={{ fontFamily: 'var(--font-display)' }}
    >
      {children}
    </h2>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[var(--muted)]">{label}</span>
      {children}
    </label>
  )
}

const btnPrimary =
  'rounded-md bg-[var(--accent)] px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50'
const btnSecondary =
  'rounded-md border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--ink)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50'
const toolBtn =
  'rounded-md border border-transparent bg-[var(--bg-elevated)] px-2 py-1.5 text-left transition hover:border-[var(--line)]'
const toolBtnActive = 'border-[var(--accent)] bg-white shadow-sm'
const chip = 'rounded-md border border-[var(--line)] px-2 py-0.5 text-xs'
const chipActive = 'border-[var(--accent)] bg-[rgba(0,180,216,0.12)] text-[var(--accent-strong)]'
const inputClass =
  'mt-0.5 w-full rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-xs outline-none focus:border-[var(--accent)]'
