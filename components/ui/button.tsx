import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "",
        destructive: "",
        outline: "",
        secondary: "",
        ghost: "",
        link: "",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-lg px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const variantStyles: Record<string, React.CSSProperties> = {
  default: {},
  destructive: {},
  outline: {},
  secondary: {},
  ghost: {},
  link: {},
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    const getVariantStyle = (): React.CSSProperties => {
      switch (variant) {
        case 'destructive':
          return { background: 'var(--accent-rust)', color: '#fff' }
        case 'outline':
          return { border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)' }
        case 'secondary':
          return { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }
        case 'ghost':
          return { color: 'var(--text-muted)' }
        case 'link':
          return { color: 'var(--accent-rust)' }
        default:
          return { background: 'var(--text-primary)', color: 'var(--bg-body)' }
      }
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        style={{
          ...getVariantStyle(),
          '--tw-ring-color': 'var(--accent-rust)',
          '--tw-ring-offset-color': 'var(--ring-offset)',
          ...style,
        } as React.CSSProperties}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
