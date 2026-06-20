import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'
import { cn } from '@/lib/cn'

interface PracticeVnDrawerProps {
  teachingMarkdown?: string
  onOpen?: () => void | Promise<void>
  hideToggles?: boolean
  triggerClassName?: string
  plainTrigger?: boolean
  showTriggerIcon?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function PracticeVnDrawer({
  teachingMarkdown,
  onOpen,
  hideToggles = false,
  triggerClassName,
  plainTrigger = false,
  showTriggerIcon = true,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: PracticeVnDrawerProps) {
  const { t } = useTranslation()
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const handleOpenChange = isControlled ? controlledOnOpenChange! : setInternalOpen

  const handleTriggerClick = () => {
    if (isControlled) {
      controlledOnOpenChange?.(true)
    } else {
      setInternalOpen(true)
    }
    void onOpen?.()
  }

  return (
    <>
      {!hideToggles && (
        <button
          type="button"
          onClick={handleTriggerClick}
          className={cn(
            !plainTrigger && 'flex items-center gap-2 rounded-full border border-border/20 bg-background/60 px-3.5 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur-2xl transition-transform active:scale-[0.97]',
            triggerClassName,
          )}
        >
          {showTriggerIcon && <BookOpen className="size-3.5 text-foreground/70" />}
          <span>{t('practiceVn.teaching')}</span>
        </button>
      )}

      <Drawer open={open} onOpenChange={handleOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="h-[82vh] max-h-[82vh] rounded-t-[28px] border-border/20 bg-background text-foreground shadow-[0_-24px_80px_rgba(0,0,0,.42)] backdrop-blur-2xl">
          <DrawerHeader className="border-b border-border/45 px-5 pb-4 pt-3 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/[0.09] text-primary">
                  <BookOpen className="size-5" />
                </div>
                <div>
                  <DrawerTitle className="text-base font-semibold tracking-tight">{t('practiceVn.teaching')}</DrawerTitle>
                  <DrawerDescription className="mt-1 text-xs">
                    {t('practiceVn.teachingDesc')}
                  </DrawerDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 shrink-0 rounded-full"
                onClick={() => handleOpenChange(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
          </DrawerHeader>

          <ScrollArea className="min-h-0 flex-1">
            {teachingMarkdown ? (
              <section className="px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-4">
                <MarkdownRenderer content={teachingMarkdown} variant="teaching" />
              </section>
            ) : (
              <div className="flex h-full items-center justify-center px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-4">
                <p className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-xs text-muted-foreground">
                  {t('practiceVn.noTeaching')}
                </p>
              </div>
            )}
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </>
  )
}
