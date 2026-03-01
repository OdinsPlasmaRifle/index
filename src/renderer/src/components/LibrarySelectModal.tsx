import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { LibraryWithCount } from '../types'

interface LibrarySelectModalProps {
  defaultLibraryId?: number
  onSelect: (libraryId: number) => void
  onCancel: () => void
}

export default function LibrarySelectModal({ defaultLibraryId, onSelect, onCancel }: LibrarySelectModalProps): React.JSX.Element {
  const [libraries, setLibraries] = useState<LibraryWithCount[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(defaultLibraryId ?? null)

  useEffect(() => {
    api.getLibraries(undefined, 'include').then(setLibraries)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Select Library</h2>

        {libraries.length === 0 ? (
          <p className="text-[var(--muted-foreground)] text-sm py-4">
            No libraries found. Create a library first via File &rarr; Add Library.
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {libraries.map((lib) => (
              <button
                key={lib.id}
                onClick={() => setSelectedId(lib.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedId === lib.id
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                    : 'border-[var(--border)] hover:bg-[var(--secondary)]'
                }`}
              >
                <span className="font-medium text-sm">{lib.name}</span>
                <span className="text-xs text-[var(--muted-foreground)] ml-2">
                  ({lib.comic_count} comic{lib.comic_count !== 1 ? 's' : ''})
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-md border border-[var(--border)] hover:bg-[var(--secondary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => selectedId !== null && onSelect(selectedId)}
            disabled={selectedId === null}
            className="px-4 py-2 text-sm rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Import to Library
          </button>
        </div>
      </div>
    </div>
  )
}
