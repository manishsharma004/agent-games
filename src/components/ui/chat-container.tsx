import * as React from 'react'
import { useStickToBottom } from 'use-stick-to-bottom'
import { cn } from '@/lib/utils'

interface ChatContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  scrollAnchor?: React.RefObject<HTMLDivElement>
  children?: React.ReactNode
}

const ChatContainer = React.forwardRef<HTMLDivElement, ChatContainerProps>(
  ({ className, scrollAnchor, children, ...props }, ref) => {
    const localAnchorRef = React.useRef<HTMLDivElement>(null)
    const anchorRef = scrollAnchor ?? localAnchorRef
    const { scrollRef, contentRef } = useStickToBottom()

    const setContainerRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        scrollRef(node)
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      },
      [scrollRef, ref]
    )

    return (
      <div
        ref={setContainerRef}
        className={cn(
          'flex flex-col gap-4 overflow-y-auto',
          className
        )}
        {...props}
      >
        <div ref={contentRef}>
          {children}
          <div ref={anchorRef} className="h-0" />
        </div>
      </div>
    )
  }
)
ChatContainer.displayName = 'ChatContainer'

export { ChatContainer }
