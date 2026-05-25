import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function MarkdownContent({ content }: { content: string }) {
  return (
    <article className="
      text-sm leading-relaxed text-foreground/85
      [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:mt-0 [&_h1]:mb-4
      [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:mt-8 [&_h2]:mb-4
      [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:mt-6 [&_h3]:mb-3
      [&_h4]:font-display [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-5 [&_h4]:mb-2
      [&_p]:mb-3 [&_p]:leading-relaxed
      [&_strong]:font-semibold [&_strong]:text-foreground
      [&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline
      [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3
      [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3
      [&_li]:mb-1 [&_li]:leading-relaxed
      [&_br]:hidden

      [&_blockquote]:border-l-[3px] [&_blockquote]:border-l-primary [&_blockquote]:bg-muted/30 [&_blockquote]:py-2 [&_blockquote]:px-4 [&_blockquote]:rounded-r-lg [&_blockquote]:mb-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground

      [&_code:not(pre_code)]:bg-muted [&_code:not(pre_code)]:px-1.5 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:rounded-md [&_code:not(pre_code)]:text-xs [&_code:not(pre_code)]:font-mono [&_code:not(pre_code)]:text-foreground

      [&_img]:rounded-xl [&_img]:max-w-full

      /* 表格容器：溢出横向滚动 + 圆角边框 */
      [&_.table-wrapper]:overflow-x-auto [&_.table-wrapper]:my-4 [&_.table-wrapper]:rounded-lg [&_.table-wrapper]:border [&_.table-wrapper]:border-border

      /* 表格：最小宽度撑满，内容过多则自然撑开触发横向滚动 */
      [&_table]:min-w-full [&_table]:border-collapse [&_table]:text-sm

      [&_th]:border [&_th]:border-solid [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-foreground [&_th]:whitespace-nowrap

      [&_td]:border [&_td]:border-solid [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm [&_td]:text-foreground/85

      [&_tr:hover]:bg-muted/30
      [&_tr]:transition-colors

      [&_small]:text-xs [&_small]:text-muted-foreground [&_small]:leading-relaxed
    ">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="table-wrapper">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  )
}
