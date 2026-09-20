import { useCallback, useState } from 'react'
import type { Annotation } from '../types'

export function useAnnotationHistory(initial: Annotation[] = []) {
  const [past, setPast] = useState<Annotation[][]>([])
  const [present, setPresent] = useState<Annotation[]>(initial)
  const [future, setFuture] = useState<Annotation[][]>([])

  const commit = useCallback((next: Annotation[] | ((prev: Annotation[]) => Annotation[])) => {
    setPresent((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next
      setPast((p) => [...p, prev])
      setFuture([])
      return resolved
    })
  }, [])

  /** Live update without pushing history (e.g. drag). */
  const mutate = useCallback((next: Annotation[] | ((prev: Annotation[]) => Annotation[])) => {
    setPresent((prev) => (typeof next === 'function' ? next(prev) : next))
  }, [])

  const checkpoint = useCallback(() => {
    setPresent((prev) => {
      setPast((p) => [...p, prev])
      setFuture([])
      return prev
    })
  }, [])

  const replaceAnnotations = useCallback((next: Annotation[]) => {
    setPast([])
    setPresent(next)
    setFuture([])
  }, [])

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p
      const previous = p[p.length - 1]
      setFuture((f) => [present, ...f])
      setPresent(previous)
      return p.slice(0, -1)
    })
  }, [present])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f
      const next = f[0]
      setPast((p) => [...p, present])
      setPresent(next)
      return f.slice(1)
    })
  }, [present])

  return {
    annotations: present,
    commit,
    mutate,
    checkpoint,
    replaceAnnotations,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  }
}
