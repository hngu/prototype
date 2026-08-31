import { createContext, useContext } from 'react'
import type { Rect } from '../pdf/coords.ts'
import type { Annotation, TextAnnotation } from './types.ts'

export type TextPatch = Partial<Pick<TextAnnotation, 'lines' | 'fontSize' | 'font' | 'color'>>

export type AnnotationsApi = {
  annotations: Annotation[]
  selectedId: string | null
  canUndo: boolean
  canRedo: boolean
  add: (annotation: Annotation) => void
  setRect: (id: string, rect: Rect) => void
  setText: (id: string, patch: TextPatch) => void
  remove: (id: string) => void
  select: (id: string | null) => void
  /**
   * Opens a history entry. Drags and typing emit a burst of updates that should
   * collapse into one undo step, so a gesture checkpoints once when it starts
   * and then mutates freely.
   */
  checkpoint: () => void
  undo: () => void
  redo: () => void
  reset: () => void
}

export const AnnotationsContext = createContext<AnnotationsApi | null>(null)

export function useAnnotations(): AnnotationsApi {
  const api = useContext(AnnotationsContext)
  if (!api) throw new Error('useAnnotations must be used inside <AnnotationsProvider>')
  return api
}
