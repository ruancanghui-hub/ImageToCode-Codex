export type TargetStack = 'flutter' | 'react' | 'html'

export type ToolId = 'select' | 'iconMark' | 'backgroundCallout' | 'regionCallout'

export type BackgroundKind = 'page' | 'card'

export interface Point {
  x: number
  y: number
}

export interface IconMark {
  id: string
  type: 'iconMark'
  x: number
  y: number
  width: number
  height: number
  semanticName: string
}

export interface BackgroundCallout {
  id: string
  type: 'backgroundCallout'
  from: Point
  to: Point
  backgroundKind: BackgroundKind
  label: string
}

export interface RegionCallout {
  id: string
  type: 'regionCallout'
  from: Point
  to: Point
  backgroundKind: BackgroundKind
  label: string
  calloutCopy: string[]
}

export type Annotation = IconMark | BackgroundCallout | RegionCallout

export interface AnnotatorProject {
  version: 1
  pageSlug: string
  targetStack: TargetStack
  flutterPagePath?: string
  sourceFileName: string
  sourceMimeType: string
  imageWidth: number
  imageHeight: number
  annotations: Annotation[]
}

export interface AnnotationDocument {
  version: 1
  pageSlug: string
  targetStack: TargetStack
  flutterPagePath?: string
  sourceFileName: string
  imageWidth: number
  imageHeight: number
  annotations: Annotation[]
  exportedAt: string
}
