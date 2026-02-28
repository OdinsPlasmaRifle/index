import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import type { Comic } from '../types'
import ComicCard from '../components/ComicCard'
import SearchBar from '../components/SearchBar'
import Pagination from '../components/Pagination'

const PAGE_SIZE = 20

let savedHiddenFilter: 'hide' | 'include' | 'only' = 'hide'

export default function HomePage(): React.JSX.Element {
  const [comics, setComics] = useState<Comic[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [hiddenEnabled, setHiddenEnabled] = useState(false)
  const [hiddenFilter, setHiddenFilter] = useState<'hide' | 'include' | 'only'>(savedHiddenFilter)

  useEffect(() => {
    api.getHiddenContentEnabled().then(setHiddenEnabled)
  }, [])

  useEffect(() => {
    return api.onHiddenContentToggled((enabled) => {
      setHiddenEnabled(enabled)
      setPage(1)
    })
  }, [])

  useEffect(() => {
    savedHiddenFilter = hiddenFilter
  }, [hiddenFilter])

  const activeHiddenFilter = hiddenEnabled ? hiddenFilter : 'hide' as const

  const loadComics = useCallback(async () => {
    const result = await api.getComics(page, search, PAGE_SIZE, activeHiddenFilter)
    setComics(result.comics)
    setTotal(result.total)
  }, [page, search, activeHiddenFilter])

  useEffect(() => {
    loadComics()
  }, [loadComics])

  useEffect(() => {
    return api.onComicsUpdated(() => {
      setPage(1)
      loadComics()
    })
  }, [loadComics])

  const handleFavoriteToggle = useCallback((id: number, favorite: boolean) => {
    setComics((prev) =>
      prev.map((c) => (c.id === id ? { ...c, favorite: favorite ? 1 : 0 } : c))
    )
  }, [])

  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    setPage(1)
  }, [])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const filterButton = (value: 'hide' | 'include' | 'only', label: string): React.JSX.Element => (
    <button
      onClick={() => { setHiddenFilter(value); setPage(1) }}
      className={`px-3 py-1 text-sm rounded border transition-colors ${hiddenFilter === value ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]' : 'border-[var(--border)] hover:bg-[var(--secondary)]'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-center mb-6">
          <SearchBar value={search} onChange={handleSearch} />
        </div>

        {hiddenEnabled && (
          <div className="flex gap-2 mb-4 justify-center">
            {filterButton('hide', 'Exclude hidden')}
            {filterButton('include', 'Include hidden')}
            {filterButton('only', 'Only hidden')}
          </div>
        )}

        {comics.length === 0 ? (
          <div className="text-center py-20 text-[var(--muted-foreground)]">
            {search ? 'No comics found matching your search.' : 'No comics yet. Use File \u2192 Import Comics to get started.'}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {comics.map((comic) => (
                <ComicCard key={comic.id} comic={comic} onFavoriteToggle={handleFavoriteToggle} />
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
