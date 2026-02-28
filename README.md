# Index

Desktop application for indexing and browsing a local comic book collection. Built with Electron, React, and SQLite.

Import directories of comics organised by series folders (e.g. `Series Name (Author)/Vol. 1/Ch. 01.cbz`) and browse them with search, favorites, and volume/chapter drill-down. 

**NOTE: The diretcory and file structure is very strict in the current version of this project.**

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- npm (included with Node.js)
- Native build tools for compiling `better-sqlite3`:
  - **Windows:** `npm install -g windows-build-tools` or install Visual Studio Build Tools with the "Desktop development with C++" workload
  - **Linux:** `build-essential`, `python3`

## Development

Install dependencies:

```sh
npm install
```

This runs a `postinstall` step that rebuilds `better-sqlite3` for Electron automatically.

Start the app in development mode with hot reload:

```sh
npm run dev
```

Build the app (main, preload, and renderer) without packaging:

```sh
npm run build
```

Preview/launch the built app locally:

```sh
npm start
```

## Production

Packaging requires [electron-builder](https://www.electron.build/). Install it first:

```sh
npm install --save-dev electron-builder
```

### Windows

```sh
npm run package:win
```

Produces an NSIS installer (`.exe`) in the `dist/` directory. Cross-compiling from Linux requires [Wine](https://www.winehq.org/) to be installed.

### Linux

```sh
npm run package:linux
```

Produces an AppImage and `.deb` package in the `dist/` directory by default.

---

You can configure the output format, app icon, and other options in an `electron-builder.yml` or the `"build"` key in `package.json` — see the [electron-builder docs](https://www.electron.build/configuration) for details.
