import { useMemo, useReducer, type ReactNode } from 'react'
import type { Rect } from '../pdf/coords.ts'
import { AnnotationsContext, type AnnotationsApi, type TextPatch } from './annotationsStore.ts'
import type { Annotation } from './types.ts'

/** Deep history would be nice, but signature data URLs are heavy. */
const HISTORY_LIMIT = 50

type State = {
  past: Annotation[][]
  present: Annotation[]
  future: Annotation[][]
  /** Deliberately outside the history: undo should not restore a stale selection. */
  selectedId: string | null
}

type Action =
  | { type: 'reset' }
  | { type: 'checkpoint' }
  | { type: 'add'; annotation: Annotation }
  | { type: 'setRect'; id: string; rect: Rect }
  | { type: 'setText'; id: string; patch: TextPatch }
  | { type: 'remove'; id: string }
  | { type: 'select'; id: string | null }
  | { type: 'undo' }
  | { type: 'redo' }

const initialState: State = { past: [], present: [], future: [], selectedId: null }

function checkpoint(state: State): State {
  return {
    ...state,
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    future: [],
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'reset':
      return initialState

    case 'checkpoint':
      return checkpoint(state)

    case 'add': {
      const next = checkpoint(state)
      return {
        ...next,
        present: [...next.present, action.annotation],
        selectedId: action.annotation.id,
      }
    }

    case 'remove': {
      const next = checkpoint(state)
      return {
        ...next,
        present: next.present.filter((annotation) => annotation.id !== action.id),
        selectedId: next.selectedId === action.id ? null : next.selectedId,
      }
    }

    case 'setRect':
      return {
        ...state,
        present: state.present.map((annotation) =>
          annotation.id === action.id ? { ...annotation, rect: action.rect } : annotation,
        ),
      }

    case 'setText':
      return {
        ...state,
        present: state.present.map((annotation) =>
          annotation.id === action.id && annotation.kind === 'text'
            ? { ...annotation, ...action.patch }
            : annotation,
        ),
      }

    case 'select':
      return { ...state, selectedId: action.id }

    case 'undo': {
      const previous = state.past.at(-1)
      if (!previous) return state
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        selectedId: keepSelection(state.selectedId, previous),
      }
    }

    case 'redo': {
      const [next, ...rest] = state.future
      if (!next) return state
      return {
        past: [...state.past, state.present],
        present: next,
        future: rest,
        selectedId: keepSelection(state.selectedId, next),
      }
    }
  }
}

function keepSelection(selectedId: string | null, annotations: Annotation[]): string | null {
  return annotations.some((annotation) => annotation.id === selectedId) ? selectedId : null
}

export function AnnotationsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const api = useMemo<AnnotationsApi>(
    () => ({
      annotations: state.present,
      selectedId: state.selectedId,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      add: (annotation) => dispatch({ type: 'add', annotation }),
      setRect: (id, rect) => dispatch({ type: 'setRect', id, rect }),
      setText: (id, patch) => dispatch({ type: 'setText', id, patch }),
      remove: (id) => dispatch({ type: 'remove', id }),
      select: (id) => dispatch({ type: 'select', id }),
      checkpoint: () => dispatch({ type: 'checkpoint' }),
      undo: () => dispatch({ type: 'undo' }),
      redo: () => dispatch({ type: 'redo' }),
      reset: () => dispatch({ type: 'reset' }),
    }),
    [state],
  )

  return <AnnotationsContext.Provider value={api}>{children}</AnnotationsContext.Provider>
}
