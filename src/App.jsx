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
import ResetPassword from './pages/ResetPassword'
import Schedule from './pages/Schedule'

function Gate() {
  const { session, loading } = useAuth()
  if (loading) return <div className="screen"><Loader label="Loading the park…" /></div>

  if (window.location.pathname === '/reset-password') return <ResetPassword />

  if (!session) return <Auth />

  return (
    <Routes>
      <Route path="/" elemen
