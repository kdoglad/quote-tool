import { clsx } from 'clsx'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'draft'

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-slate-800 text-slate-300 border-slate-700',
  success: 'bg-green-900/40 text-green-300 border-green-800',
  warning: 'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  danger:  'bg-red-900/40 text-red-300 border-red-800',
  info:    'bg-blue-900/40 text-blue-300 border-blue-800',
  draft:   'bg-amber-900/40 text-amber-300 border-amber-800',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
