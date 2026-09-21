import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-8 w-full rounded-[2px] border border-input bg-transparent px-2 py-1 text-xs transition-[border-color] duration-150 file:border-0 file:bg-transparent file:text-xs file:text-foreground placeholder:text-muted-foreground focus-visible:border-[var(--color-ember)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
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
