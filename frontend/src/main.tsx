import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import App from './App'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { AdminProvider } from './context/AdminContext'
import { SocketProvider } from './context/SocketContext'
import { MultiplayerProvider } from './context/MultiplayerContext'
import { FriendsProvider } from './context/FriendsContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AdminProvider>
          <SocketProvider>
            <MultiplayerProvider>
              {/* Inside MultiplayerProvider: accepting a room invite goes through
                  the same join path as entering a code by hand. */}
              <FriendsProvider>
                <App />
                <Toaster
                  position="bottom-center"
                  toastOptions={{
                    style: {
                      background: '#1D1D1F',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '14px',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                    },
                  }}
                />
              </FriendsProvider>
            </MultiplayerProvider>
          </SocketProvider>
        </AdminProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)