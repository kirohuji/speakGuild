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
import { Buffer } from 'buffer'

export const TEACHING_DOCUMENT_A4 = {
  widthPx: Math.round((210 * 96) / 25.4),
  heightPx: Math.round((297 * 96) / 25.4),
} as const

type TeachingBlock = {
  id: string
  kind: 'heading' | 'paragraph' | 'list' | 'quote' | 'code' | 'rule' | 'table'
  text: string
  level?: 1 | 2 | 3 | 4 | 5 | 6
  headers?: string[]
  rows?: string[][]
}

export type TeachingDocumentPageData = TeachingBlock[]

const FONT_FAMILY = 'NotoSansSC'
const BRAND_NAME = '漫语町 · ManYuDing'
let fontRegistered = false

function ensurePdfBrowserGlobals() {
  if (typeof window === 'undefined') return
  const browserGlobal = globalThis as typeof globalThis & { Buffer?: typeof Buffer }
  browserGlobal.Buffer ??= Buffer
}

function registerFont() {
  if (fontRegistered || typeof window === 'undefined') return
  const regularSrc = new URL('/fonts/NotoSansSC-Regular.ttf', window.location.href).href
  const boldSrc = new URL('/fonts/NotoSansSC-Bold.otf', window.location.href).href
  Font.register({ family: FONT_FAMILY, fonts: [{ src: regularSrc, fontWeight: 400 }, { src: boldSrc, fontWeight: 700 }] })
  // react-pdf treats a consecutive CJK string as one "word". Returning the
  // whole value here made that string (and long URLs / identifiers) impossible
  // to wrap, so content beyond the right edge was clipped from the PDF.
  Font.registerHyphenationCallback((word) => {
    if (/[㐀-鿿぀-ヿ가-힯]/u.test(word)) return Array.from(word)
    if (word.length > 20) return word.match(/.{1,12}/gu) ?? [word]
    return [word]
  })
  fontRegistered = true
}

function normalizeInlineMarkdown(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1')
    .trim()
}

function plainInlineText(value: string) {
  return normalizeInlineMarkdown(value)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
}

function tableCells(line: string) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => normalizeInlineMarkdown(cell))
}

function isTableDivider(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

function parseTeachingMarkdown(markdown: string): TeachingBlock[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const blocks: TeachingBlock[] = []
  let paragraph: string[] = []
  let list: string[] = []
  let code: string[] = []
  let tableHeaders: string[] | undefined
  let tableRows: string[][] = []
  let inCode = false

  const push = (kind: Exclude<TeachingBlock['kind'], 'table'>, text: string, level?: 1 | 2 | 3 | 4 | 5 | 6) => {
    const clean = kind === 'code' ? text.trim() : normalizeInlineMarkdown(text)
    if (clean) blocks.push({ id: `block-${blocks.length}`, kind, text: clean, level })
  }
  const flushParagraph = () => { if (paragraph.length) push('paragraph', paragraph.join(' ')); paragraph = [] }
  const flushList = () => { if (list.length) push('list', list.join('\n')); list = [] }
  const flushTable = () => {
    if (tableHeaders?.length) blocks.push({ id: `block-${blocks.length}`, kind: 'table', text: '', headers: tableHeaders, rows: tableRows })
    tableHeaders = undefined
    tableRows = []
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!
    const tableRow = /^\s*\|.*\|\s*$/.test(line)
    if (tableHeaders && !tableRow) flushTable()
    if (/^\s*(`{3,}|~{3,})/.test(line)) {
      flushParagraph(); flushList(); flushTable()
      if (inCode) { push('code', code.join('\n')); code = [] }
      inCode = !inCode
      continue
    }
    if (inCode) { code.push(line); continue }
    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (heading) {
      flushParagraph(); flushList(); flushTable()
      push('heading', heading[2], heading[1].length as 1 | 2 | 3 | 4 | 5 | 6)
      continue
    }
    if (/^\s*(---+|___+|\*\*\*+)\s*$/.test(line)) {
      flushParagraph(); flushList(); flushTable(); push('rule', '—')
      continue
    }
    const listItem = line.match(/^\s*([-+*]|\d+[.)])\s+(.+)$/)
    if (listItem) {
      flushParagraph(); flushTable()
      const marker = /^\d/.test(listItem[1]) ? listItem[1] : '•'
      list.push(`${marker} ${normalizeInlineMarkdown(listItem[2])}`)
      continue
    }
    const quote = line.match(/^\s*>\s?(.*)$/)
    if (quote) {
      flushParagraph(); flushList(); flushTable(); push('quote', quote[1])
      continue
    }
    if (tableRow && isTableDivider(lines[index + 1] ?? '')) {
      flushParagraph(); flushList()
      tableHeaders = tableCells(line)
      index += 1
      continue
    }
    if (tableHeaders && tableRow) {
      tableRows.push(tableCells(line))
      continue
    }
    if (!line.trim()) { flushParagraph(); flushList(); flushTable(); continue }
    paragraph.push(line.trim())
  }
  flushParagraph(); flushList(); flushTable()
  if (code.length) push('code', code.join('\n'))
  return blocks
}

function estimatedLines(block: TeachingBlock) {
  if (block.kind === 'rule') return 1.2
  if (block.kind === 'table') {
    const rows = [block.headers ?? [], ...(block.rows ?? [])]
    return rows.reduce((sum, row) => sum + Math.max(1.5, ...row.map((cell) => Math.ceil(cell.length / 16))) * 1.25, 1) + 1
  }
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
  return heading ? plainInlineText(heading.text) : fallback
}

const styles = StyleSheet.create({
  page: { fontFamily: FONT_FAMILY, color: '#1f2d3d', paddingTop: 54, paddingBottom: 48, paddingHorizontal: 34, fontSize: 9.5 },
  watermark: { position: 'absolute', top: '43%', left: '13%', width: '74%', textAlign: 'center', transform: 'rotate(-28deg)', fontSize: 36, fontWeight: 700, color: '#eaf4ff' },
  header: { position: 'absolute', top: 18, left: 34, right: 34, height: 25, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.7, borderBottomColor: '#dce5ef', paddingBottom: 7 },
  logo: { width: 20, height: 20, objectFit: 'contain' },
  brand: { marginLeft: 7, fontSize: 8.5, fontWeight: 700, color: '#1f2d3d' },
  headerTitle: { flexGrow: 1, textAlign: 'right', fontSize: 8.5, color: '#5f6f82' },
  footer: { position: 'absolute', bottom: 18, left: 34, right: 34, paddingTop: 7, borderTopWidth: 0.7, borderTopColor: '#dce5ef', flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: '#5f6f82' },
  h1: { fontSize: 18, lineHeight: 1.35, fontWeight: 700, color: '#1f2d3d', marginBottom: 10 },
  h2: { fontSize: 12.5, lineHeight: 1.4, fontWeight: 700, color: '#1f2d3d', marginTop: 7, marginBottom: 5 },
  h3: { fontSize: 10.5, lineHeight: 1.45, fontWeight: 700, color: '#002e5f', marginTop: 5, marginBottom: 3 },
  h4: { fontSize: 10, lineHeight: 1.45, fontWeight: 700, color: '#1f2d3d', marginTop: 5, marginBottom: 3 },
  h5: { fontSize: 9.5, lineHeight: 1.45, fontWeight: 700, color: '#1f2d3d', marginTop: 4, marginBottom: 2 },
  h6: { fontSize: 9.2, lineHeight: 1.45, fontWeight: 700, color: '#1f2d3d', marginTop: 4, marginBottom: 2 },
  paragraph: { fontSize: 9.5, lineHeight: 1.65, color: '#405063', marginBottom: 6 },
  list: { fontSize: 9.3, lineHeight: 1.65, color: '#405063', marginLeft: 10, marginBottom: 6 },
  quote: { fontSize: 9.2, lineHeight: 1.6, color: '#5f6f82', backgroundColor: '#f4f9ff', borderLeftWidth: 2.5, borderLeftColor: '#002e5f', paddingVertical: 6, paddingHorizontal: 9, marginBottom: 7 },
  code: { fontSize: 8, lineHeight: 1.5, color: '#1f2d3d', backgroundColor: '#e8eef5', padding: 8, marginBottom: 7 },
  rule: { borderTopWidth: 0.75, borderTopColor: '#dce5ef', marginVertical: 7 },
  inlineStrong: { fontWeight: 700 },
  inlineEmphasis: { fontStyle: 'italic' },
  inlineCode: { fontSize: 8.2, color: '#002e5f', backgroundColor: '#eaf4ff', paddingHorizontal: 2 },
  inlineStrike: { textDecoration: 'line-through', color: '#5f6f82' },
  inlineLink: { color: '#002e5f', textDecoration: 'underline' },
  table: { marginBottom: 9, borderWidth: 0.7, borderColor: '#dce5ef' },
  tableRow: { flexDirection: 'row' },
  tableHeaderRow: { backgroundColor: '#f4f9ff' },
  tableCell: { flexGrow: 1, flexBasis: 0, minWidth: 0, paddingVertical: 5, paddingHorizontal: 6, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#dce5ef' },
  tableCellLast: { borderRightWidth: 0 },
  tableCellBottom: { borderBottomWidth: 0 },
  tableCellText: { fontSize: 9.3, lineHeight: 1.5, color: '#5f6f82' },
  tableHeaderText: { fontSize: 9.5, lineHeight: 1.5, fontWeight: 700, color: '#1f2d3d' },
})

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]*\)|\*[^*]+\*|_[^_]+_)/g)
  return <>{parts.map((part, index) => {
    if (!part) return null
    if (/^\*\*[^*]+\*\*$|^__[^_]+__$/.test(part)) return <Text key={index} style={styles.inlineStrong}>{part.slice(2, -2)}</Text>
    if (/^~~[^~]+~~$/.test(part)) return <Text key={index} style={styles.inlineStrike}>{part.slice(2, -2)}</Text>
    if (/^`[^`]+`$/.test(part)) return <Text key={index} style={styles.inlineCode}>{part.slice(1, -1)}</Text>
    const link = part.match(/^\[([^\]]+)\]\([^)]*\)$/)
    if (link) return <Text key={index} style={styles.inlineLink}>{link[1]}</Text>
    if (/^\*[^*]+\*$|^_[^_]+_$/.test(part)) return <Text key={index} style={styles.inlineEmphasis}>{part.slice(1, -1)}</Text>
    return <Text key={index}>{part}</Text>
  })}</>
}

function PdfTable({ block }: { block: TeachingBlock }) {
  const headers = block.headers ?? []
  const rows = block.rows ?? []
  const columnCount = Math.max(headers.length, ...rows.map((row) => row.length), 1)
  const allRows = [headers, ...rows]
  return <View style={styles.table}>
    {allRows.map((row, rowIndex) => <View key={rowIndex} style={[styles.tableRow, rowIndex === 0 ? styles.tableHeaderRow : undefined]}>
      {Array.from({ length: columnCount }, (_, columnIndex) => <View key={columnIndex} style={[
        styles.tableCell,
        columnIndex === columnCount - 1 ? styles.tableCellLast : undefined,
        rowIndex === allRows.length - 1 ? styles.tableCellBottom : undefined,
      ]}><Text style={rowIndex === 0 ? styles.tableHeaderText : styles.tableCellText}><InlineMarkdown text={row[columnIndex] ?? ''} /></Text></View>)}
    </View>)}
  </View>
}

function PdfBlock({ block }: { block: TeachingBlock }) {
  if (block.kind === 'heading') {
    const level = block.level ?? 2
    const headingStyle = level === 1 ? styles.h1 : level === 2 ? styles.h2 : level === 3 ? styles.h3 : level === 4 ? styles.h4 : level === 5 ? styles.h5 : styles.h6
    return <Text style={headingStyle}><InlineMarkdown text={block.text} /></Text>
  }
  if (block.kind === 'rule') return <View style={styles.rule} />
  if (block.kind === 'table') return <PdfTable block={block} />
  if (block.kind === 'code') return <Text style={styles.code}>{block.text}</Text>
  return <Text style={styles[block.kind]}><InlineMarkdown text={block.text} /></Text>
}

function TeachingPdfDocument({ blocks, title, date, logoUrl }: { blocks: TeachingBlock[]; title: string; date: string; logoUrl: string }) {
  return <Document title={title} author={BRAND_NAME} subject="教学文档">
    <Page size="A4" style={styles.page}>
      <Text fixed style={styles.watermark}>{BRAND_NAME}</Text>
      <View fixed style={styles.header}>
        <Image style={styles.logo} src={logoUrl} />
        <Text style={styles.brand}>{BRAND_NAME}</Text>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      {blocks.map((block) => <PdfBlock key={block.id} block={block} />)}
      <View fixed style={styles.footer}>
        <Text>{date} · 教学资料</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  </Document>
}

export async function buildTeachingDocumentPdfBlob(input: { markdown: string; title: string; date: string }) {
  ensurePdfBrowserGlobals()
  registerFont()
  const blocks = parseTeachingMarkdown(input.markdown)
  const logoUrl = new URL('/logo.png', window.location.href).href
  return pdf(<TeachingPdfDocument blocks={blocks} title={input.title} date={input.date} logoUrl={logoUrl} />).toBlob()
}

const PREVIEW_CSS = `
.teaching-paper{box-sizing:border-box;position:relative;display:flex;flex-direction:column;width:${TEACHING_DOCUMENT_A4.widthPx}px;height:${TEACHING_DOCUMENT_A4.heightPx}px;padding:72px 44px 60px;color:#1c1917;background:#fff;font-family:"PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden}
.teaching-paper *{box-sizing:border-box}.teaching-paper-watermark{position:absolute;left:10%;top:43%;width:80%;transform:rotate(-28deg);text-align:center;font-size:48px;font-weight:700;color:#f4ede6;white-space:nowrap}.teaching-paper-header{position:absolute;left:44px;right:44px;top:24px;height:34px;display:flex;align-items:center;border-bottom:1px solid #e7e1da;padding-bottom:9px;color:#57534e}.teaching-paper-logo{width:27px;height:27px;object-fit:contain}.teaching-paper-brand{margin-left:9px;font-size:11px;font-weight:700}.teaching-paper-head-title{min-width:0;margin-left:auto;max-width:48%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right;font-size:11px;color:#78716c}.teaching-paper-body{position:relative;overflow-wrap:anywhere;word-break:break-word}.teaching-paper h1{margin:0 0 13px;font-size:24px;line-height:1.35}.teaching-paper h2{margin:9px 0 7px;font-size:17px;line-height:1.4;color:#9a3412}.teaching-paper h3{margin:6px 0 4px;font-size:14px;line-height:1.45;color:#44403c}.teaching-paper h4{margin:6px 0 4px;font-size:13px;line-height:1.45;color:#44403c}.teaching-paper h5,.teaching-paper h6{margin:5px 0 3px;font-size:12.5px;line-height:1.45;color:#57534e}.teaching-paper p,.teaching-paper pre,.teaching-paper blockquote{white-space:pre-wrap}.teaching-paper p{margin:0 0 8px;font-size:13px;line-height:1.65}.teaching-paper .list{margin-left:14px;font-size:12.5px}.teaching-paper blockquote{margin:0 0 9px;border-left:3px solid #fb923c;background:#faf7f2;padding:8px 12px;font-size:12.5px;line-height:1.6;color:#57534e}.teaching-paper pre{margin:0 0 9px;background:#f5f5f4;padding:11px;font:10.5px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;color:#44403c}.teaching-paper :not(pre)>code{border-radius:2px;background:#fef3c7;padding:1px 3px;color:#9a3412;font-size:.9em}.teaching-paper s{color:#78716c}.teaching-paper a{color:#9a3412;text-decoration:underline}.teaching-paper table{width:100%;margin:0 0 10px;border:1px solid #d6d3d1;border-collapse:collapse;font-size:12.5px;line-height:1.5}.teaching-paper th,.teaching-paper td{padding:6px 8px;vertical-align:top;border:1px solid #d6d3d1}.teaching-paper th{background:#fff7ed;color:#9a3412;font-size:13px;font-weight:700;text-align:left}.teaching-paper .rule{height:1px;margin:10px 0;border:0;background:#d6d3d1}.teaching-paper-footer{position:absolute;left:44px;right:44px;bottom:24px;display:flex;justify-content:space-between;border-top:1px solid #e7e1da;padding-top:9px;font-size:10px;color:#a8a29e}
.teaching-paper{color:#1f2d3d}.teaching-paper-watermark{color:#eaf4ff}.teaching-paper-header,.teaching-paper-footer{border-color:#dce5ef}.teaching-paper-brand,.teaching-paper h1,.teaching-paper h2,.teaching-paper h4,.teaching-paper h5,.teaching-paper h6{color:#1f2d3d}.teaching-paper-head-title,.teaching-paper-footer,.teaching-paper blockquote,.teaching-paper s{color:#5f6f82}.teaching-paper h3,.teaching-paper a{color:#002e5f}.teaching-paper p,.teaching-paper .list{color:#405063}.teaching-paper blockquote{border-left-color:#002e5f;background:#f4f9ff}.teaching-paper pre{color:#1f2d3d;background:#e8eef5}.teaching-paper :not(pre)>code{color:#002e5f;background:#eaf4ff}.teaching-paper table,.teaching-paper th,.teaching-paper td{border-color:#dce5ef}.teaching-paper th{background:#f4f9ff;color:#1f2d3d}.teaching-paper td{color:#5f6f82}.teaching-paper .rule{background:#dce5ef}
`

function PreviewInlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]*\)|\*[^*]+\*|_[^_]+_)/g)
  return <>{parts.map((part, index) => {
    if (!part) return null
    if (/^\*\*[^*]+\*\*$|^__[^_]+__$/.test(part)) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (/^~~[^~]+~~$/.test(part)) return <s key={index}>{part.slice(2, -2)}</s>
    if (/^`[^`]+`$/.test(part)) return <code key={index}>{part.slice(1, -1)}</code>
    const link = part.match(/^\[([^\]]+)\]\(([^)]*)\)$/)
    if (link) return <a key={index} href={link[2]}>{link[1]}</a>
    if (/^\*[^*]+\*$|^_[^_]+_$/.test(part)) return <em key={index}>{part.slice(1, -1)}</em>
    return part
  })}</>
}

function PreviewBlock({ block }: { block: TeachingBlock }) {
  if (block.kind === 'heading') {
    const Tag = `h${block.level ?? 2}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
    return <Tag><PreviewInlineMarkdown text={block.text} /></Tag>
  }
  if (block.kind === 'quote') return <blockquote><PreviewInlineMarkdown text={block.text} /></blockquote>
  if (block.kind === 'code') return <pre>{block.text}</pre>
  if (block.kind === 'rule') return <div className="rule" aria-hidden />
  if (block.kind === 'table') return <table><thead><tr>{(block.headers ?? []).map((header, index) => <th key={index}><PreviewInlineMarkdown text={header} /></th>)}</tr></thead><tbody>{(block.rows ?? []).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, columnIndex) => <td key={columnIndex}><PreviewInlineMarkdown text={cell} /></td>)}</tr>)}</tbody></table>
  return <p className={block.kind}><PreviewInlineMarkdown text={block.text} /></p>
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
