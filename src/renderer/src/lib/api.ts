import type { ComicsPage, ComicWithVolumes, VolumeWithChapters, LibraryWithCount } from '../types'

declare global {
  interface Window {
    api: {
      importComics(libraryId: number): Promise<{ imported: number; updated: number } | null>
      onComicsUpdated(callback: () => void): () => void
      onImportStarted(callback: () => void): () => void
      onImportFinished(callback: () => void): () => void
      getComics(libraryId: number, page: number, search: string, pageSize?: number, favoritesOnly?: boolean): Promise<ComicsPage>
      getRandomComic(libraryId: number): Promise<{ id: number } | null>
      getComic(id: number): Promise<ComicWithVolumes | null>
      getVolume(id: number): Promise<VolumeWithChapters | null>
      refreshComic(id: number): Promise<boolean>
      toggleFavorite(id: number): Promise<boolean | null>
      openFile(filePath: string): Promise<{ success?: boolean; error?: string }>
      onHiddenContentToggled(callback: (enabled: boolean) => void): () => void
      getHiddenContentEnabled(): Promise<boolean>
      setHiddenContentEnabled(enabled: boolean): Promise<void>
      getImportDirectories(): Promise<Array<{ id: number; path: string; library_id: number | null; library_name: string | null }>>
      refreshImportDirectory(id: number): Promise<{ imported: number; updated: number } | null>
      clearImportDirectory(id: number): Promise<boolean>
      onNavigateSettings(callback: () => void): () => void
      createLibrary(opts: { name: string; description?: string; mediaType?: string; imagePath?: string; isHidden?: boolean }): Promise<{ id: number }>
      pickLibraryImage(): Promise<string | null>
      getLibraries(search?: string, hiddenFilter?: 'hide' | 'include' | 'only'): Promise<LibraryWithCount[]>
      getLibrary(id: number): Promise<LibraryWithCount | null>
      updateLibrary(id: number, opts: { name?: string; description?: string; imagePath?: string | null; isHidden?: boolean }): Promise<boolean>
      deleteLibrary(id: number): Promise<boolean>
      onNavigateAddLibrary(callback: () => void): () => void
      onNavigateImport(callback: () => void): () => void
      clearAllData(): Promise<void>
    }
  }
}

export const api = window.api

export function localFileUrl(filePath: string): string {
  return 'local-file:///' + encodeURIComponent(filePath).replace(/%2F/g, '/').replace(/%5C/g, '/')
}
