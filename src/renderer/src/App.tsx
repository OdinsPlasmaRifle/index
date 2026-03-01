import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { api } from './lib/api'
import { showStatus } from './components/StatusToast'
import StatusToast from './components/StatusToast'
import LibrariesPage from './pages/LibrariesPage'
import LibraryComicsPage from './pages/LibraryComicsPage'
import AddLibraryPage from './pages/AddLibraryPage'
import EditLibraryPage from './pages/EditLibraryPage'
import ComicDetailPage from './pages/ComicDetailPage'
import VolumePage from './pages/VolumePage'
import SettingsPage from './pages/SettingsPage'
import LibrarySelectModal from './components/LibrarySelectModal'

function useImportStatus(): void {
  useEffect(() => {
    let dismiss: (() => void) | null = null
    const unsubStart = api.onImportStarted(() => {
      dismiss = showStatus('Importing...')
    })
    const unsubEnd = api.onImportFinished(() => {
      dismiss?.()
      dismiss = null
    })
    return () => {
      unsubStart()
      unsubEnd()
      dismiss?.()
    }
  }, [])
}

function NavigateSettingsListener(): React.JSX.Element | null {
  const navigate = useNavigate()
  useEffect(() => {
    return api.onNavigateSettings(() => {
      navigate('/settings')
    })
  }, [navigate])
  return null
}

function NavigateAddLibraryListener(): React.JSX.Element | null {
  const navigate = useNavigate()
  useEffect(() => {
    return api.onNavigateAddLibrary(() => {
      navigate('/library/new')
    })
  }, [navigate])
  return null
}

function NavigateImportListener(): React.JSX.Element | null {
  const location = useLocation()
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    return api.onNavigateImport(() => {
      setShowModal(true)
    })
  }, [])

  if (!showModal) return null

  // Auto-detect current library from URL
  const libraryMatch = location.pathname.match(/^\/library\/(\d+)/)
  const defaultLibraryId = libraryMatch ? parseInt(libraryMatch[1], 10) : undefined

  return (
    <LibrarySelectModal
      defaultLibraryId={defaultLibraryId}
      onSelect={async (libraryId) => {
        setShowModal(false)
        const result = await api.importComics(libraryId)
        if (result) {
          const dismiss = showStatus(`Imported ${result.imported}, updated ${result.updated}`)
          setTimeout(dismiss, 3000)
        }
      }}
      onCancel={() => setShowModal(false)}
    />
  )
}

export default function App(): React.JSX.Element {
  useImportStatus()

  return (
    <HashRouter>
      <NavigateSettingsListener />
      <NavigateAddLibraryListener />
      <NavigateImportListener />
      <Routes>
        <Route path="/" element={<LibrariesPage />} />
        <Route path="/library/new" element={<AddLibraryPage />} />
        <Route path="/library/:id" element={<LibraryComicsPage />} />
        <Route path="/library/:id/edit" element={<EditLibraryPage />} />
        <Route path="/comic/:id" element={<ComicDetailPage />} />
        <Route path="/volume/:id" element={<VolumePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      <StatusToast />
    </HashRouter>
  )
}
