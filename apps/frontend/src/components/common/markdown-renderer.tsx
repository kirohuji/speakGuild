import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { cn } from '@/lib/cn'

interface Props {
  content: string
  className?: string
  variant?: 'default' | 'teaching'
  headingIdPrefix?: string
}

export interface MarkdownHeading {
  id: string
  level: 1 | 2 | 3
  text: string
}

function headingText(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~]/g, '')
    .trim()
}

export function getMarkdownHeadings(content: string, idPrefix: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = []
  let fence: '`' | '~' | null = null

  content.split(/\r?\n/).forEach((line, index) => {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1][0] as '`' | '~'
      fence = fence === marker ? null : fence ?? marker
      return
    }
    if (fence) return

    const match = line.match(/^\s*(#{1,3})[ \t]+(.+?)[ \t]*#*[ \t]*$/)
    if (!match) return

    const text = headingText(match[2])
    if (!text) return
    headings.push({
      id: `${idPrefix}-${index + 1}`,
      level: match[1].length as 1 | 2 | 3,
      text,
    })
  })

  return headings
}

export function MarkdownRenderer({ content, className, variant = 'default', headingIdPrefix }: Props) {
  const isTeaching = variant === 'teaching'
  const headingId = (line?: number) => line && headingIdPrefix ? `${headingIdPrefix}-${line}` : undefined

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
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          h1: ({ node, children }) => <h1 id={headingId(node?.position?.start.line)}>{children}</h1>,
          h2: ({ node, children }) => <h2 id={headingId(node?.position?.start.line)}>{children}</h2>,
          h3: ({ node, children }) => <h3 id={headingId(node?.position?.start.line)}>{children}</h3>,
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
            <div className={cn('my-3 overflow-x-auto', isTeaching && 'my-0 rounded-xl border border-border/65')}>
              <table className={cn('w-full border-collapse rounded-lg border border-border text-xs', isTeaching && '!my-0 border-0 text-sm')}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className={cn('bg-muted/50', isTeaching && 'bg-primary/[0.07]')}>{children}</thead>
          ),
          th: ({ children }) => (
            <th className={cn('border border-border px-2 py-1.5 text-left align-top font-medium leading-5 text-foreground', isTeaching && 'border-x-0 border-t-0 font-semibold')}>{children}</th>
          ),
          td: ({ children }) => (
            <td className={cn('border border-border px-2 py-1.5 align-top leading-5 text-muted-foreground', isTeaching && 'border-x-0 border-b-0')}>{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
