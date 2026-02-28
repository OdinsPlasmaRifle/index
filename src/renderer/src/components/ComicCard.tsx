import { Link } from 'react-router-dom'
import { api, localFileUrl } from '../lib/api'
import type { Comic } from '../types'

interface ComicCardProps {
  comic: Comic
  onFavoriteToggle: (id: number, favorite: boolean) => void
}

export default function ComicCard({ comic, onFavoriteToggle }: ComicCardProps): React.JSX.Element {
  const handleToggleFavorite = async (e: React.MouseEvent): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    const result = await api.toggleFavorite(comic.id)
    if (result !== null) {
      onFavoriteToggle(comic.id, result)
    }
  }

  return (
    <Link
      to={`/comic/${comic.id}`}
      className="block rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-hidden hover:shadow-lg transition-shadow"
    >
      <div className="aspect-[3/4] bg-[var(--muted)] flex items-center justify-center overflow-hidden relative">
        {comic.image_path ? (
          <img
            src={localFileUrl(comic.image_path)}
            alt={comic.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-4xl text-[var(--muted-foreground)]">
            {comic.name.charAt(0).toUpperCase()}
          </span>
        )}
        <button
          onClick={handleToggleFavorite}
          className="absolute bottom-2 right-2 w-9 h-9 flex items-center justify-center rounded-full bg-black border-2 border-black hover:opacity-80 transition-opacity"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill={comic.favorite ? 'white' : 'none'}
            stroke="white"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
        </button>
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm truncate text-[var(--card-foreground)]">
          {comic.name}
        </h3>
        <p className="text-xs text-[var(--muted-foreground)] truncate">{comic.author}</p>
      </div>
    </Link>
  )
}
