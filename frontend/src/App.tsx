/**
 * App.tsx — React Router setup.
 *
 * Routes:
 *   /         → redirect to /login
 *   /login    → LoginPage (public)
 *   /register → RegisterPage (public)
 *   /chat     → InvestigatorPage (auth-guarded)
 *   *         → redirect to /login
 *
 * Validates: Requirement 9.9
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import InvestigatorPage from './pages/InvestigatorPage'
import AuthGuard from './components/AuthGuard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root redirects to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected investigation page */}
        <Route
          path="/chat"
          element={
            <AuthGuard>
              <InvestigatorPage />
            </AuthGuard>
          }
        />

        {/* Catch-all: back to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
