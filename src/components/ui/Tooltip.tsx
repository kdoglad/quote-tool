import * as RadixTooltip from '@radix-ui/react-tooltip'
import { clsx } from 'clsx'

interface TooltipProps {
  children: React.ReactNode
  content: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  className?: string
  maxWidth?: string
}

export default function Tooltip({
  children,
  content,
  side = 'top',
  align = 'center',
  className,
  maxWidth = '280px',
}: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={300}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            align={align}
            sideOffset={6}
            style={{ maxWidth }}
            className={clsx(
              'z-50 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 shadow-xl',
              'data-[state=delayed-open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=delayed-open]:zoom-in-95',
              className
            )}
          >
            {content}
            <RadixTooltip.Arrow className="fill-slate-800" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  )
}
