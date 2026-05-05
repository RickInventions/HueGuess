import { Routes, Route } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Navbar } from './components/layout/Navbar'
import { BackgroundAmbience } from './components/layout/BackgroundAmbience'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import Stats from './pages/Stats'
import Leaderboard from './pages/Leaderboard'
import Profile from './pages/Profile'
import Game from './pages/Game'

export default function App() {
  const { isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      <BackgroundAmbience />
      <Navbar />
      <main className="pb-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify" element={<VerifyEmail />} />
          <Route path="/play" element={<Game />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>
    </>
  )
}