import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/cn'

interface Props {
  content: string
  className?: string
  variant?: 'default' | 'teaching'
}

export function MarkdownRenderer({ content, className, variant = 'default' }: Props) {
  const isTeaching = variant === 'teaching'

  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed text-foreground/85',
        isTeaching && [
          'text-[15px] leading-7 text-foreground/82',
          'prose-headings:tracking-tight prose-headings:text-foreground',
          'prose-h1:mb-5 prose-h1:text-2xl prose-h1:font-bold',
          'prose-h2:mb-3 prose-h2:mt-8 prose-h2:border-b prose-h2:border-primary/15 prose-h2:pb-2 prose-h2:text-lg prose-h2:font-semibold',
          'prose-h3:mb-2 prose-h3:mt-6 prose-h3:text-base prose-h3:font-semibold prose-h3:text-primary',
          'prose-p:my-3 prose-p:leading-7',
          'prose-li:my-1 prose-li:marker:text-primary/70',
          'prose-strong:font-semibold prose-strong:text-foreground',
          'prose-hr:my-7 prose-hr:border-border/60',
        ],
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt || ''}
              className={cn('max-w-full my-2', isTeaching ? 'rounded-xl shadow-sm' : 'rounded-lg')}
              loading="lazy"
            />
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'text-primary underline underline-offset-2',
                isTeaching && 'decoration-primary/35 transition-colors hover:decoration-primary',
              )}
            >
              {children}
            </a>
          ),
          code: ({ className: codeClass, children, ...props }) => {
            const isInline = !codeClass
            if (isInline) {
              return (
                <code className={cn('rounded bg-muted px-1 py-0.5 text-xs font-mono', isTeaching && 'bg-primary/[0.08] text-[0.82em] text-primary')} {...props}>
                  {children}
                </code>
              )
            }
            return (
              <pre className={cn('rounded-lg bg-muted/80 p-3 overflow-x-auto text-xs', isTeaching && 'rounded-xl border border-border/55 bg-muted/45 p-4 leading-6')}>
                <code className={codeClass} {...props}>{children}</code>
              </pre>
            )
          },
          blockquote: ({ children }) => (
            <blockquote className={cn(
              'border-l-2 border-primary/30 pl-4 italic text-muted-foreground my-2',
              isTeaching && 'my-5 rounded-r-xl border-l-[3px] border-primary/55 bg-primary/[0.055] px-4 py-2 not-italic',
            )}>
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className={cn('overflow-x-auto my-3', isTeaching && 'my-5 rounded-xl border border-border/65')}>
              <table className={cn('w-full border-collapse rounded-lg border border-border text-xs', isTeaching && 'border-0 text-sm')}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className={cn('bg-muted/50', isTeaching && 'bg-primary/[0.07]')}>{children}</thead>
          ),
          th: ({ children }) => (
            <th className={cn('border border-border px-3 py-2 text-left font-medium text-foreground', isTeaching && 'border-x-0 border-t-0 px-3.5 py-2.5 font-semibold')}>{children}</th>
          ),
          td: ({ children }) => (
            <td className={cn('border border-border px-3 py-2 text-muted-foreground', isTeaching && 'border-x-0 border-b-0 px-3.5 py-2.5 leading-6')}>{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
