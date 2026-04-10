import { forwardRef } from 'react'
import { clsx } from 'clsx'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  prefix?: string
  suffix?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, prefix, suffix, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm text-slate-400 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefix && (
            <span className="absolute left-3 text-sm text-slate-500 pointer-events-none select-none">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              'w-full bg-slate-800 border rounded-lg text-sm text-white placeholder-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors',
              error ? 'border-red-600' : 'border-slate-700',
              prefix ? 'pl-7' : 'pl-3',
              suffix ? 'pr-10' : 'pr-3',
              'py-2',
              className
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 text-sm text-slate-500 pointer-events-none select-none">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
