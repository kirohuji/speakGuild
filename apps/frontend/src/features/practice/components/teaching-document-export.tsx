import { useMemo, type ReactNode } from 'react'
import {
  Document,
  Font,
  Image,
  Page,
  pdf,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'

export const TEACHING_DOCUMENT_A4 = {
  widthPx: Math.round((210 * 96) / 25.4),
  heightPx: Math.round((297 * 96) / 25.4),
} as const

type TeachingBlock = {
  id: string
  kind: 'heading' | 'paragraph' | 'list' | 'quote' | 'code' | 'rule'
  text: string
  level?: 1 | 2 | 3
}

export type TeachingDocumentPageData = TeachingBlock[]

const FONT_FAMILY = 'NotoSansSC'
const BRAND_NAME = '漫语町 · ManYuDing'
let fontRegistered = false

function registerFont() {
  if (fontRegistered || typeof window === 'undefined') return
  const src = new URL('/fonts/NotoSansSC-Regular.ttf', window.location.href).href
  Font.register({ family: FONT_FAMILY, fonts: [{ src, fontWeight: 400 }, { src, fontWeight: 700 }] })
  Font.registerHyphenationCallback((word) => [word])
  fontRegistered = true
}

function cleanInlineMarkdown(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1')
    .trim()
}

function parseTeachingMarkdown(markdown: string): TeachingBlock[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const blocks: TeachingBlock[] = []
  let paragraph: string[] = []
  let list: string[] = []
  let code: string[] = []
  let inCode = false

  const push = (kind: TeachingBlock['kind'], text: string, level?: 1 | 2 | 3) => {
    const clean = kind === 'code' ? text.trim() : cleanInlineMarkdown(text)
    if (clean) blocks.push({ id: `block-${blocks.length}`, kind, text: clean, level })
  }
  const flushParagraph = () => { if (paragraph.length) push('paragraph', paragraph.join(' ')); paragraph = [] }
  const flushList = () => { if (list.length) push('list', list.join('\n')); list = [] }

  for (const line of lines) {
    if (/^\s*(`{3,}|~{3,})/.test(line)) {
      flushParagraph(); flushList()
      if (inCode) { push('code', code.join('\n')); code = [] }
      inCode = !inCode
      continue
    }
    if (inCode) { code.push(line); continue }
    const heading = line.match(/^\s*(#{1,3})\s+(.+?)\s*#*\s*$/)
    if (heading) {
      flushParagraph(); flushList()
      push('heading', heading[2], heading[1].length as 1 | 2 | 3)
      continue
    }
    if (/^\s*(---+|___+|\*\*\*+)\s*$/.test(line)) {
      flushParagraph(); flushList(); push('rule', '—')
      continue
    }
    const listItem = line.match(/^\s*(?:[-+*]|\d+[.)])\s+(.+)$/)
    if (listItem) {
      flushParagraph(); list.push(`• ${cleanInlineMarkdown(listItem[1])}`)
      continue
    }
    const quote = line.match(/^\s*>\s?(.*)$/)
    if (quote) {
      flushParagraph(); flushList(); push('quote', quote[1])
      continue
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (!/^\s*\|?[\s:|-]+\|?\s*$/.test(line)) list.push(line.split('|').map(cleanInlineMarkdown).filter(Boolean).join(' · '))
      continue
    }
    if (!line.trim()) { flushParagraph(); flushList(); continue }
    paragraph.push(line.trim())
  }
  flushParagraph(); flushList()
  if (code.length) push('code', code.join('\n'))
  return blocks
}

function estimatedLines(block: TeachingBlock) {
  if (block.kind === 'rule') return 1.2
  const charsPerLine = block.kind === 'code' ? 52 : block.kind === 'heading' ? 38 : 62
  const lines = block.text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0)
  if (block.kind === 'heading') return lines * (block.level === 1 ? 2.2 : block.level === 2 ? 1.8 : 1.55) + 1
  if (block.kind === 'list') return lines * 1.25 + 0.7
  if (block.kind === 'quote' || block.kind === 'code') return lines * 1.25 + 1
  return lines * 1.18 + 0.75
}

export function buildTeachingDocumentPages(markdown: string): TeachingDocumentPageData[] {
  const blocks = parseTeachingMarkdown(markdown)
  const pages: TeachingDocumentPageData[] = [[]]
  const PAGE_CAPACITY = 50
  let used = 0
  for (const block of blocks) {
    const height = estimatedLines(block)
    if (pages[pages.length - 1]!.length && used + height > PAGE_CAPACITY) {
      pages.push([])
      used = 0
    }
    pages[pages.length - 1]!.push(block)
    used += height
  }
  return pages
}

export function teachingDocumentTitle(markdown: string, fallback: string) {
  const heading = parseTeachingMarkdown(markdown).find((block) => block.kind === 'heading')
  return heading?.text || fallback
}

const styles = StyleSheet.create({
  page: { fontFamily: FONT_FAMILY, color: '#1c1917', paddingTop: 54, paddingBottom: 48, paddingHorizontal: 34, fontSize: 9.5 },
  watermark: { position: 'absolute', top: '43%', left: '13%', width: '74%', textAlign: 'center', transform: 'rotate(-28deg)', fontSize: 36, fontWeight: 700, color: '#f4ede6' },
  header: { position: 'absolute', top: 18, left: 34, right: 34, height: 25, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.7, borderBottomColor: '#e7e1da', paddingBottom: 7 },
  logo: { width: 20, height: 20, objectFit: 'contain' },
  brand: { marginLeft: 7, fontSize: 8.5, fontWeight: 700, color: '#57534e' },
  headerTitle: { flexGrow: 1, textAlign: 'right', fontSize: 8.5, color: '#78716c' },
  footer: { position: 'absolute', bottom: 18, left: 34, right: 34, paddingTop: 7, borderTopWidth: 0.7, borderTopColor: '#e7e1da', flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: '#a8a29e' },
  h1: { fontSize: 18, lineHeight: 1.35, fontWeight: 700, color: '#1c1917', marginBottom: 10 },
  h2: { fontSize: 12.5, lineHeight: 1.4, fontWeight: 700, color: '#9a3412', marginTop: 7, marginBottom: 5 },
  h3: { fontSize: 10.5, lineHeight: 1.45, fontWeight: 700, color: '#44403c', marginTop: 5, marginBottom: 3 },
  paragraph: { fontSize: 9.5, lineHeight: 1.65, marginBottom: 6 },
  list: { fontSize: 9.3, lineHeight: 1.65, marginLeft: 10, marginBottom: 6 },
  quote: { fontSize: 9.2, lineHeight: 1.6, color: '#57534e', backgroundColor: '#faf7f2', borderLeftWidth: 2.5, borderLeftColor: '#fb923c', paddingVertical: 6, paddingHorizontal: 9, marginBottom: 7 },
  code: { fontSize: 8, lineHeight: 1.5, color: '#44403c', backgroundColor: '#f5f5f4', padding: 8, marginBottom: 7 },
  rule: { borderTopWidth: 0.75, borderTopColor: '#d6d3d1', marginVertical: 7 },
})

function PdfBlock({ block }: { block: TeachingBlock }) {
  if (block.kind === 'heading') return <Text style={block.level === 1 ? styles.h1 : block.level === 2 ? styles.h2 : styles.h3}>{block.text}</Text>
  if (block.kind === 'rule') return <View style={styles.rule} />
  return <Text style={styles[block.kind]}>{block.text}</Text>
}

function TeachingPdfDocument({ pages, title, date, logoUrl }: { pages: TeachingDocumentPageData[]; title: string; date: string; logoUrl: string }) {
  return <Document title={title} author={BRAND_NAME} subject="教学文档">
    {pages.map((blocks, pageIndex) => <Page key={pageIndex} size="A4" style={styles.page}>
      <Text fixed style={styles.watermark}>{BRAND_NAME}</Text>
      <View fixed style={styles.header}>
        <Image style={styles.logo} src={logoUrl} />
        <Text style={styles.brand}>{BRAND_NAME}</Text>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      {blocks.map((block) => <PdfBlock key={block.id} block={block} />)}
      <View fixed style={styles.footer}>
        <Text>{date} · 教学资料</Text>
        <Text>{pageIndex + 1} / {pages.length}</Text>
      </View>
    </Page>)}
  </Document>
}

export async function buildTeachingDocumentPdfBlob(input: { markdown: string; title: string; date: string }) {
  registerFont()
  const pages = buildTeachingDocumentPages(input.markdown)
  const logoUrl = new URL('/logo.png', window.location.href).href
  return pdf(<TeachingPdfDocument pages={pages} title={input.title} date={input.date} logoUrl={logoUrl} />).toBlob()
}

const PREVIEW_CSS = `
.teaching-paper{box-sizing:border-box;position:relative;display:flex;flex-direction:column;width:${TEACHING_DOCUMENT_A4.widthPx}px;height:${TEACHING_DOCUMENT_A4.heightPx}px;padding:72px 44px 60px;color:#1c1917;background:#fff;font-family:"PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden}
.teaching-paper *{box-sizing:border-box}.teaching-paper-watermark{position:absolute;left:10%;top:43%;width:80%;transform:rotate(-28deg);text-align:center;font-size:48px;font-weight:700;color:#f4ede6;white-space:nowrap}.teaching-paper-header{position:absolute;left:44px;right:44px;top:24px;height:34px;display:flex;align-items:center;border-bottom:1px solid #e7e1da;padding-bottom:9px;color:#57534e}.teaching-paper-logo{width:27px;height:27px;object-fit:contain}.teaching-paper-brand{margin-left:9px;font-size:11px;font-weight:700}.teaching-paper-head-title{min-width:0;margin-left:auto;max-width:48%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right;font-size:11px;color:#78716c}.teaching-paper-body{position:relative}.teaching-paper h1{margin:0 0 13px;font-size:24px;line-height:1.35}.teaching-paper h2{margin:9px 0 7px;font-size:17px;line-height:1.4;color:#9a3412}.teaching-paper h3{margin:6px 0 4px;font-size:14px;line-height:1.45;color:#44403c}.teaching-paper p,.teaching-paper pre,.teaching-paper blockquote{white-space:pre-wrap}.teaching-paper p{margin:0 0 8px;font-size:13px;line-height:1.65}.teaching-paper .list{margin-left:14px;font-size:12.5px}.teaching-paper blockquote{margin:0 0 9px;border-left:3px solid #fb923c;background:#faf7f2;padding:8px 12px;font-size:12.5px;line-height:1.6;color:#57534e}.teaching-paper pre{margin:0 0 9px;background:#f5f5f4;padding:11px;font:10.5px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;color:#44403c}.teaching-paper .rule{height:1px;margin:10px 0;border:0;background:#d6d3d1}.teaching-paper-footer{position:absolute;left:44px;right:44px;bottom:24px;display:flex;justify-content:space-between;border-top:1px solid #e7e1da;padding-top:9px;font-size:10px;color:#a8a29e}
`

function PreviewBlock({ block }: { block: TeachingBlock }) {
  if (block.kind === 'heading') {
    const Tag = `h${block.level ?? 2}` as 'h1' | 'h2' | 'h3'
    return <Tag>{block.text}</Tag>
  }
  if (block.kind === 'quote') return <blockquote>{block.text}</blockquote>
  if (block.kind === 'code') return <pre>{block.text}</pre>
  if (block.kind === 'rule') return <div className="rule" aria-hidden />
  return <p className={block.kind}>{block.text}</p>
}

export function TeachingDocumentPage({ blocks, title, date, pageNumber }: { blocks: TeachingDocumentPageData; title: string; date: string; pageNumber: string }) {
  return <article className="teaching-paper">
    <style>{PREVIEW_CSS}</style>
    <div className="teaching-paper-watermark" aria-hidden>{BRAND_NAME}</div>
    <header className="teaching-paper-header">
      <img className="teaching-paper-logo" src="/logo.png" alt="" />
      <span className="teaching-paper-brand">{BRAND_NAME}</span>
      <span className="teaching-paper-head-title">{title}</span>
    </header>
    <div className="teaching-paper-body">{blocks.map((block) => <PreviewBlock key={block.id} block={block} />)}</div>
    <footer className="teaching-paper-footer"><span>{date} · 教学资料</span><span>{pageNumber}</span></footer>
  </article>
}

export function TeachingDocumentPreviewFrame({ scale, children }: { scale: number; children: ReactNode }) {
  const frameStyle = useMemo(() => ({ width: TEACHING_DOCUMENT_A4.widthPx * scale, height: TEACHING_DOCUMENT_A4.heightPx * scale }), [scale])
  const stageStyle = useMemo(() => ({ width: TEACHING_DOCUMENT_A4.widthPx, height: TEACHING_DOCUMENT_A4.heightPx, transform: `scale(${scale})`, transformOrigin: 'top left' as const }), [scale])
  return <div className="mx-auto overflow-hidden bg-white" style={frameStyle}><div style={stageStyle}>{children}</div></div>
}
