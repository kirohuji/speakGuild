import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MarkdownContent } from './markdown-content'

interface SystemDocumentDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  content: string
}

export function SystemDocumentDrawer({ open, onClose, title, content }: SystemDocumentDrawerProps) {
  return (
    <Drawer open={open} onClose={onClose}>
      <DrawerContent className="h-[90dvh] w-full max-w-full rounded-none border-0">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-center border-b border-border/50 bg-background px-4 py-3">
          <h1 className="text-base font-semibold">{title}</h1>
        </div>

        {/* 内容区 */}
        <ScrollArea className="flex-1">
          <div className="px-4 py-5">
            <MarkdownContent content={content} />
          </div>
          {/* 底部留白，避免内容贴底 */}
          <div className="h-16" />
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  )
}
