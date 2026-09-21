import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, ListTree, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getMarkdownHeadings, MarkdownRenderer } from '@/components/common/markdown-renderer'
import { cn } from '@/lib/cn'

const TEACHING_HEADING_PREFIX = 'teaching-document-heading'

interface PracticeVnDrawerProps {
  teachingMarkdown?: string
  loading?: boolean
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
  loading = false,
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
  const [tocOpen, setTocOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const handleOpenChange = isControlled ? controlledOnOpenChange! : setInternalOpen
  const headings = useMemo(
    () => getMarkdownHeadings(teachingMarkdown ?? '', TEACHING_HEADING_PREFIX),
    [teachingMarkdown],
  )
  const tocHeight = Math.min(Math.max(headings.length * 40, 48), 288)

  const handleTriggerClick = () => {
    if (isControlled) {
      controlledOnOpenChange?.(true)
    } else {
      setInternalOpen(true)
    }
    void onOpen?.()
  }

  const handleTocSelect = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTocOpen(false)
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
                {headings.length > 0 ? (
                  <Popover open={tocOpen} onOpenChange={setTocOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/[0.09] text-primary transition-colors hover:bg-primary/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        aria-label={t('practiceVn.contents')}
                        title={t('practiceVn.contents')}
                      >
                        <ListTree className="size-5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      sideOffset={8}
                      collisionPadding={12}
                      data-vaul-no-drag
                      className="w-[min(20rem,calc(100vw-2rem))] overflow-hidden border-0 bg-background/95 p-0 text-foreground shadow-[0_18px_50px_rgba(0,0,0,.28)] backdrop-blur-2xl"
                      onWheel={(event) => event.stopPropagation()}
                      onTouchMove={(event) => event.stopPropagation()}
                      onPointerMove={(event) => event.stopPropagation()}
                    >
                      <p className="bg-muted/45 px-4 py-3 text-xs font-semibold tracking-wide text-muted-foreground">
                        {t('practiceVn.contents')}
                      </p>
                      <ScrollArea
                        data-vaul-no-drag
                        className="touch-pan-y overscroll-contain"
                        style={{ height: tocHeight, maxHeight: '50dvh' }}
                      >
                        <nav
                          data-vaul-no-drag
                          className="flex flex-col gap-0.5 p-2 pr-3"
                          aria-label={t('practiceVn.contents')}
                        >
                          {headings.map((heading) => (
                            <button
                              key={heading.id}
                              type="button"
                              className={cn(
                                'w-full rounded-lg px-2 py-2 text-left text-sm leading-5 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                                heading.level === 2 && 'pl-5',
                                heading.level === 3 && 'pl-8 text-muted-foreground',
                              )}
                              onClick={() => handleTocSelect(heading.id)}
                            >
                              {heading.text}
                            </button>
                          ))}
                        </nav>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/[0.09] text-primary">
                    <ListTree className="size-5" />
                  </div>
                )}
                <div>
                  <DrawerTitle className="text-base font-semibold tracking-tight">{t('practiceVn.teaching')}</DrawerTitle>
                  <DrawerDescription className="mt-1 text-xs">
                    {t('practiceVn.teachingDesc')}
                  </DrawerDescription>
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 rounded-full"
                  aria-label={t('common.close')}
                  onClick={() => handleOpenChange(false)}
                >
                  <X />
                </Button>
              </div>
            </div>
          </DrawerHeader>

          <ScrollArea className="min-h-0 flex-1">
            {loading ? (
              <div className="flex h-full items-center justify-center px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-4">
                <p className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-xs text-muted-foreground">
                  {t('practiceVn.loadingTeaching')}
                </p>
              </div>
            ) : teachingMarkdown ? (
              <section className="px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-4">
                <MarkdownRenderer
                  content={teachingMarkdown}
                  variant="teaching"
                  headingIdPrefix={TEACHING_HEADING_PREFIX}
                />
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
