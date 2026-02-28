import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { VolumeWithChapters } from '../types'

export default function VolumePage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>()
  const [volume, setVolume] = useState<VolumeWithChapters | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    api.getVolume(parseInt(id, 10)).then((result) => {
      setVolume(result)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--muted-foreground)]">
        Loading...
      </div>
    )
  }

  if (!volume) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--muted-foreground)]">
        Volume not found.
      </div>
    )
  }

  const chapters = volume.chapters.filter((c) => c.type === 'chapter')
  const extras = volume.chapters.filter((c) => c.type === 'extra')

  const handleOpen = async (filePath: string): Promise<void> => {
    await api.openFile(filePath)
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <Link
          to={`/comic/${volume.comic_id}`}
          className="inline-block mb-6 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          &larr; Back to comic
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Volume {volume.number}</h1>
          {volume.file && (
            <button
              onClick={() => handleOpen(volume.file!)}
              className="mt-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Read Full Volume
            </button>
          )}
        </div>

        {chapters.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Chapters</h2>
            <div className="space-y-2">
              {chapters.map((ch) => (
                <div
                  key={ch.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]"
                >
                  <span className="font-medium">Chapter {ch.number}</span>
                  <button
                    onClick={() => handleOpen(ch.file)}
                    className="px-3 py-1 text-sm rounded border border-[var(--border)] hover:bg-[var(--secondary)] transition-colors"
                  >
                    Read
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {extras.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Extras</h2>
            <div className="space-y-2">
              {extras.map((ex) => (
                <div
                  key={ex.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]"
                >
                  <span className="font-medium">Extra {ex.number}</span>
                  <button
                    onClick={() => handleOpen(ex.file)}
                    className="px-3 py-1 text-sm rounded border border-[var(--border)] hover:bg-[var(--secondary)] transition-colors"
                  >
                    Read
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {chapters.length === 0 && extras.length === 0 && (
          <div className="text-center py-10 text-[var(--muted-foreground)]">
            No chapters or extras found in this volume.
          </div>
        )}
      </div>
    </div>
  )
}
