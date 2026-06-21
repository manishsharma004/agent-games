import * as React from 'react'
import { cn } from '@/lib/utils'

interface ReasoningProps extends React.HTMLAttributes<HTMLDetailsElement> {
  content?: string | React.ReactNode
  isOpen?: boolean
  isStreaming?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

const Reasoning = React.forwardRef<HTMLDetailsElement, ReasoningProps>(
  (
    {
      className,
      content,
      isOpen = false,
      isStreaming = false,
      onOpenChange,
      children,
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(isOpen)

    // Auto-close when streaming ends
    React.useEffect(() => {
      if (!isStreaming && open) {
        // Optionally auto-close when streaming finishes
        // Uncomment to enable auto-close:
        // setOpen(false)
      }
    }, [isStreaming, open])

    const handleToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
      const newOpen = (e.currentTarget as HTMLDetailsElement).open
      setOpen(newOpen)
      onOpenChange?.(newOpen)
    }

    return (
      <details
        ref={ref}
        className={cn(
          'group rounded-lg border border-muted bg-muted/30 p-3 mb-3',
          className
        )}
        open={open}
        onToggle={handleToggle}
        {...props}
      >
        <summary className="cursor-pointer font-medium text-sm text-muted-foreground select-none flex items-center gap-2">
          <span className="transition-transform group-open:rotate-90 inline-block">
            ▸
          </span>
          Thinking{isStreaming && <span className="animate-pulse">...</span>}
        </summary>
        
        <div className="mt-2 text-sm text-foreground max-h-40 overflow-y-auto rounded bg-background/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
          {content || children}
        </div>
      </details>
    )
  }
)
Reasoning.displayName = 'Reasoning'

export { Reasoning }
