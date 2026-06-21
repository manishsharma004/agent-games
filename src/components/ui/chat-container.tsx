import * as React from 'react'
import { useStickToBottom } from 'use-stick-to-bottom'
import { cn } from '@/lib/utils'

interface ChatContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  scrollAnchor?: React.RefObject<HTMLDivElement>
  children?: React.ReactNode
}

const ChatContainer = React.forwardRef<HTMLDivElement, ChatContainerProps>(
  ({ className, scrollAnchor, children, ...props }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null)
    const scrollRef = scrollAnchor || React.useRef<HTMLDivElement>(null)
    
    const { scrollRef: stickRef } = useStickToBottom(containerRef)

    return (
      <div
        ref={containerRef}
        className={cn(
          'flex flex-col gap-4 overflow-y-auto',
          className
        )}
        {...props}
      >
        {children}
        <div ref={scrollRef} className="h-0" />
      </div>
    )
  }
)
ChatContainer.displayName = 'ChatContainer'

export { ChatContainer }
