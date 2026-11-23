import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useIsMobile } from '@/hooks/use-mobile'
import { MarkdownContent } from './markdown-content'

interface SystemDocumentDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  content: string
}

export function SystemDocumentDrawer({ open, onClose, title, content }: SystemDocumentDrawerProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(next) => { if (!next) onClose() }} onClose={onClose}>
        <DrawerContent className="h-[90dvh] w-full max-w-full rounded-t-3xl border-0">
          <div className="flex items-center justify-center border-b border-border/50 bg-transparent px-4 py-3">
            <DrawerTitle className="text-base font-semibold">{title}</DrawerTitle>
          </div>
          <ScrollArea className="flex-1">
            <div className="px-4 py-5">
              <MarkdownContent content={content} />
            </div>
            <div className="h-16" />
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="flex max-h-[min(88vh,820px)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 pr-14 text-left">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-5 py-5">
            <MarkdownContent content={content} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
