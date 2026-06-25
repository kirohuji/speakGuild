import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface PrepPagerProps {
  currentPage: number
  totalPages: number
  totalItems: number
  onPageChange: (page: number) => void
}

export function PrepPager({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}: PrepPagerProps) {
  const { t } = useTranslation()
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/35 px-3 py-2">
      <span className="text-[11px] text-muted-foreground">
        {t('common.total')} {totalItems} {t('practiceSession.items')}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          {t('common.prevPage')}
        </Button>
        <span className="min-w-10 text-center text-[11px] text-muted-foreground">
          {currentPage}/{totalPages}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          {t('common.nextPage')}
        </Button>
      </div>
    </div>
  )
}
