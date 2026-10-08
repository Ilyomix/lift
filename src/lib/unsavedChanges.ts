import { useEffect, useRef, useSyncExternalStore } from 'react'

type Draft = { dirty: boolean; discarded: boolean }
const drafts = new Set<Draft>()
const listeners = new Set<() => void>()
const pending = (draft: Draft) => draft.dirty && !draft.discarded
let confirmation: { drafts: Set<Draft>; promise: Promise<boolean>; finish: (allowed: boolean) => void } | undefined
const emit = () => listeners.forEach(listener => listener())
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const isOpen = () => !!confirmation
const resolve = (allowed: boolean) => {
  const current = confirmation
  if (!current) return
  confirmation = undefined
  if (allowed) current.drafts.forEach(draft => { draft.discarded = true })
  emit()
  current.finish(allowed)
}

/** One Lift dialog serves concurrent attempts to leave the same drafts. */
export function useDiscardConfirmation() {
  return { open: useSyncExternalStore(subscribe, isOpen, () => false), resolve }
}

function commitMeasurements() {
  // Read the parent's dirty state only after pending wheels commit their draft.
  if (typeof document !== 'undefined') document.dispatchEvent?.(new Event('lift:commit-measurements'))
}

function confirmDrafts(candidates: Iterable<Draft>): Promise<boolean> {
  commitMeasurements()
  const changed = [...candidates].filter(pending)
  if (!changed.length) return Promise.resolve(true)
  if (confirmation) {
    changed.forEach(draft => confirmation!.drafts.add(draft))
    return confirmation.promise
  }
  let finish!: (allowed: boolean) => void
  const promise = new Promise<boolean>(done => { finish = done })
  confirmation = { drafts: new Set(changed), promise, finish }
  emit()
  return promise
}

export const confirmUnsavedChanges = () => confirmDrafts(drafts)

/** Refs follow the render, so navigation never reads an effect-delayed dirty flag. */
export function useUnsavedChanges(dirty: boolean) {
  const ref = useRef<Draft>({ dirty, discarded: false })
  if (ref.current.dirty !== dirty) {
    ref.current.dirty = dirty
    ref.current.discarded = false
  }
  useEffect(() => {
    const draft = ref.current
    drafts.add(draft)
    return () => { drafts.delete(draft) }
  }, [])
  return {
    discard: () => { ref.current.discarded = true },
    rearm: () => { ref.current.discarded = false },
    confirm: () => confirmDrafts([ref.current]),
  }
}
