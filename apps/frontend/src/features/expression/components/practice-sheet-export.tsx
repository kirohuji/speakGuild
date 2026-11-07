import { forwardRef, useMemo, type ReactNode } from 'react'
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

export type PracticeSheetExportMode = 'zh-to-en' | 'en-to-zh' | 'bilingual'

export type PracticeSheetItem = {
  id: string
  type: string
  original: string | null
  corrected: string | null
  chunkText: string | null
  vocabulary?: { meaning?: string | null } | null
}

export const PRACTICE_SHEET_A4 = {
  widthPx: Math.round((210 * 96) / 25.4),
  heightPx: Math.round((297 * 96) / 25.4),
  widthMm: 210,
  heightMm: 297,
} as const

export function practiceSheetItemsPerPage(columns: 1 | 2) {
  return columns === 2 ? 24 : 14
}

const FONT_FAMILY = 'NotoSansSC'
let fontRegistered = false

function registerPracticeSheetFont() {
  if (fontRegistered || typeof window === 'undefined') return
  const regularSrc = new URL('/fonts/NotoSansSC-Regular.ttf', window.location.href).href
  const boldSrc = new URL('/fonts/NotoSansSC-Bold.otf', window.location.href).href
  Font.register({
    family: FONT_FAMILY,
    fonts: [
      { src: regularSrc, fontWeight: 400 },
      { src: boldSrc, fontWeight: 700 },
    ],
  })
  Font.registerHyphenationCallback((word) => {
    if (/[㐀-鿿぀-ヿ가-힯]/u.test(word)) return Array.from(word)
    if (word.length > 16) return word.match(/.{1,10}/gu) ?? [word]
    return [word]
  })
  fontRegistered = true
}

function glyphUnits(text: string) {
  let units = 0
  for (const char of text) units += char.charCodeAt(0) > 255 ? 1 : 0.55
  return units
}

/** 过长释义按分号、斜杠等切段，只保留放得下一行的前半，避免行高被撑开。 */
function clipSheetText(value: string, maxUnits: number) {
  const text = value.replace(/\s+/g, ' ').trim()
  if (!text || glyphUnits(text) <= maxUnits) return text
  const firstSense = text.split(/[;；|｜/／]/).map((part) => part.trim()).find(Boolean) ?? text
  const source = glyphUnits(firstSense) <= maxUnits
    ? firstSense
    : (firstSense.split(/[，,、]/).map((part) => part.trim()).find(Boolean) ?? firstSense)
  if (glyphUnits(source) <= maxUnits) return source
  let units = 0
  let end = 0
  for (const char of source) {
    const next = units + (char.charCodeAt(0) > 255 ? 1 : 0.55)
    if (next > maxUnits) break
    units = next
    end += char.length
  }
  return source.slice(0, end).trim()
}

function itemTexts(item: PracticeSheetItem) {
  const english = item.type === 'word' ? (item.original ?? '') : (item.chunkText ?? item.corrected ?? '')
  const chinese = item.type === 'word' ? (item.vocabulary?.meaning ?? item.corrected ?? '') : (item.original ?? '')
  return { english, chinese }
}

function promptFor(
  item: PracticeSheetItem,
  mode: PracticeSheetExportMode,
  columns: 1 | 2,
) {
  const { english, chinese } = itemTexts(item)
  const wide = columns === 2 ? 16 : 34
  const narrow = columns === 2 ? 14 : 28
  if (mode === 'zh-to-en') return clipSheetText(chinese, wide)
  return clipSheetText(english, narrow)
}

function answerFor(item: PracticeSheetItem, mode: PracticeSheetExportMode, columns: 1 | 2) {
  if (mode !== 'bilingual') return ''
  return clipSheetText(itemTexts(item).chinese, columns === 2 ? 16 : 34)
}

function promptHeaderFor(
  mode: PracticeSheetExportMode,
  labels: { bilingual: string; english: string; chinese: string },
) {
  if (mode === 'bilingual') {
    return labels.english
  }
  return mode === 'zh-to-en' ? labels.chinese : labels.english
}

function paginateItems<T>(items: T[], perPage: number) {
  return Array.from(
    { length: Math.max(1, Math.ceil(items.length / perPage)) },
    (_, index) => items.slice(index * perPage, (index + 1) * perPage),
  )
}

function splitColumns(pageItems: PracticeSheetItem[], columns: 1 | 2) {
  if (columns !== 2) return [pageItems]
  const splitAt = Math.ceil(pageItems.length / 2)
  return [pageItems.slice(0, splitAt), pageItems.slice(splitAt)]
}

const SHEET_CSS = `
.practice-sheet {
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  width: ${PRACTICE_SHEET_A4.widthPx}px;
  height: ${PRACTICE_SHEET_A4.heightPx}px;
  padding: 72px 44px 60px;
  overflow: hidden;
  color: #1f2d3d;
  background: #fff;
  font-family: "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.practice-sheet-watermark {
  position: absolute;
  left: 10%;
  top: 43%;
  width: 80%;
  transform: rotate(-28deg);
  color: #eaf4ff;
  font-size: 48px;
  font-weight: 700;
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
}
.practice-sheet-header {
  position: absolute;
  left: 44px;
  right: 44px;
  top: 24px;
  height: 34px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #dce5ef;
  padding-bottom: 9px;
  color: #1f2d3d;
}
.practice-sheet-logo { width: 27px; height: 27px; object-fit: contain; }
.practice-sheet-brand { margin-left: 9px; font-size: 11px; font-weight: 700; white-space: nowrap; }
.practice-sheet-head-title {
  min-width: 0;
  margin-left: auto;
  max-width: 48%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  font-size: 11px;
  color: #5f6f82;
}
.practice-sheet *,
.practice-sheet *::before,
.practice-sheet *::after { box-sizing: border-box; }
.practice-sheet-body {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  gap: 12px;
  margin-top: 0;
  align-content: start;
}
.practice-sheet-body.is-two-cols { grid-template-columns: 1fr 1fr; }
.practice-sheet-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 13px;
}
.practice-sheet-table col.idx { width: 6%; }
.practice-sheet-table col.prompt { width: 24%; }
.practice-sheet-table col.answer { width: 62%; }
.practice-sheet-table col.check { width: 8%; }
.practice-sheet-table.is-zh-prompt col.prompt { width: 62%; }
.practice-sheet-table.is-zh-prompt col.answer { width: 24%; }
.practice-sheet-table th,
.practice-sheet-table td {
  border: 1px solid #dce5ef;
  padding: 8px 8px;
  vertical-align: middle;
  line-height: 1.5;
  height: 38px;
  overflow: hidden;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.practice-sheet-table thead th {
  background: #f4f9ff;
  font-weight: 650;
  color: #1f2d3d;
}
.practice-sheet-table .is-center { text-align: center; }
.practice-sheet-table .is-muted { color: #5f6f82; }
.practice-sheet-table .prompt-text {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  line-height: 1.5;
  font-weight: 500;
}
.practice-sheet-footer {
  position: absolute;
  left: 44px;
  right: 44px;
  bottom: 24px;
  display: flex;
  justify-content: space-between;
  border-top: 1px solid #dce5ef;
  padding-top: 9px;
  font-size: 10px;
  line-height: 1.45;
  color: #5f6f82;
}
`

const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    color: '#1f2d3d',
    paddingTop: 54,
    paddingBottom: 48,
    paddingHorizontal: 34,
  },
  watermark: {
    position: 'absolute',
    top: '43%',
    left: '13%',
    width: '74%',
    textAlign: 'center',
    transform: 'rotate(-28deg)',
    fontSize: 36,
    fontWeight: 700,
    color: '#eaf4ff',
  },
  header: {
    position: 'absolute',
    top: 18,
    left: 34,
    right: 34,
    height: 25,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0.7,
    borderBottomColor: '#dce5ef',
    paddingBottom: 7,
  },
  logo: { width: 20, height: 20, objectFit: 'contain' },
  brand: { marginLeft: 7, fontSize: 8.5, fontWeight: 700, color: '#1f2d3d' },
  headerTitle: { flexGrow: 1, textAlign: 'right', fontSize: 8.5, color: '#5f6f82' },
  body: {
    flexGrow: 1,
  },
  twoCols: {
    flexDirection: 'row',
  },
  col: {
    flexGrow: 1,
    flexBasis: 0,
  },
  colGap: {
    marginRight: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 28,
  },
  // 只画右/下边，首行补上边、首列补左边，避免相邻格子双边框叠粗。
  cell: {
    borderColor: '#dce5ef',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 5,
    justifyContent: 'center',
  },
  cellTop: { borderTopWidth: 1 },
  cellLeft: { borderLeftWidth: 1 },
  th: {
    backgroundColor: '#f4f9ff',
  },
  td: {
    backgroundColor: '#ffffff',
  },
  idx: { width: '6%', alignItems: 'center' },
  prompt: { width: '24%', alignItems: 'center' },
  promptWide: { width: '62%' },
  answer: { width: '62%' },
  answerNarrow: { width: '24%', alignItems: 'center' },
  check: { width: '8%', alignItems: 'center' },
  // NotoSansSC 不含 □，用边框画勾选框，避免 PDF 落成乱码/i。
  checkbox: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: '#71717a',
  },
  cellText: {
    fontSize: 11,
    lineHeight: 1.45,
  },
  cellTextMuted: {
    fontSize: 11,
    lineHeight: 1.45,
    color: '#5f6f82',
  },
  cellTextStrong: {
    fontSize: 11,
    lineHeight: 1.45,
    fontWeight: 700,
  },
  centerText: {
    textAlign: 'center',
    width: '100%',
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 34,
    right: 34,
    paddingTop: 7,
    borderTopWidth: 0.7,
    borderTopColor: '#dce5ef',
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#5f6f82',
  },
})

export type PracticeSheetPdfLabels = {
  bilingual: string
  english: string
  chinese: string
  answer: string
  date: string
}

export type PracticeSheetPdfInput = {
  items: PracticeSheetItem[]
  columns: 1 | 2
  mode: PracticeSheetExportMode
  notebookName: string
  modeTitle: string
  hint: string
  dateValue: string
  materialLabel: string
  labels: PracticeSheetPdfLabels
  pageNumber: (current: number, total: number) => string
}

function PracticeSheetPdfTable({
  tableItems,
  tableIndex,
  pageIndex,
  itemsPerPage,
  columns,
  mode,
  splitAt,
  rowsPerColumn,
  labels,
}: {
  tableItems: PracticeSheetItem[]
  tableIndex: number
  pageIndex: number
  itemsPerPage: number
  columns: 1 | 2
  mode: PracticeSheetExportMode
  splitAt: number
  rowsPerColumn: number
  labels: PracticeSheetPdfLabels
}) {
  const header = promptHeaderFor(mode, labels)
  const chinesePrompt = mode === 'zh-to-en'
  const emptyRows = Math.max(0, rowsPerColumn - tableItems.length)
  const cellStyle = (isHeader: boolean, isFirstRow: boolean, colIndex: number) => [
    pdfStyles.cell,
    isHeader ? pdfStyles.th : pdfStyles.td,
    isFirstRow ? pdfStyles.cellTop : undefined,
    colIndex === 0 ? pdfStyles.cellLeft : undefined,
    colIndex === 0 ? pdfStyles.idx : colIndex === 1 ? (chinesePrompt ? pdfStyles.promptWide : pdfStyles.prompt) : colIndex === 2 ? (chinesePrompt ? pdfStyles.answerNarrow : pdfStyles.answer) : pdfStyles.check,
  ]
  const promptTextStyle = chinesePrompt ? pdfStyles.cellText : [pdfStyles.cellText, pdfStyles.centerText]
  const promptHeaderStyle = chinesePrompt ? pdfStyles.cellTextStrong : [pdfStyles.cellTextStrong, pdfStyles.centerText]
  const answerTextStyle = chinesePrompt ? [pdfStyles.cellText, pdfStyles.centerText] : pdfStyles.cellText
  const answerHeaderStyle = chinesePrompt ? [pdfStyles.cellTextStrong, pdfStyles.centerText] : pdfStyles.cellTextStrong

  return (
    <View style={[pdfStyles.col, columns === 2 && tableIndex === 0 ? pdfStyles.colGap : undefined]}>
      <View style={pdfStyles.row}>
        <View style={cellStyle(true, true, 0)}>
          <Text style={pdfStyles.cellTextStrong}>#</Text>
        </View>
        <View style={cellStyle(true, true, 1)}>
          <Text style={promptHeaderStyle}>{header}</Text>
        </View>
        <View style={cellStyle(true, true, 2)}>
          <Text style={answerHeaderStyle}>{labels.answer}</Text>
        </View>
        <View style={cellStyle(true, true, 3)}>
          <View style={pdfStyles.checkbox} />
        </View>
      </View>

      {tableItems.map((item, index) => {
        const absoluteIndex = pageIndex * itemsPerPage + (tableIndex === 0 ? index : splitAt + index)
        const { english } = itemTexts(item)
        const prompt = promptFor(item, mode, columns) || english
        const answer = answerFor(item, mode, columns)
        return (
          <View key={item.id} style={pdfStyles.row} wrap={false}>
            <View style={cellStyle(false, false, 0)}>
              <Text style={pdfStyles.cellTextMuted}>{absoluteIndex + 1}</Text>
            </View>
            <View style={cellStyle(false, false, 1)}>
              <Text style={promptTextStyle}>{prompt}</Text>
            </View>
            <View style={cellStyle(false, false, 2)}>
              <Text style={answerTextStyle}>{answer || ' '}</Text>
            </View>
            <View style={cellStyle(false, false, 3)}>
              <View style={pdfStyles.checkbox} />
            </View>
          </View>
        )
      })}

      {Array.from({ length: emptyRows }, (_, index) => (
        <View key={`pad-${tableIndex}-${index}`} style={pdfStyles.row} wrap={false}>
          <View style={cellStyle(false, false, 0)}><Text style={pdfStyles.cellText}> </Text></View>
          <View style={cellStyle(false, false, 1)}><Text style={pdfStyles.cellText}> </Text></View>
          <View style={cellStyle(false, false, 2)}><Text style={pdfStyles.cellText}> </Text></View>
          <View style={cellStyle(false, false, 3)}><Text style={pdfStyles.cellText}> </Text></View>
        </View>
      ))}
    </View>
  )
}

function PracticeSheetPdfDocument({
  items,
  columns,
  mode,
  notebookName,
  modeTitle,
  hint,
  dateValue,
  materialLabel,
  labels,
  pageNumber,
  logoUrl,
}: PracticeSheetPdfInput & { logoUrl: string }) {
  const itemsPerPage = practiceSheetItemsPerPage(columns)
  const pages = paginateItems(items, itemsPerPage)
  const rowsPerColumn = columns === 2 ? Math.ceil(itemsPerPage / 2) : itemsPerPage

  return (
    <Document title={`${notebookName} · ${modeTitle}`} author="漫语町 · ManYuDing" subject={hint}>
      {pages.map((pageItems, pageIndex) => {
        const splitAt = columns === 2 ? Math.ceil(pageItems.length / 2) : pageItems.length
        const columnGroups = splitColumns(pageItems, columns)
        return (
          <Page key={pageIndex} size="A4" style={pdfStyles.page}>
            <Text style={pdfStyles.watermark}>漫语町 · ManYuDing</Text>
            <View style={pdfStyles.header}>
              <Image style={pdfStyles.logo} src={logoUrl} />
              <Text style={pdfStyles.brand}>漫语町 · ManYuDing</Text>
              <Text style={pdfStyles.headerTitle}>{notebookName}</Text>
            </View>
            <View style={[pdfStyles.body, columns === 2 ? pdfStyles.twoCols : undefined]}>
              {columnGroups.map((tableItems, tableIndex) => (
                <PracticeSheetPdfTable
                  key={tableIndex}
                  tableItems={tableItems}
                  tableIndex={tableIndex}
                  pageIndex={pageIndex}
                  itemsPerPage={itemsPerPage}
                  columns={columns}
                  mode={mode}
                  splitAt={splitAt}
                  rowsPerColumn={rowsPerColumn}
                  labels={labels}
                />
              ))}
            </View>

            <View style={pdfStyles.footer}>
              <Text>{dateValue} · {materialLabel}</Text>
              <Text>{pageNumber(pageIndex + 1, pages.length)}</Text>
            </View>
          </Page>
        )
      })}
    </Document>
  )
}

export async function buildPracticeSheetPdfBlob(input: PracticeSheetPdfInput): Promise<Blob> {
  registerPracticeSheetFont()
  const logoUrl = new URL('/logo.png', window.location.href).href
  return pdf(<PracticeSheetPdfDocument {...input} logoUrl={logoUrl} />).toBlob()
}

export const PracticeSheetPage = forwardRef<HTMLElement, {
  pageItems: PracticeSheetItem[]
  pageIndex: number
  itemsPerPage: number
  columns: 1 | 2
  mode: PracticeSheetExportMode
  notebookName: string
  modeTitle: string
  hint: string
  dateLabel: string
  dateValue: string
  materialLabel: string
  onDateChange: (value: string) => void
  pageNumber: string
  labels: {
    bilingual: string
    english: string
    chinese: string
    answer: string
  }
}>(function PracticeSheetPage({
  pageItems,
  pageIndex,
  itemsPerPage,
  columns,
  mode,
  notebookName,
  modeTitle,
  dateValue,
  materialLabel,
  pageNumber,
  labels,
}, ref) {
  const splitAt = columns === 2 ? Math.ceil(pageItems.length / 2) : pageItems.length
  const columnGroups = columns === 2
    ? [pageItems.slice(0, splitAt), pageItems.slice(splitAt)]
    : [pageItems]
  const rowsPerColumn = columns === 2 ? Math.ceil(itemsPerPage / 2) : itemsPerPage
  return (
    <article
      ref={ref}
      className="practice-sheet"
      data-practice-sheet-page={pageIndex}
      aria-label={`${notebookName} · ${modeTitle}`}
    >
      <style>{SHEET_CSS}</style>
      <div className="practice-sheet-watermark" aria-hidden>漫语町 · ManYuDing</div>
      <header className="practice-sheet-header">
        <img className="practice-sheet-logo" src="/logo.png" alt="" />
        <span className="practice-sheet-brand">漫语町 · ManYuDing</span>
        <span className="practice-sheet-head-title">{notebookName}</span>
      </header>

      <div className={columns === 2 ? 'practice-sheet-body is-two-cols' : 'practice-sheet-body'}>
        {columnGroups.map((tableItems, tableIndex) => {
          const emptyRows = Math.max(0, rowsPerColumn - tableItems.length)
          const chinesePrompt = mode === 'zh-to-en'
          return (
            <table key={tableIndex} className={chinesePrompt ? 'practice-sheet-table is-zh-prompt' : 'practice-sheet-table'}>
              <colgroup>
                <col className="idx" />
                <col className="prompt" />
                <col className="answer" />
                <col className="check" />
              </colgroup>
              <thead>
                <tr>
                  <th className="is-center">#</th>
                  <th className={chinesePrompt ? undefined : 'is-center'}>{promptHeaderFor(mode, labels)}</th>
                  <th className={chinesePrompt ? 'is-center' : undefined}>{labels.answer}</th>
                  <th className="is-center">□</th>
                </tr>
              </thead>
              <tbody>
                {tableItems.map((item, index) => {
                  const absoluteIndex = pageIndex * itemsPerPage + (tableIndex === 0 ? index : splitAt + index)
                  const prompt = promptFor(item, mode, columns)
                  const { english } = itemTexts(item)
                  const answer = answerFor(item, mode, columns)
                  return (
                    <tr key={item.id}>
                      <td className="is-center is-muted">{absoluteIndex + 1}</td>
                      <td className={chinesePrompt ? undefined : 'is-center'}>
                        <span className="prompt-text">{prompt || english}</span>
                      </td>
                      <td className={chinesePrompt ? 'is-center' : undefined}>{answer ? <span className="prompt-text">{answer}</span> : null}</td>
                      <td className="is-center is-muted">□</td>
                    </tr>
                  )
                })}
                {Array.from({ length: emptyRows }, (_, index) => (
                  <tr key={`pad-${tableIndex}-${index}`}>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        })}
      </div>

      <footer className="practice-sheet-footer"><span>{dateValue} · {materialLabel}</span><span>{pageNumber}</span></footer>
    </article>
  )
})

export function PracticeSheetPreviewFrame({
  scale,
  children,
}: {
  scale: number
  children: ReactNode
}) {
  const frameStyle = useMemo(() => ({
    width: PRACTICE_SHEET_A4.widthPx * scale,
    height: PRACTICE_SHEET_A4.heightPx * scale,
  }), [scale])

  const stageStyle = useMemo(() => ({
    width: PRACTICE_SHEET_A4.widthPx,
    height: PRACTICE_SHEET_A4.heightPx,
    transform: `scale(${scale})`,
    transformOrigin: 'top left' as const,
  }), [scale])

  return (
    <div className="mx-auto overflow-hidden bg-white" style={frameStyle}>
      <div style={stageStyle}>{children}</div>
    </div>
  )
}
