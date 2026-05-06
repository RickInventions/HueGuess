import { Link, useLocation } from 'react-router-dom'
import { Palette, LogOut, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/Button'

export function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()

  return (
    <nav className="sticky top-0 z-50 bg-base/80 backdrop-blur-md border-b border-border">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 no-drag">
          <Palette className="w-6 h-6 text-primary" />
          <span className="font-heading font-semibold text-lg text-deep">
            HueGuess
          </span>
        </Link>

        <div className="flex items-center gap-3">
{!user && (
  <>
    <Link to="/login">
      <Button variant="ghost">Log in</Button>
    </Link>
    <Link to="/register">
      <Button variant="primary">Sign up</Button>
    </Link>
  </>
)}
        </div>
      </div>
    </nav>
  )
}