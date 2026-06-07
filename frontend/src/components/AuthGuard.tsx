/**
 * AuthGuard.tsx — Route guard that redirects unauthenticated users to /login.
 *
 * Validates: Requirement 9.9
 */

import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'

interface AuthGuardProps {
  children: ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const token = localStorage.getItem('token')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
