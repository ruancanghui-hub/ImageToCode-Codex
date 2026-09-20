import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  Annotation,
  BackgroundCallout,
  BackgroundKind,
  IconMark,
  Point,
  RegionCallout,
  ToolId,
} from '../types'
import { backgroundLabel, displayBackgroundLabel, nextIconSemanticName } from '../lib/labels'

interface CanvasStageProps {
  imageUrl: string
  imageWidth: number
  imageHeight: number
  annotations: Annotation[]
  selectedId: string | null
  tool: ToolId
  backgroundKind: BackgroundKind
  zoom: number
  fitToken?: number
  onZoomChange: (zoom: number) => void
  onSelect: (id: string | null) => void
  onCommit: (next: Annotation[] | ((prev: Annotation[]) => Annotation[])) => void
  onMutate: (next: Annotation[] | ((prev: Annotation[]) => Annotation[])) => void
  onDragStart: () => void
  onRequestCalloutCopy: () => string[]
}

function computeFit(containerW: number, containerH: number, imageW: number, imageH: number) {
  const pad = 20
  const zx = (containerW - pad * 2) / imageW
  const zy = (containerH - pad * 2) / imageH
  const zoom = Math.min(zx, zy, 1.25)
  const clamped = Math.max(0.05, zoom)
  const pan = {
    x: (containerW - imageW * clamped) / 2,
    y: (containerH - imageH * clamped) / 2,
  }
  return { zoom: clamped, pan }
}


function hitTest(ann: Annotation, p: Point): boolean {
  if (ann.type === 'iconMark') {
    return p.x >= ann.x && p.x <= ann.x + ann.width && p.y >= ann.y && p.y <= ann.y + ann.height
  }
  const dist = distanceToSegment(p, ann.from, ann.to)
  return dist < 12
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function normalizeRect(x0: number, y0: number, x1: number, y1: number) {
  const x = Math.min(x0, x1)
  const y = Math.min(y0, y1)
  const width = Math.abs(x1 - x0)
  const height = Math.abs(y1 - y0)
  return { x, y, width, height }
}

export function CanvasStage(props: CanvasStageProps) {
  const {
    imageUrl,
    imageWidth,
    imageHeight,
    annotations,
    selectedId,
    tool,
    backgroundKind,
    zoom,
    fitToken = 0,
    onZoomChange,
    onSelect,
    onCommit,
    onMutate,
    onDragStart,
    onRequestCalloutCopy,
  } = props

  const wrapRef = useRef<HTMLDivElement>(null)
  const fittedKeyRef = useRef<string>('')
  const rectStartRef = useRef<Point | null>(null)
  const draftRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  const annotationsRef = useRef(annotations)
  annotationsRef.current = annotations
  const [draftRect, setDraftRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [arrowStart, setArrowStart] = useState<Point | null>(null)
  const [arrowPreview, setArrowPreview] = useState<Point | null>(null)
  const [drag, setDrag] = useState<{
    id: string
    mode: 'move' | 'resize'
    start: Point
    origin: Annotation
  } | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [panning, setPanning] = useState<{ sx: number; sy: number; ox: number; oy: number } | null>(null)

  const setDraft = (rect: { x: number; y: number; width: number; height: number } | null) => {
    draftRectRef.current = rect
    setDraftRect(rect)
  }

  const commitIconMark = (rect: { x: number; y: number; width: number; height: number }) => {
    if (rect.width <= 4 || rect.height <= 4) return
    const item: IconMark = {
      id: crypto.randomUUID(),
      type: 'iconMark',
      ...rect,
      semanticName: nextIconSemanticName(annotationsRef.current),
    }
    onCommit((prev) => [...prev, item])
    onSelect(item.id)
  }

  const panRef = useRef(pan)
  const zoomRef = useRef(zoom)
  panRef.current = pan
  zoomRef.current = zoom

  const toImagePoint = (clientX: number, clientY: number): Point | null => {
    const wrap = wrapRef.current
    if (!wrap) return null
    const rect = wrap.getBoundingClientRect()
    const z = zoomRef.current
    const p = panRef.current
    const x = (clientX - rect.left - p.x) / z
    const y = (clientY - rect.top - p.y) / z
    return { x, y }
  }

  const fitToView = (force = false) => {
    const wrap = wrapRef.current
    if (!wrap || !imageWidth || !imageHeight) return
    const key = `${imageUrl}:${imageWidth}x${imageHeight}:${Math.round(wrap.clientWidth)}x${Math.round(wrap.clientHeight)}`
    if (!force && fittedKeyRef.current === key) return
    fittedKeyRef.current = key
    const { zoom: nextZoom, pan: nextPan } = computeFit(
      wrap.clientWidth,
      wrap.clientHeight,
      imageWidth,
      imageHeight,
    )
    onZoomChange(nextZoom)
    setPan(nextPan)
  }

  useEffect(() => {
    fittedKeyRef.current = ''
    // 等布局完成后再测量
    const id = requestAnimationFrame(() => fitToView(true))
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, imageWidth, imageHeight])

  useEffect(() => {
    if (fitToken <= 0) return
    fittedKeyRef.current = ''
    fitToView(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToken])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '0' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        fittedKeyRef.current = ''
        fitToView(true)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        onCommit((prev) => prev.filter((a) => a.id !== selectedId))
        onSelect(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, onCommit, onSelect, imageUrl, imageWidth, imageHeight, onZoomChange])

  const sorted = useMemo(() => annotations, [annotations])

  return (
    <div
      ref={wrapRef}
      className="relative h-full min-h-0 w-full cursor-crosshair overflow-hidden rounded-lg bg-[#d6dee8]"
      onWheel={(e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          const wrap = wrapRef.current
          if (!wrap) return
          const rect = wrap.getBoundingClientRect()
          const mx = e.clientX - rect.left
          const my = e.clientY - rect.top
          const factor = e.deltaY > 0 ? 0.9 : 1.1
          const next = Math.min(4, Math.max(0.05, zoom * factor))
          const ix = (mx - pan.x) / zoom
          const iy = (my - pan.y) / zoom
          onZoomChange(next)
          setPan({ x: mx - ix * next, y: my - iy * next })
          return
        }
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
      }}
      onMouseDown={(e) => {
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
          setPanning({ sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y })
          return
        }
        const p = toImagePoint(e.clientX, e.clientY)
        if (!p) return

        if (tool === 'select') {
          const hit = [...annotations].reverse().find((a) => hitTest(a, p))
          onSelect(hit?.id ?? null)
          if (hit) {
            const nearCorner =
              hit.type === 'iconMark' &&
              Math.hypot(p.x - (hit.x + hit.width), p.y - (hit.y + hit.height)) < 12
            onDragStart()
            setDrag({
              id: hit.id,
              mode: nearCorner ? 'resize' : 'move',
              start: p,
              origin: structuredClone(hit),
            })
          }
          return
        }

        if (tool === 'iconMark') {
          rectStartRef.current = p
          setDraft({ x: p.x, y: p.y, width: 0, height: 0 })

          const onMove = (ev: MouseEvent) => {
            if (!rectStartRef.current) return
            const pt = toImagePoint(ev.clientX, ev.clientY)
            if (!pt) return
            setDraft(normalizeRect(rectStartRef.current.x, rectStartRef.current.y, pt.x, pt.y))
          }
          const onUp = (ev: MouseEvent) => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
            if (!rectStartRef.current) return
            const pt = toImagePoint(ev.clientX, ev.clientY)
            const start = rectStartRef.current
            const rect = pt
              ? normalizeRect(start.x, start.y, pt.x, pt.y)
              : draftRectRef.current
            rectStartRef.current = null
            setDraft(null)
            if (rect) commitIconMark(rect)
          }
          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
          return
        }

        if (tool === 'backgroundCallout' || tool === 'regionCallout') {
          if (!arrowStart) {
            setArrowStart(p)
            setArrowPreview(p)
          } else {
            const id = crypto.randomUUID()
            const label = backgroundLabel(backgroundKind)
            if (tool === 'backgroundCallout') {
              const item: BackgroundCallout = {
                id,
                type: 'backgroundCallout',
                from: arrowStart,
                to: p,
                backgroundKind,
                label,
              }
              onCommit((prev) => [...prev, item])
              onSelect(id)
            } else {
              const copies = onRequestCalloutCopy()
              const item: RegionCallout = {
                id,
                type: 'regionCallout',
                from: arrowStart,
                to: p,
                backgroundKind,
                label,
                calloutCopy: copies,
              }
              onCommit((prev) => [...prev, item])
              onSelect(id)
            }
            setArrowStart(null)
            setArrowPreview(null)
          }
        }
      }}
      onMouseMove={(e) => {
        if (panning) {
          setPan({
            x: panning.ox + (e.clientX - panning.sx),
            y: panning.oy + (e.clientY - panning.sy),
          })
          return
        }
        const p = toImagePoint(e.clientX, e.clientY)
        if (!p) return

        if (arrowStart) setArrowPreview(p)

        if (drag) {
          const dx = p.x - drag.start.x
          const dy = p.y - drag.start.y
          onMutate((prev) =>
            prev.map((a) => {
              if (a.id !== drag.id) return a
              const origin = drag.origin
              if (origin.type === 'iconMark' && a.type === 'iconMark') {
                if (drag.mode === 'move') {
                  return { ...a, x: origin.x + dx, y: origin.y + dy }
                }
                return {
                  ...a,
                  width: Math.max(8, origin.width + dx),
                  height: Math.max(8, origin.height + dy),
                }
              }
              if (origin.type !== 'iconMark' && a.type !== 'iconMark') {
                return {
                  ...a,
                  from: { x: origin.from.x + dx, y: origin.from.y + dy },
                  to: { x: origin.to.x + dx, y: origin.to.y + dy },
                }
              }
              return a
            }),
          )
        }
      }}
      onMouseUp={() => {
        if (panning) {
          setPanning(null)
          return
        }
        if (drag) {
          setDrag(null)
        }
        // IconMark 由 window mouseup 提交，避免画布外松手丢失
      }}
      onMouseLeave={() => {
        if (!rectStartRef.current) {
          setPanning(null)
          setDrag(null)
        }
      }}
    >
      <div
        className="absolute origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          width: imageWidth,
          height: imageHeight,
        }}
      >
        <img
          src={imageUrl}
          alt="design"
          draggable={false}
          className="pointer-events-none select-none"
          style={{ width: imageWidth, height: imageHeight }}
        />
        <svg
          className="absolute inset-0"
          width={imageWidth}
          height={imageHeight}
          viewBox={`0 0 ${imageWidth} ${imageHeight}`}
        >
          {sorted.map((a) => {
            const selected = a.id === selectedId
            if (a.type === 'iconMark') {
              return (
                <g key={a.id}>
                  <rect
                    x={a.x}
                    y={a.y}
                    width={a.width}
                    height={a.height}
                    fill="rgba(225,29,72,0.12)"
                    stroke="#e11d48"
                    strokeWidth={selected ? 3 : 2}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={a.x}
                    y={a.y - 6}
                    fill="#e11d48"
                    fontSize={12}
                    fontWeight={700}
                    style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3 }}
                  >
                    {a.semanticName}
                  </text>
                  {selected && (
                    <rect
                      x={a.x + a.width - 6}
                      y={a.y + a.height - 6}
                      width={12}
                      height={12}
                      fill="#00b4d8"
                      stroke="#0f172a"
                      strokeWidth={1}
                    />
                  )}
                </g>
              )
            }
            return (
              <g key={a.id}>
                <defs>
                  <marker
                    id={`arrow-${a.id}`}
                    markerWidth="10"
                    markerHeight="10"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L0,6 L9,3 z" fill="#e11d48" />
                  </marker>
                </defs>
                <line
                  x1={a.from.x}
                  y1={a.from.y}
                  x2={a.to.x}
                  y2={a.to.y}
                  stroke="#e11d48"
                  strokeWidth={selected ? 3 : 2}
                  vectorEffect="non-scaling-stroke"
                  markerEnd={`url(#arrow-${a.id})`}
                />
                <rect
                  x={a.from.x + 6}
                  y={a.from.y - 28}
                  width={Math.max(72, displayBackgroundLabel(a.backgroundKind).length * 12)}
                  height={22}
                  rx={6}
                  fill="rgba(255,255,255,0.92)"
                  stroke="#e11d48"
                />
                <text x={a.from.x + 12} y={a.from.y - 12} fill="#e11d48" fontSize={13} fontWeight={700}>
                  {a.label}
                </text>
                {a.type === 'regionCallout' && a.calloutCopy[0] && (
                  <text x={a.to.x + 8} y={a.to.y + 18} fill="#0077a8" fontSize={12}>
                    {a.calloutCopy[0].slice(0, 28)}
                  </text>
                )}
              </g>
            )
          })}
          {draftRect && (
            <rect
              x={draftRect.x}
              y={draftRect.y}
              width={draftRect.width}
              height={draftRect.height}
              fill="rgba(225,29,72,0.12)"
              stroke="#e11d48"
              strokeDasharray="6 4"
              strokeWidth={2}
            />
          )}
          {arrowStart && arrowPreview && (
            <line
              x1={arrowStart.x}
              y1={arrowStart.y}
              x2={arrowPreview.x}
              y2={arrowPreview.y}
              stroke="#e11d48"
              strokeWidth={2}
              strokeDasharray="5 4"
            />
          )}
        </svg>
      </div>
      <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-white/85 px-2 py-1 text-[11px] text-[var(--muted)]">
        Alt+拖拽平移 · 滚轮平移 · ⌘/Ctrl+滚轮缩放 · ⌘/Ctrl+0 适应
      </div>
    </div>
  )
}
