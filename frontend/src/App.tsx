import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { soundService } from './services/soundService';
import { useLatestBuild } from './hooks/useLatestBuild';
import { useEffect } from 'react';
import {Navbar} from './components/layout/Navbar';
import Home from './pages/Home';
import Game from './pages/Game';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import Profile from './pages/Profile';
import Daily from './pages/Daily'
import Leaderboard from './pages/Leaderboard';
import Achievements from './pages/Achievements';
import FAQ from './pages/FAQ'
import Support from './pages/Support'
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';
import Challenge from './pages/Challenge';
import Room from './pages/Room';
import ModeGame from './pages/ModeGame';
import ResetPassword from './pages/ResetPassword';

function App() {
  const { isAuthenticated, isLoading, isVerified } = useAuth();

  // Pick up a deploy without waiting for the tab to be closed — a room only
  // works when everyone in it is running the same client.
  useLatestBuild();

  // Initialize sound on first user interaction
  useEffect(() => {
    const initSound = () => {
      soundService.initialize();
      document.removeEventListener('click', initSound);
      document.removeEventListener('keydown', initSound);
    };
    
    document.addEventListener('click', initSound);
    document.addEventListener('keydown', initSound);
    
    return () => {
      document.removeEventListener('click', initSound);
      document.removeEventListener('keydown', initSound);
    };
  }, []);

  // Don't render anything while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main>
        <Routes>
          {/* Public routes - always accessible */}
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Game />} />
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" />} />
          <Route path="/verify" element={<VerifyEmail />} />
          <Route path="/verify-success" element={<VerifyEmail />} />
          <Route path="/verify-error" element={<VerifyEmail />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/support" element={<Support />} />
          <Route path="/admin/*" element={<Admin />} />
          {/* Protected routes - require authentication */}
          <Route 
            path="/profile" 
            element={isAuthenticated ? <Profile /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/profile/:username" 
            element={<Profile />} 
          />
          <Route 
            path="/daily" 
            element={isAuthenticated && isVerified ? <Daily /> : <Navigate to={isAuthenticated ? "/verify" : "/login"} />} 
          />
          <Route
            path="/challenge"
            element={isAuthenticated && isVerified ? <Challenge /> : <Navigate to={isAuthenticated ? "/verify" : "/login"} />}
          />
          <Route
            path="/room/:code"
            element={isAuthenticated && isVerified ? <Room /> : <Navigate to={isAuthenticated ? "/verify" : "/login"} />}
          />
          {/* Inverted and Blind. Signed in only — a round has to be attributable
              to put a percentage on their boards. */}
          <Route
            path="/modes/inverted"
            element={isAuthenticated && isVerified ? <ModeGame family="inverted" /> : <Navigate to={isAuthenticated ? "/verify" : "/login"} />}
          />
          <Route
            path="/modes/blind"
            element={isAuthenticated && isVerified ? <ModeGame family="blind" /> : <Navigate to={isAuthenticated ? "/verify" : "/login"} />}
          />
          <Route path="/*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}

export default App;