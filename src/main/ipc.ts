import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { getDb } from './db'
import { readdirSync, statSync } from 'fs'
import { join, basename, extname } from 'path'

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

function scanComicDir(db: ReturnType<typeof getDb>, comicDir: string, parsed: { name: string; author: string }, hidden: boolean = false): 'imported' | 'updated' {
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
    db.prepare('UPDATE comic SET name = ?, author = ?, image_path = ?, directory = ?, is_hidden = ? WHERE id = ?').run(
      parsed.name,
      parsed.author,
      imagePath,
      comicDir,
      hidden ? 1 : 0,
      existing.id
    )
    comicId = existing.id
    result = 'updated'
  } else {
    const ins = db
      .prepare('INSERT INTO comic (name, author, image_path, directory, is_hidden) VALUES (?, ?, ?, ?, ?)')
      .run(parsed.name, parsed.author, imagePath, comicDir, hidden ? 1 : 0)
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

function importDirectory(rootDir: string, hidden: boolean = false): { imported: number; updated: number } {
  const db = getDb()
  let imported = 0
  let updated = 0

  const entries = readdirSync(rootDir, { withFileTypes: true })

  const transaction = db.transaction(() => {
    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const parsed = parseComicFolder(entry.name)
      if (!parsed) continue

      const result = scanComicDir(db, join(rootDir, entry.name), parsed, hidden)
      if (result === 'imported') imported++
      else updated++
    }
  })

  transaction()

  // Track the import directory
  db.prepare(
    'INSERT INTO import_directory (path, hidden) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET hidden = excluded.hidden'
  ).run(rootDir, hidden ? 1 : 0)

  return { imported, updated }
}

function refreshComic(comicId: number): boolean {
  const db = getDb()

  const comic = db.prepare('SELECT id, directory, is_hidden FROM comic WHERE id = ?').get(comicId) as
    | { id: number; directory: string; is_hidden: number }
    | undefined
  if (!comic) return false

  const parsed = parseComicFolder(basename(comic.directory))
  if (!parsed) return false

  const transaction = db.transaction(() => {
    scanComicDir(db, comic.directory, parsed, comic.is_hidden === 1)
  })

  transaction()
  return true
}

export function clearComics(): void {
  const db = getDb()
  db.exec('DELETE FROM comic')
  db.exec('DELETE FROM import_directory')
}

export function getImportDirectories(): Array<{ id: number; path: string; hidden: number }> {
  const db = getDb()
  return db.prepare('SELECT id, path, hidden FROM import_directory ORDER BY path ASC').all() as Array<{
    id: number
    path: string
    hidden: number
  }>
}

export function refreshImportDirectory(id: number): { imported: number; updated: number } | null {
  const db = getDb()
  const row = db.prepare('SELECT path, hidden FROM import_directory WHERE id = ?').get(id) as
    | { path: string; hidden: number }
    | undefined
  if (!row) return null
  return importDirectory(row.path, row.hidden === 1)
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

export async function triggerImport(
  win: BrowserWindow
): Promise<{ imported: number; updated: number } | null> {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Select Comics Directory'
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  const hiddenResult = await dialog.showMessageBox(win, {
    type: 'question',
    buttons: ['Import', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    title: 'Import Comics',
    message: 'Select import options',
    checkboxLabel: 'Import as hidden content',
    checkboxChecked: false
  })

  if (hiddenResult.response === 1) {
    return null
  }

  return importDirectory(result.filePaths[0], hiddenResult.checkboxChecked)
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
  ipcMain.handle('import-comics', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { imported: 0, updated: 0 }
    event.sender.send('import-started')
    try {
      return await triggerImport(win)
    } finally {
      event.sender.send('import-finished')
    }
  })

  ipcMain.handle(
    'get-comics',
    (_event, page: number, search: string, pageSize: number = 20, hiddenFilter: 'hide' | 'include' | 'only' = 'hide') => {
      const db = getDb()
      const offset = (page - 1) * pageSize

      const conditions: string[] = []
      const params: unknown[] = []

      if (search) {
        conditions.push('(name LIKE ? OR author LIKE ?)')
        const term = `%${search}%`
        params.push(term, term)
      }

      if (hiddenFilter === 'hide') {
        conditions.push('is_hidden = 0')
      } else if (hiddenFilter === 'only') {
        conditions.push('is_hidden = 1')
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

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
}
