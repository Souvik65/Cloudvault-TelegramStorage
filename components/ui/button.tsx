import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DBDBDB] focus-visible:ring-offset-2 focus-visible:ring-offset-[#808080] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#DBDBDB] text-white hover:bg-[#DBDBDB]",
        destructive: "bg-[#ff6a3d] text-white hover:bg-[#ff6a3d]",
        outline: "border border-[rgba(255,255,255,0.18)] bg-transparent text-[#A0ADB9] hover:bg-white/5 hover:text-white",
        secondary: "bg-[#808080] text-[#A0ADB9] hover:bg-white/5 hover:text-white",
        ghost: "text-[#A0ADB9] hover:bg-white/5 hover:text-white",
        link: "text-[#DBDBDB] underline-offset-4 hover:underline",
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

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
