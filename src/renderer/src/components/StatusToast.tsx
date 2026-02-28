import { useState, useEffect, useSyncExternalStore } from 'react'

type Status = { message: string } | null

let current: Status = null
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((l) => l())
}

export function showStatus(message: string): () => void {
  current = { message }
  notify()
  return () => {
    if (current?.message === message) {
      current = null
      notify()
    }
  }
}

export default function StatusToast(): React.JSX.Element | null {
  const status = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current
  )

  if (!status) return null

  return (
    <div className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] shadow-lg text-sm text-[var(--foreground)]">
      <svg className="w-4 h-4 animate-spin text-[var(--primary)]" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {status.message}
    </div>
  )
}
