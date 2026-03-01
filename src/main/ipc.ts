import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { getDb } from './db'
import { readdirSync, statSync } from 'fs'
import { join, basename, extname } from 'path'

let onMenuRebuild: (() => void) | null = null
export function setMenuRebuildCallback(cb: () => void): void {
  onMenuRebuild = cb
}

function parseComicFolder(name: string): { name: string; author: string } | null {
  const match = name.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (!match) return null
  return { name: match[1].trim(), author: match[2].trim() }
}

function parseVolumeNumber(name: string): number | null {
  const match = name.match(/Vol\.\s*(\d+)/i)
  return match ? parseInt(match[1], 10) : null
}

function parseChapterNumber(name: string): { number: number; type: 'chapter' | 'extra' } | null {
  const extraMatch = name.match(/Extra\s*(\d+)/i)
  if (extraMatch) return { number: parseInt(extraMatch[1], 10), type: 'extra' }

  const chMatch = name.match(/Ch\.\s*(\d+)/i)
  if (chMatch) return { number: parseInt(chMatch[1], 10), type: 'chapter' }

  return null
}

function isImageFile(name: string): boolean {
  const ext = extname(name).toLowerCase()
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)
}

function scanComicDir(db: ReturnType<typeof getDb>, comicDir: string, parsed: { name: string; author: string }, libraryId: number): 'imported' | 'updated' {
  // Find icon/cover image
  let imagePath: string | null = null
  const comicFiles = readdirSync(comicDir, { withFileTypes: true })
  for (const f of comicFiles) {
    if (f.isFile() && isImageFile(f.name)) {
      // Prefer files with 'icon' or 'cover' in the name, otherwise use first image
      if (f.name.toLowerCase().includes('icon') || f.name.toLowerCase().includes('cover')) {
        imagePath = join(comicDir, f.name)
        break
      }
      if (!imagePath) {
        imagePath = join(comicDir, f.name)
      }
    }
  }

  // Upsert comic: match by directory first, then by name+author to prevent duplicates
  const existing = (
    db.prepare('SELECT id FROM comic WHERE directory = ?').get(comicDir) ??
    db.prepare('SELECT id FROM comic WHERE name = ? AND author = ?').get(parsed.name, parsed.author)
  ) as { id: number } | undefined

  let comicId: number
  let result: 'imported' | 'updated'
  if (existing) {
    db.prepare('UPDATE comic SET name = ?, author = ?, image_path = ?, directory = ?, library_id = ? WHERE id = ?').run(
      parsed.name,
      parsed.author,
      imagePath,
      comicDir,
      libraryId,
      existing.id
    )
    comicId = existing.id
    result = 'updated'
  } else {
    const ins = db
      .prepare('INSERT INTO comic (name, author, image_path, directory, library_id) VALUES (?, ?, ?, ?, ?)')
      .run(parsed.name, parsed.author, imagePath, comicDir, libraryId)
    comicId = ins.lastInsertRowid as number
    result = 'imported'
  }

  // Process volumes
  for (const volEntry of comicFiles) {
    if (!volEntry.isDirectory()) continue
    const volNum = parseVolumeNumber(volEntry.name)
    if (volNum === null) continue

    const volDir = join(comicDir, volEntry.name)

    // Find volume cbz file
    let volumeFile: string | null = null
    const volFiles = readdirSync(volDir, { withFileTypes: true })
    for (const f of volFiles) {
      if (
        f.isFile() &&
        f.name.endsWith('.cbz') &&
        /Vol\.\s*\d+/i.test(f.name) &&
        !/Ch\./i.test(f.name) &&
        !/Extra/i.test(f.name)
      ) {
        volumeFile = join(volDir, f.name)
        break
      }
    }

    // Upsert volume
    const existingVol = db
      .prepare('SELECT id FROM volume WHERE comic_id = ? AND number = ?')
      .get(comicId, volNum) as { id: number } | undefined

    let volumeId: number
    if (existingVol) {
      db.prepare('UPDATE volume SET directory = ?, file = ? WHERE id = ?').run(
        volDir,
        volumeFile,
        existingVol.id
      )
      volumeId = existingVol.id
      // Delete old chapters to re-import
      db.prepare('DELETE FROM chapter WHERE volume_id = ?').run(volumeId)
    } else {
      const ins = db
        .prepare('INSERT INTO volume (comic_id, number, directory, file) VALUES (?, ?, ?, ?)')
        .run(comicId, volNum, volDir, volumeFile)
      volumeId = ins.lastInsertRowid as number
    }

    // Process chapters and extras
    for (const f of volFiles) {
      if (!f.isFile() || !f.name.endsWith('.cbz')) continue
      // Skip the volume file itself
      if (volumeFile && join(volDir, f.name) === volumeFile) continue

      const chapterInfo = parseChapterNumber(f.name)
      if (!chapterInfo) continue

      db.prepare('INSERT OR REPLACE INTO chapter (volume_id, number, type, file) VALUES (?, ?, ?, ?)').run(
        volumeId,
        chapterInfo.number,
        chapterInfo.type,
        join(volDir, f.name)
      )
    }
  }

  return result
}

function importDirectory(rootDir: string, libraryId: number): { imported: number; updated: number } {
  const db = getDb()
  let imported = 0
  let updated = 0

  const entries = readdirSync(rootDir, { withFileTypes: true })

  const transaction = db.transaction(() => {
    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const parsed = parseComicFolder(entry.name)
      if (!parsed) continue

      const result = scanComicDir(db, join(rootDir, entry.name), parsed, libraryId)
      if (result === 'imported') imported++
      else updated++
    }
  })

  transaction()

  // Track the import directory
  db.prepare(
    'INSERT INTO import_directory (path, library_id) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET library_id = excluded.library_id'
  ).run(rootDir, libraryId)

  return { imported, updated }
}

function refreshComic(comicId: number): boolean {
  const db = getDb()

  const comic = db.prepare('SELECT id, directory, library_id FROM comic WHERE id = ?').get(comicId) as
    | { id: number; directory: string; library_id: number }
    | undefined
  if (!comic) return false

  const parsed = parseComicFolder(basename(comic.directory))
  if (!parsed) return false

  const transaction = db.transaction(() => {
    scanComicDir(db, comic.directory, parsed, comic.library_id)
  })

  transaction()
  return true
}

export function clearAllData(): void {
  const db = getDb()
  db.exec('DELETE FROM chapter')
  db.exec('DELETE FROM volume')
  db.exec('DELETE FROM comic')
  db.exec('DELETE FROM import_directory')
  db.exec('DELETE FROM library')
  db.exec("DELETE FROM settings")
}

export function getImportDirectories(): Array<{ id: number; path: string; library_id: number | null; library_name: string | null }> {
  const db = getDb()
  return db.prepare(
    'SELECT d.id, d.path, d.library_id, l.name as library_name FROM import_directory d LEFT JOIN library l ON d.library_id = l.id ORDER BY d.path ASC'
  ).all() as Array<{
    id: number
    path: string
    library_id: number | null
    library_name: string | null
  }>
}

export function refreshImportDirectory(id: number): { imported: number; updated: number } | null {
  const db = getDb()
  const row = db.prepare('SELECT path, library_id FROM import_directory WHERE id = ?').get(id) as
    | { path: string; library_id: number | null }
    | undefined
  if (!row || !row.library_id) return null
  return importDirectory(row.path, row.library_id)
}

export function clearImportDirectory(id: number): boolean {
  const db = getDb()
  const row = db.prepare('SELECT path FROM import_directory WHERE id = ?').get(id) as
    | { path: string }
    | undefined
  if (!row) return false

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM comic WHERE directory LIKE ?').run(row.path + '/%')
    db.prepare('DELETE FROM import_directory WHERE id = ?').run(id)
  })

  transaction()
  return true
}

export function createLibrary(opts: { name: string; description?: string; mediaType?: string; imagePath?: string; isHidden?: boolean }): { id: number } {
  const db = getDb()
  const ins = db.prepare(
    'INSERT INTO library (name, description, media_type, image_path, is_hidden) VALUES (?, ?, ?, ?, ?)'
  ).run(
    opts.name,
    opts.description ?? null,
    opts.mediaType ?? 'comics',
    opts.imagePath ?? null,
    opts.isHidden ? 1 : 0
  )
  return { id: ins.lastInsertRowid as number }
}

export function getLibraries(search?: string, hiddenFilter: 'hide' | 'include' | 'only' = 'hide'): Array<Record<string, unknown>> {
  const db = getDb()
  const conditions: string[] = []
  const params: unknown[] = []

  if (search) {
    conditions.push('l.name LIKE ?')
    params.push(`%${search}%`)
  }

  if (hiddenFilter === 'hide') {
    conditions.push('l.is_hidden = 0')
  } else if (hiddenFilter === 'only') {
    conditions.push('l.is_hidden = 1')
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

  return db.prepare(
    `SELECT l.*, COUNT(c.id) as comic_count FROM library l LEFT JOIN comic c ON c.library_id = l.id ${whereClause} GROUP BY l.id ORDER BY l.name ASC`
  ).all(...params) as Array<Record<string, unknown>>
}

export function getLibrary(id: number): Record<string, unknown> | null {
  const db = getDb()
  return (db.prepare('SELECT l.*, COUNT(c.id) as comic_count FROM library l LEFT JOIN comic c ON c.library_id = l.id WHERE l.id = ? GROUP BY l.id').get(id) as Record<string, unknown>) ?? null
}

export function updateLibrary(id: number, opts: { name?: string; description?: string; imagePath?: string | null; isHidden?: boolean }): boolean {
  const db = getDb()
  const sets: string[] = []
  const params: unknown[] = []

  if (opts.name !== undefined) {
    sets.push('name = ?')
    params.push(opts.name)
  }
  if (opts.description !== undefined) {
    sets.push('description = ?')
    params.push(opts.description || null)
  }
  if (opts.imagePath !== undefined) {
    sets.push('image_path = ?')
    params.push(opts.imagePath)
  }
  if (opts.isHidden !== undefined) {
    sets.push('is_hidden = ?')
    params.push(opts.isHidden ? 1 : 0)
  }

  if (sets.length === 0) return false

  params.push(id)
  const result = db.prepare(`UPDATE library SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  return result.changes > 0
}

export function deleteLibrary(id: number): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM library WHERE id = ?').run(id)
  return result.changes > 0
}

export async function pickLibraryImage(win: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    title: 'Select Library Image',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

export async function triggerImportToLibrary(
  win: BrowserWindow,
  libraryId: number
): Promise<{ imported: number; updated: number } | null> {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Select Comics Directory'
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return importDirectory(result.filePaths[0], libraryId)
}

export function getHiddenContentEnabled(): boolean {
  const db = getDb()
  const row = db.prepare("SELECT value FROM settings WHERE key = 'hidden_content_enabled'").get() as
    | { value: string }
    | undefined
  return row?.value === '1'
}

export function setHiddenContentEnabled(enabled: boolean): void {
  const db = getDb()
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('hidden_content_enabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(enabled ? '1' : '0')
}

export function registerIpcHandlers(): void {
  ipcMain.handle('import-comics', async (event, libraryId: number) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { imported: 0, updated: 0 }
    event.sender.send('import-started')
    try {
      const result = await triggerImportToLibrary(win, libraryId)
      if (result) {
        event.sender.send('comics-updated')
      }
      return result
    } finally {
      event.sender.send('import-finished')
    }
  })

  ipcMain.handle(
    'get-comics',
    (_event, libraryId: number, page: number, search: string, pageSize: number = 20, favoritesOnly: boolean = false) => {
      const db = getDb()
      const offset = (page - 1) * pageSize

      const conditions: string[] = ['library_id = ?']
      const params: unknown[] = [libraryId]

      if (search) {
        conditions.push('(name LIKE ? OR author LIKE ?)')
        const term = `%${search}%`
        params.push(term, term)
      }

      if (favoritesOnly) {
        conditions.push('favorite = 1')
      }

      const whereClause = 'WHERE ' + conditions.join(' AND ')

      const countRow = db
        .prepare(`SELECT COUNT(*) as total FROM comic ${whereClause}`)
        .get(...params) as { total: number }

      params.push(pageSize, offset)
      const comics = db
        .prepare(`SELECT * FROM comic ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`)
        .all(...params)

      return { comics, total: countRow.total, page, pageSize }
    }
  )

  ipcMain.handle('get-random-comic', (_event, libraryId: number) => {
    const db = getDb()
    return db.prepare('SELECT id FROM comic WHERE library_id = ? ORDER BY RANDOM() LIMIT 1').get(libraryId) as { id: number } | undefined ?? null
  })

  ipcMain.handle('get-comic', (_event, id: number) => {
    const db = getDb()
    const comic = db.prepare('SELECT * FROM comic WHERE id = ?').get(id)
    if (!comic) return null

    const volumes = db
      .prepare('SELECT * FROM volume WHERE comic_id = ? ORDER BY number ASC')
      .all(id) as Array<Record<string, unknown>>

    const volumesWithChapters = volumes.map((vol) => {
      const chapters = db
        .prepare('SELECT * FROM chapter WHERE volume_id = ? ORDER BY type ASC, number ASC')
        .all(vol.id)
      return { ...vol, chapters }
    })

    return { ...comic, volumes: volumesWithChapters }
  })

  ipcMain.handle('get-volume', (_event, id: number) => {
    const db = getDb()
    const volume = db.prepare('SELECT * FROM volume WHERE id = ?').get(id)
    if (!volume) return null

    const chapters = db
      .prepare(
        "SELECT * FROM chapter WHERE volume_id = ? ORDER BY type ASC, number ASC"
      )
      .all(id)

    return { ...volume, chapters }
  })

  ipcMain.handle('refresh-comic', (_event, id: number) => {
    return refreshComic(id)
  })

  ipcMain.handle('toggle-favorite', (_event, id: number) => {
    const db = getDb()
    const comic = db.prepare('SELECT favorite FROM comic WHERE id = ?').get(id) as
      | { favorite: number }
      | undefined
    if (!comic) return null
    const newValue = comic.favorite ? 0 : 1
    db.prepare('UPDATE comic SET favorite = ? WHERE id = ?').run(newValue, id)
    return newValue === 1
  })

  ipcMain.handle('open-file', async (_event, filePath: string) => {
    const result = await shell.openPath(filePath)
    if (result) {
      return { error: result }
    }
    return { success: true }
  })

  ipcMain.handle('get-hidden-content-enabled', () => {
    return getHiddenContentEnabled()
  })

  ipcMain.handle('set-hidden-content-enabled', (_event, enabled: boolean) => {
    setHiddenContentEnabled(enabled)
    const windows = BrowserWindow.getAllWindows()
    for (const w of windows) {
      w.webContents.send('hidden-content-toggled', enabled)
    }
    if (onMenuRebuild) onMenuRebuild()
  })

  ipcMain.handle('get-import-directories', () => {
    return getImportDirectories()
  })

  ipcMain.handle('refresh-import-directory', (event, id: number) => {
    const result = refreshImportDirectory(id)
    if (result) {
      event.sender.send('comics-updated')
    }
    return result
  })

  ipcMain.handle('clear-import-directory', (event, id: number) => {
    const result = clearImportDirectory(id)
    if (result) {
      event.sender.send('comics-updated')
    }
    return result
  })

  // Library handlers
  ipcMain.handle('create-library', (_event, opts: { name: string; description?: string; mediaType?: string; imagePath?: string; isHidden?: boolean }) => {
    return createLibrary(opts)
  })

  ipcMain.handle('pick-library-image', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    return pickLibraryImage(win)
  })

  ipcMain.handle('get-libraries', (_event, search?: string, hiddenFilter?: 'hide' | 'include' | 'only') => {
    return getLibraries(search, hiddenFilter)
  })

  ipcMain.handle('get-library', (_event, id: number) => {
    return getLibrary(id)
  })

  ipcMain.handle('update-library', (_event, id: number, opts: { name?: string; description?: string; imagePath?: string | null; isHidden?: boolean }) => {
    return updateLibrary(id, opts)
  })

  ipcMain.handle('delete-library', (_event, id: number) => {
    return deleteLibrary(id)
  })

  ipcMain.handle('clear-all-data', (event) => {
    clearAllData()
    event.sender.send('comics-updated')
  })
}
