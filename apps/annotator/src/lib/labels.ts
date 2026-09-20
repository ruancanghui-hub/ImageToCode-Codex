import type { BackgroundKind } from '../types'

export function backgroundLabel(kind: BackgroundKind): string {
  return kind === 'card' ? '背景' : '背景'
}

export function backgroundLabelEn(kind: BackgroundKind): string {
  return kind === 'card' ? 'background' : 'background'
}

export function displayBackgroundLabel(kind: BackgroundKind): string {
  return kind === 'card' ? '背景（卡片）' : '背景（页面）'
}

export function isValidSemanticName(value: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(value)
}

export function isValidPageSlug(value: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(value)
}

/** 自动生成 IconMark 语义名：icon_1, icon_2…（跳过已占用编号） */
export function nextIconSemanticName(existing: { type: string; semanticName?: string }[]): string {
  const used = new Set(
    existing
      .filter((a) => a.type === 'iconMark' && a.semanticName)
      .map((a) => a.semanticName as string),
  )
  let i = 1
  while (used.has(`icon_${i}`)) i += 1
  return `icon_${i}`
}

/** 从文件名生成可用 PageSlug；失败则返回空串。 */
export function suggestPageSlug(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '')
  const slug = base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
  if (!slug) return 'page'
  if (/^[a-z]/.test(slug)) return slug
  return `page-${slug}`
}
