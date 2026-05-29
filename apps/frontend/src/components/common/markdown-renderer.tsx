import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/cn'

interface Props {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: Props) {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed text-foreground/85', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt || ''}
              className="rounded-lg max-w-full my-2"
              loading="lazy"
            />
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ className: codeClass, children, ...props }) => {
            const isInline = !codeClass
            if (isInline) {
              return (
                <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono" {...props}>
                  {children}
                </code>
              )
            }
            return (
              <pre className="rounded-lg bg-muted/80 p-3 overflow-x-auto text-xs">
                <code className={codeClass} {...props}>{children}</code>
              </pre>
            )
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/30 pl-4 italic text-muted-foreground my-2">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="w-full border-collapse rounded-lg border border-border text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border border-border px-3 py-2 text-left font-medium text-foreground">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-2 text-muted-foreground">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
