import { Link, useLocation } from 'react-router-dom'
import { Palette, LogOut, User, ShieldCheck, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/Button'
import { toast } from 'sonner'

export function Navbar() {
  const { user, logout, isVerified } = useAuth()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    toast.success('Logged out successfully')
  }

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
          {user ? (
            <>
              {/* Show verification warning if not verified */}
              {!isVerified && (
                <Link to="/verify">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-accent/10 text-accent text-xs">
                    <AlertCircle className="w-3 h-3" />
                    <span className="hidden sm:inline">Verify email</span>
                  </div>
                </Link>
              )}
              
              <Link to="/profile">
                <Button variant="ghost" icon={<User className="w-4 h-4" />}>
                  <span className="hidden sm:inline">{user.username}</span>
                  {!isVerified && (
                    <ShieldCheck className="w-3 h-3 text-accent ml-1" />
                  )}
                </Button>
              </Link>
            </>
          ) : (
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