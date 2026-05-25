import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

interface ChoiceButtonsProps {
  choices: { index: number; text: string }[]
  onSelect: (index: number) => void
  disabled?: boolean
}

/** Ink 分支选项按钮 — 渲染在对话区域上方 */
export function ChoiceButtons({ choices, onSelect, disabled }: ChoiceButtonsProps) {
  if (choices.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {choices.map((choice) => (
        <Button
          key={choice.index}
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left text-sm font-normal',
            'border-border/60 bg-background/90 hover:bg-primary/10 hover:border-primary/40',
            'transition-all duration-200',
          )}
          onClick={() => onSelect(choice.index)}
        >
          {choice.text}
        </Button>
      ))}
    </div>
  )
}
