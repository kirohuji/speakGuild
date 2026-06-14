import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/cn'

export function MobileProfileDetail({
  title,
  onBack,
  children,
}: {
  title: string
  onBack: () => void
  children: React.ReactNode
}) {
  const { t } = useTranslation()

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="relative flex shrink-0 items-center justify-center pb-2">
        <button
          type="button"
          aria-label={t('common.back')}
          onClick={onBack}
          className="absolute left-0 inline-flex size-10 items-center justify-center rounded-full hover:bg-muted/60 active:bg-muted"
        >
          <ChevronLeft className="h-[22px] w-[22px]" />
        </button>
        <h1 className="max-w-[70%] truncate text-base font-semibold">
          {title}
        </h1>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto max-w-2xl space-y-4">
          {children}
        </div>
      </div>
    </section>
  )
}
