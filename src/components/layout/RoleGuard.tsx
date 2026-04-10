import { Navigate } from 'react-router-dom'
import type { UserRole } from '../../types/domain.types'
import { useAuthStore } from '../../stores/authStore'
import { isPreviewMode } from '../../lib/supabase'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  redirectTo?: string
}

export default function RoleGuard({ children, allowedRoles, redirectTo = '/' }: RoleGuardProps) {
  const role = useAuthStore((s) => s.role)
  const loading = useAuthStore((s) => s.loading)

  // Preview mode: allow access to everything (no real users)
  if (isPreviewMode) return <>{children}</>

  if (loading) return null

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
