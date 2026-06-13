import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Loader } from './components/UI'
import Auth from './pages/Auth'
import Home from './pages/Home'
import Standings from './pages/Standings'
import Instructions from './pages/Instructions'
import Profile from './pages/Profile'
import Gallery from './pages/Gallery'
import Scavenger from './pages/Scavenger'
import Admin from './pages/Admin'

function Gate() {
  const { session, loading } = useAuth()
  if (loading) return <div className="screen"><Loader label="Loading the park…" /></div>
  if (!session) return <Auth />

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/standings" element={<Standings />} />
      <Route path="/instructions" element={<Instructions />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/gallery" element={<Gallery />} />
      <Route path="/scavenger" element={<Scavenger />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <>
      <div className="app-bg" />
      <BrowserRouter>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </BrowserRouter>
    </>
  )
}
