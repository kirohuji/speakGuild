import React from 'react'
import MDEditor, { type MDEditorProps } from '@uiw/react-md-editor'
import '@uiw/react-md-editor/markdown-editor.css'
import { cn } from '@/lib/cn'

interface MarkdownEditorProps extends Omit<MDEditorProps, 'onChange'> {
  value: string
  onChange?: (value: string) => void
  height?: number
  preview?: 'live' | 'edit' | 'preview'
  label?: string
  placeholder?: string
  disabled?: boolean
  minimal?: boolean
  className?: string
}

export function MarkdownEditor({
  value,
  onChange,
  height = 250,
  preview = 'live',
  label,
  disabled = false,
  minimal = false,
  className,
  ...rest
}: MarkdownEditorProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label className="text-xs font-medium text-foreground/80">{label}</label>
      )}
      <div
        data-color-mode="light"
        className={cn(
          '[&_.w-md-editor]:shadow-none [&_.w-md-editor]:border [&_.w-md-editor]:border-border [&_.w-md-editor]:rounded-lg',
          minimal && '[&_.w-md-editor-toolbar]:hidden',
          disabled && '[&_.w-md-editor]:opacity-60 [&_.w-md-editor]:pointer-events-none',
        )}
      >
        <MDEditor
          value={value}
          onChange={(val) => onChange?.(val || '')}
          height={height}
          preview={preview}
          visibleDragbar={false}
          hideToolbar={false}
          {...rest}
        />
      </div>
    </div>
  )
}
