import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/cn"

const NESTED_DIALOG_EVENT = "manyu:record-detail-overlay"

export function setRecordDetailOverlay(open: boolean) {
  window.dispatchEvent(new CustomEvent(NESTED_DIALOG_EVENT, { detail: open }))
}

const Drawer = ({
  shouldScaleBackground = true,
  dismissible = true,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => {
  const [nestedHeld, setNestedHeld] = React.useState(false)
  const openCountRef = React.useRef(0)
  const releaseTimerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    const onToggle = (event: Event) => {
      const nextOpen = Boolean((event as CustomEvent<boolean>).detail)
      if (nextOpen) {
        openCountRef.current += 1
        if (releaseTimerRef.current !== null) {
          window.clearTimeout(releaseTimerRef.current)
          releaseTimerRef.current = null
        }
        setNestedHeld(true)
        return
      }
      openCountRef.current = Math.max(0, openCountRef.current - 1)
      if (releaseTimerRef.current !== null) window.clearTimeout(releaseTimerRef.current)
      releaseTimerRef.current = window.setTimeout(() => {
        if (openCountRef.current === 0) setNestedHeld(false)
        releaseTimerRef.current = null
      }, 500)
    }
    window.addEventListener(NESTED_DIALOG_EVENT, onToggle)
    return () => {
      window.removeEventListener(NESTED_DIALOG_EVENT, onToggle)
      if (releaseTimerRef.current !== null) window.clearTimeout(releaseTimerRef.current)
    }
  }, [])

  return (
    <DrawerPrimitive.Root
      shouldScaleBackground={shouldScaleBackground}
      {...props}
      dismissible={dismissible && !nestedHeld}
      onOpenChange={(open) => {
        if (!open && nestedHeld) return
        onOpenChange?.(open)
      }}
    />
  )
}
Drawer.displayName = "Drawer"

const DrawerTrigger = DrawerPrimitive.Trigger

const DrawerPortal = DrawerPrimitive.Portal

const DrawerClose = DrawerPrimitive.Close

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/80", className)}
    {...props}
  />
))
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & { showHandle?: boolean; overlayClassName?: string }
>(({ className, children, showHandle = true, overlayClassName, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay className={overlayClassName} />
    <DrawerPrimitive.Content
      ref={ref}
      data-keyboard-overlay="bottom"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background app-surface outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
        className
      )}
      {...props}
    >
      {showHandle && <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />}
      <DrawerDescription className="sr-only" />
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
))
DrawerContent.displayName = "DrawerContent"

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props}
  />
)
DrawerHeader.displayName = "DrawerHeader"

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
)
DrawerFooter.displayName = "DrawerFooter"

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DrawerTitle.displayName = DrawerPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DrawerDescription.displayName = DrawerPrimitive.Description.displayName

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
