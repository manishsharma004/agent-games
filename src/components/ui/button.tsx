import * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = {
  default: 'inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ring-offset-background',
  ghost: 'inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed',
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <button
      className={cn(buttonVariants[variant], className)}
      ref={ref}
      {...props}
    />
  ),
)
Button.displayName = 'Button'

export { Button }
