import { app, BrowserWindow, Menu, dialog, protocol, net } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { initDb } from './db'
import { registerIpcHandlers, triggerImport, clearComics, getHiddenContentEnabled, setHiddenContentEnabled } from './ipc'
import { pathToFileURL } from 'url'

function buildMenu(): void {
  const isMac = process.platform === 'darwin'
  const hiddenEnabled = getHiddenContentEnabled()

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Import Comics...',
          accelerator: 'CmdOrCtrl+I',
          click: async (): Promise<void> => {
            const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
            if (!win) return
            win.webContents.send('import-started')
            try {
              const result = await triggerImport(win)
              if (result) {
                win.webContents.send('comics-updated')
              }
            } finally {
              win.webContents.send('import-finished')
            }
          }
        },
        {
          label: 'Clear Comics...',
          click: async (): Promise<void> => {
            const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
            if (!win) return
            const result = await dialog.showMessageBox(win, {
              type: 'warning',
              buttons: ['Clear All', 'Cancel'],
              defaultId: 1,
              cancelId: 1,
              title: 'Clear Comics',
              message: 'Are you sure you want to clear all comics?',
              detail: 'All imported comics and their associated data (volumes, chapters) will be permanently removed. This cannot be undone.'
            })
            if (result.response === 0) {
              clearComics()
              win.webContents.send('comics-updated')
            }
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Preferences',
      submenu: [
        {
          label: 'Settings...',
          click: (): void => {
            const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
            if (win) {
              win.webContents.send('navigate-settings')
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Enable hidden content',
          type: 'checkbox',
          checked: hiddenEnabled,
          click: (menuItem): void => {
            setHiddenContentEnabled(menuItem.checked)
            const windows = BrowserWindow.getAllWindows()
            for (const w of windows) {
              w.webContents.send('hidden-content-toggled', menuItem.checked)
            }
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ]

  if (is.dev) {
    const viewMenu = template.find((t) => t.label === 'View')
    if (viewMenu && Array.isArray(viewMenu.submenu)) {
      viewMenu.submenu.push({ type: 'separator' }, { role: 'toggleDevTools' })
    }
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Comic Index',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } }
])

app.whenReady().then(() => {
  protocol.handle('local-file', (request) => {
    const url = new URL(request.url)
    const filePath = decodeURIComponent(url.pathname)
    // On Windows, pathname starts with /C:/... — strip the leading slash
    const normalizedPath = process.platform === 'win32' ? filePath.replace(/^\//, '') : filePath
    return net.fetch(pathToFileURL(normalizedPath).toString())
  })

  initDb()
  registerIpcHandlers()
  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
