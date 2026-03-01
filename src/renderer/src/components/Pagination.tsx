interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export default function Pagination({
  page,
  totalPages,
  onPageChange
}: PaginationProps): React.JSX.Element | null {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        onClick={() => onPageChange(1)}
        disabled={page <= 1}
        className="px-2 py-1 rounded border border-[var(--border)] text-sm disabled:opacity-40 hover:bg-[var(--secondary)] transition-colors"
        title="First page"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
        </svg>
      </button>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1 rounded border border-[var(--border)] text-sm disabled:opacity-40 hover:bg-[var(--secondary)] transition-colors"
      >
        Previous
      </button>
      <span className="text-sm text-[var(--muted-foreground)]">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1 rounded border border-[var(--border)] text-sm disabled:opacity-40 hover:bg-[var(--secondary)] transition-colors"
      >
        Next
      </button>
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={page >= totalPages}
        className="px-2 py-1 rounded border border-[var(--border)] text-sm disabled:opacity-40 hover:bg-[var(--secondary)] transition-colors"
        title="Last page"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5m6-15l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    </div>
  )
}
