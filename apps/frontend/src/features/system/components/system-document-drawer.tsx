import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
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
        <DrawerContent className="flex h-[90dvh] w-full max-w-full flex-col rounded-t-3xl border-0">
          <div className="flex shrink-0 items-center justify-center border-b border-border/50 bg-transparent px-4 py-3">
            <DrawerTitle className="text-base font-semibold">{title}</DrawerTitle>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
            <MarkdownContent content={content} />
            <div className="h-16" />
          </div>
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <MarkdownContent content={content} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
