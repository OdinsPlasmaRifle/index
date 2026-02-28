import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { showStatus } from '../components/StatusToast'

interface ImportDirectory {
  id: number
  path: string
  hidden: number
}

export default function SettingsPage(): React.JSX.Element {
  const [directories, setDirectories] = useState<ImportDirectory[]>([])
  const [refreshingId, setRefreshingId] = useState<number | null>(null)

  const loadDirectories = async (): Promise<void> => {
    const dirs = await api.getImportDirectories()
    setDirectories(dirs)
  }

  useEffect(() => {
    loadDirectories()
  }, [])

  const handleRefresh = async (dir: ImportDirectory): Promise<void> => {
    setRefreshingId(dir.id)
    try {
      const result = await api.refreshImportDirectory(dir.id)
      if (result) {
        const dismiss = showStatus(
          `Refreshed: ${result.imported} imported, ${result.updated} updated`
        )
        setTimeout(dismiss, 3000)
      }
    } finally {
      setRefreshingId(null)
    }
  }

  const [clearingId, setClearingId] = useState<number | null>(null)

  const handleClear = async (dir: ImportDirectory): Promise<void> => {
    setClearingId(dir.id)
  }

  const confirmClear = async (dir: ImportDirectory): Promise<void> => {
    await api.clearImportDirectory(dir.id)
    setDirectories((prev) => prev.filter((d) => d.id !== dir.id))
    setClearingId(null)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link to="/" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4 inline-block">
        &larr; Back
      </Link>

      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <section>
        <h2 className="text-lg font-semibold mb-3">Import Directories</h2>

        {directories.length === 0 ? (
          <p className="text-[var(--muted-foreground)]">No directories have been imported yet.</p>
        ) : (
          <div className="space-y-2">
            {directories.map((dir) => (
              <div
                key={dir.id}
                className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]"
              >
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm font-mono truncate" title={dir.path}>
                    {dir.path}
                  </p>
                  {dir.hidden === 1 && (
                    <span className="text-xs text-[var(--muted-foreground)]">Hidden</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {clearingId === dir.id ? (
                    <>
                      <span className="text-sm text-[var(--muted-foreground)]">
                        Clear all comics from this directory?
                      </span>
                      <button
                        onClick={() => confirmClear(dir)}
                        className="px-3 py-1.5 text-sm rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
                      >
                        Clear All
                      </button>
                      <button
                        onClick={() => setClearingId(null)}
                        className="px-3 py-1.5 text-sm rounded-md bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleRefresh(dir)}
                        disabled={refreshingId !== null || clearingId !== null}
                        className="px-3 py-1.5 text-sm rounded-md bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 disabled:opacity-50 transition-colors"
                      >
                        {refreshingId === dir.id ? 'Refreshing...' : 'Refresh'}
                      </button>
                      <button
                        onClick={() => handleClear(dir)}
                        disabled={refreshingId !== null || clearingId !== null}
                        className="px-3 py-1.5 text-sm rounded-md text-red-500 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
