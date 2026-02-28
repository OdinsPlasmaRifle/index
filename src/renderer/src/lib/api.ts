import type { ComicsPage, ComicWithVolumes, VolumeWithChapters } from '../types'

declare global {
  interface Window {
    api: {
      importComics(): Promise<{ imported: number; updated: number } | null>
      onComicsUpdated(callback: () => void): () => void
      onImportStarted(callback: () => void): () => void
      onImportFinished(callback: () => void): () => void
      getComics(page: number, search: string, pageSize?: number, hiddenFilter?: 'hide' | 'include' | 'only'): Promise<ComicsPage>
      getComic(id: number): Promise<ComicWithVolumes | null>
      getVolume(id: number): Promise<VolumeWithChapters | null>
      refreshComic(id: number): Promise<boolean>
      toggleFavorite(id: number): Promise<boolean | null>
      openFile(filePath: string): Promise<{ success?: boolean; error?: string }>
      onHiddenContentToggled(callback: (enabled: boolean) => void): () => void
      getHiddenContentEnabled(): Promise<boolean>
      getImportDirectories(): Promise<Array<{ id: number; path: string; hidden: number }>>
      refreshImportDirectory(id: number): Promise<{ imported: number; updated: number } | null>
      clearImportDirectory(id: number): Promise<boolean>
      onNavigateSettings(callback: () => void): () => void
    }
  }
}

export const api = window.api
