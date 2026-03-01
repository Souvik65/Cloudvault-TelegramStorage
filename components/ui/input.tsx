import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#242F3D] px-3 py-2 text-sm text-white ring-offset-[#17212B] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white placeholder:text-[#6C7883] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2AABEE] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
