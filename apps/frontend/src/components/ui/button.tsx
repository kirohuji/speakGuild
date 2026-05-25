import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/cn"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(255,255,255,0.06)_inset] hover:shadow-[0_2px_6px_rgba(0,0,0,0.12),0_0_0_1px_rgba(255,255,255,0.08)_inset] active:shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
        destructive:
          "bg-destructive text-destructive-foreground rounded-xl shadow-sm hover:bg-destructive/90",
        outline:
          "border border-border bg-transparent rounded-xl hover:bg-muted/60 hover:border-muted-foreground/30 active:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-xl",
        ghost: "hover:bg-accent/50 hover:text-accent-foreground rounded-xl",
        link: "text-primary underline-offset-4 hover:underline",
        "outline-primary":
          "border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 hover:border-primary/50 active:bg-primary/15 rounded-xl",
      },
      size: {
        default: "h-9 px-5 py-2",
        sm: "h-8 px-4 py-1.5 text-xs rounded-lg",
        lg: "h-11 px-8 py-2.5 rounded-xl",
        "icon-sm": "h-8 w-8 rounded-lg",
        "icon": "h-9 w-9 rounded-lg",
        // 新增：修长但不扁的主按钮
        "primary-lg": "h-[46px] px-7 py-2.5 rounded-xl text-[15px] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(255,255,255,0.06)_inset] hover:shadow-[0_3px_8px_rgba(0,0,0,0.14),0_0_0_1px_rgba(255,255,255,0.1)_inset] active:shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
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