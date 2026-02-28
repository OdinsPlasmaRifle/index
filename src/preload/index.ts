import { contextBridge, ipcRenderer } from 'electron'

const api = {
  importComics: (): Promise<{ imported: number; updated: number } | null> =>
    ipcRenderer.invoke('import-comics'),

  onComicsUpdated: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('comics-updated', handler)
    return () => ipcRenderer.removeListener('comics-updated', handler)
  },

  onImportStarted: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('import-started', handler)
    return () => ipcRenderer.removeListener('import-started', handler)
  },

  onImportFinished: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('import-finished', handler)
    return () => ipcRenderer.removeListener('import-finished', handler)
  },

  getComics: (
    page: number,
    search: string,
    pageSize?: number,
    hiddenFilter: 'hide' | 'include' | 'only' = 'hide'
  ): Promise<{
    comics: Array<{
      id: number
      name: string
      author: string
      image_path: string | null
      directory: string
      favorite: number
      is_hidden: number
    }>
    total: number
    page: number
    pageSize: number
  }> => ipcRenderer.invoke('get-comics', page, search, pageSize, hiddenFilter),

  onHiddenContentToggled: (callback: (enabled: boolean) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, enabled: boolean): void => callback(enabled)
    ipcRenderer.on('hidden-content-toggled', handler)
    return () => ipcRenderer.removeListener('hidden-content-toggled', handler)
  },

  getHiddenContentEnabled: (): Promise<boolean> =>
    ipcRenderer.invoke('get-hidden-content-enabled'),

  getComic: (
    id: number
  ): Promise<{
    id: number
    name: string
    author: string
    image_path: string | null
    directory: string
    favorite: number
    volumes: Array<{
      id: number
      comic_id: number
      number: number
      directory: string
      file: string | null
      chapters: Array<{
        id: number
        volume_id: number
        number: number
        type: 'chapter' | 'extra'
        file: string
      }>
    }>
  } | null> => ipcRenderer.invoke('get-comic', id),

  getVolume: (
    id: number
  ): Promise<{
    id: number
    comic_id: number
    number: number
    directory: string
    file: string | null
    chapters: Array<{
      id: number
      volume_id: number
      number: number
      type: 'chapter' | 'extra'
      file: string
    }>
  } | null> => ipcRenderer.invoke('get-volume', id),

  refreshComic: (id: number): Promise<boolean> =>
    ipcRenderer.invoke('refresh-comic', id),

  toggleFavorite: (id: number): Promise<boolean | null> =>
    ipcRenderer.invoke('toggle-favorite', id),

  openFile: (filePath: string): Promise<{ success?: boolean; error?: string }> =>
    ipcRenderer.invoke('open-file', filePath),

  getImportDirectories: (): Promise<Array<{ id: number; path: string; hidden: number }>> =>
    ipcRenderer.invoke('get-import-directories'),

  refreshImportDirectory: (id: number): Promise<{ imported: number; updated: number } | null> =>
    ipcRenderer.invoke('refresh-import-directory', id),

  clearImportDirectory: (id: number): Promise<boolean> =>
    ipcRenderer.invoke('clear-import-directory', id),

  onNavigateSettings: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('navigate-settings', handler)
    return () => ipcRenderer.removeListener('navigate-settings', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
