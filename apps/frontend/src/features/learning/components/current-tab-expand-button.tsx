import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

/**
 * 收起知识点预览时，仅针对当前 Tab 显示的展开入口。
 * 单词、句块和句型共享相同的可见规则，避免用其它 Tab 的数据误导用户。
 */
export function CurrentTabExpandButton({
  itemCount,
  onExpand,
}: {
  itemCount: number
  onExpand: () => void
}) {
  const { t } = useTranslation()

  if (itemCount <= 0) return null

  return (
    <Button
      variant="ghost"
      size="sm"
      className="mt-3 w-full gap-1.5 text-xs text-muted-foreground transition-none hover:!bg-transparent hover:!text-muted-foreground active:!scale-100"
      onClick={onExpand}
    >
      <ChevronDown className="size-3.5" />
      {t('learning.expandAll', { count: itemCount })}
    </Button>
  )
}
