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
    </div>
  )
}
