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
}

export function PracticeVnDrawer({
  teachingMarkdown,
  onOpen,
  hideToggles = false,
  triggerClassName,
  plainTrigger = false,
  showTriggerIcon = true,
}: PracticeVnDrawerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      {!hideToggles && (
        <button
          type="button"
          onClick={() => {
            setOpen(true)
            void onOpen?.()
          }}
          className={cn(
            !plainTrigger && 'flex items-center gap-2 rounded-full border border-border/20 bg-background/60 px-3.5 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur-2xl transition-transform active:scale-[0.97]',
            triggerClassName,
          )}
        >
          {showTriggerIcon && <BookOpen className="size-3.5 text-foreground/70" />}
          <span>{t('practiceVn.teaching')}</span>
        </button>
      )}

      <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
        <DrawerContent className="h-[82vh] max-h-[82vh] rounded-t-[28px] border-border/20 bg-background text-foreground shadow-[0_-24px_80px_rgba(0,0,0,.42)] backdrop-blur-2xl">
          <DrawerHeader className="px-5 pb-3 pt-3 text-left">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DrawerTitle className="text-base">{t('practiceVn.teaching')}</DrawerTitle>
                <DrawerDescription className="mt-1 text-xs">
                  {t('practiceVn.teachingDesc')}
                </DrawerDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 rounded-full"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </DrawerHeader>

          <ScrollArea className="min-h-0 flex-1">
            {teachingMarkdown ? (
              <section className="px-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                <MarkdownRenderer content={teachingMarkdown} className="text-xs leading-5" />
              </section>
            ) : (
              <p className="mx-5 mb-5 rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-xs text-muted-foreground">
                {t('practiceVn.noTeaching')}
              </p>
            )}
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </>
  )
}
