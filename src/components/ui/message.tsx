import * as React from 'react'
import { cn } from '@/lib/utils'

interface MessageProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'content'> {
  role: 'user' | 'assistant'
  content?: string | React.ReactNode
  avatar?: React.ReactNode
  actions?: React.ReactNode
  isStreaming?: boolean
}

const Message = React.forwardRef<HTMLDivElement, MessageProps>(
  (
    {
      className,
      role,
      content,
      avatar,
      actions,
      isStreaming = false,
      children,
      ...props
    },
    ref
  ) => {
    const isUser = role === 'user'

    return (
      <div
        ref={ref}
        className={cn(
          'flex gap-3 mb-4',
          isUser && 'flex-row-reverse',
          className
        )}
        {...props}
      >
        {avatar && (
          <div className={cn(
            'flex-shrink-0',
            isUser ? 'ml-2' : 'mr-2'
          )}>
            {avatar}
          </div>
        )}
        
        <div className={cn(
          'flex-1 max-w-[80%]',
          isUser && 'flex flex-col items-end'
        )}>
          <div
            className={cn(
              'rounded-lg px-4 py-3',
              isUser
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            )}
          >
            <div className="text-sm leading-relaxed">
              {content || children}
            </div>
          </div>
          
          {actions && (
            <div className={cn(
              'flex gap-2 mt-2',
              isUser && 'flex-row-reverse'
            )}>
              {actions}
            </div>
          )}
        </div>
      </div>
    )
  }
)
Message.displayName = 'Message'

export { Message }
