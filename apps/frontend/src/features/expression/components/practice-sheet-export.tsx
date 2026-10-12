import { forwardRef, useMemo, type ReactNode } from 'react'
import {
  Document,
  Font,
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
  const src = new URL('/fonts/NotoSansSC-Regular.ttf', window.location.href).href
  Font.register({
    family: FONT_FAMILY,
    fonts: [
      { src, fontWeight: 400 },
      { src, fontWeight: 700 },
    ],
  })
  Font.registerHyphenationCallback((word) => [word])
  fontRegistered = true
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
  tableIndex: number,
) {
  const { english, chinese } = itemTexts(item)
  if (mode === 'bilingual') {
    if (columns === 1) return `${english} · ${chinese}`
    return tableIndex === 0 ? english : chinese
  }
  return mode === 'zh-to-en' ? chinese : english
}

function promptHeaderFor(
  mode: PracticeSheetExportMode,
  columns: 1 | 2,
  tableIndex: number,
  labels: { bilingual: string; english: string; chinese: string },
) {
  if (mode === 'bilingual') {
    if (columns === 1) return labels.bilingual
    return tableIndex === 0 ? labels.english : labels.chinese
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
  display: flex;
  flex-direction: column;
  width: ${PRACTICE_SHEET_A4.widthPx}px;
  height: ${PRACTICE_SHEET_A4.heightPx}px;
  padding: 28px 32px 22px;
  color: #111;
  background: #fff;
  font-family: "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.practice-sheet *,
.practice-sheet *::before,
.practice-sheet *::after { box-sizing: border-box; }
.practice-sheet-header {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2.4fr) minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.14);
}
.practice-sheet-header-spacer {
  visibility: hidden;
  white-space: nowrap;
  font-size: 11px;
  line-height: 1.45;
}
.practice-sheet-title-wrap { min-width: 0; text-align: center; padding: 0 4px; }
.practice-sheet-title {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  line-height: 1.45;
}
.practice-sheet-hint {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(0, 0, 0, 0.62);
}
.practice-sheet-date {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  min-height: 28px;
  white-space: nowrap;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(0, 0, 0, 0.62);
}
.practice-sheet-date input {
  width: 108px;
  height: 28px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #111;
  font: inherit;
  line-height: 1.45;
  outline: none;
}
.practice-sheet-body {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  gap: 12px;
  margin-top: 14px;
  align-content: start;
}
.practice-sheet-body.is-two-cols { grid-template-columns: 1fr 1fr; }
.practice-sheet-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 12px;
}
.practice-sheet-table col.idx { width: 8%; }
.practice-sheet-table col.prompt { width: 42%; }
.practice-sheet-table col.answer { width: 42%; }
.practice-sheet-table col.check { width: 8%; }
.practice-sheet-table th,
.practice-sheet-table td {
  border: 1px solid #fdba8c;
  padding: 10px 8px;
  vertical-align: middle;
  line-height: 1.45;
  height: auto;
  overflow: visible;
}
.practice-sheet-table thead th {
  background: #ffedd5;
  font-weight: 650;
  color: #111;
}
.practice-sheet-table .is-center { text-align: center; }
.practice-sheet-table .is-muted { color: rgba(0, 0, 0, 0.55); }
.practice-sheet-table .prompt-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.45;
  font-weight: 560;
}
.practice-sheet-footer {
  flex: 0 0 auto;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  text-align: right;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(0, 0, 0, 0.58);
}
`

const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    color: '#111111',
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#d4d4d8',
  },
  headerSide: {
    width: '22%',
  },
  headerCenter: {
    width: '56%',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    textAlign: 'center',
    lineHeight: 1.4,
  },
  hint: {
    marginTop: 4,
    fontSize: 9,
    color: '#52525b',
    textAlign: 'center',
    lineHeight: 1.4,
  },
  date: {
    fontSize: 9,
    color: '#52525b',
    textAlign: 'right',
    lineHeight: 1.4,
  },
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
    minHeight: 24,
  },
  // 只画右/下边，首行补上边、首列补左边，避免相邻格子双边框叠粗。
  cell: {
    borderColor: '#fdba8c',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 5,
    justifyContent: 'center',
  },
  cellTop: { borderTopWidth: 1 },
  cellLeft: { borderLeftWidth: 1 },
  th: {
    backgroundColor: '#ffedd5',
  },
  td: {
    backgroundColor: '#ffffff',
  },
  idx: { width: '10%', alignItems: 'center' },
  prompt: { width: '42%' },
  answer: { width: '38%' },
  check: { width: '10%', alignItems: 'center' },
  cellText: {
    fontSize: 10,
    lineHeight: 1.35,
  },
  cellTextMuted: {
    fontSize: 10,
    lineHeight: 1.35,
    color: '#71717a',
  },
  cellTextStrong: {
    fontSize: 10,
    lineHeight: 1.35,
    fontWeight: 700,
  },
  footer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e4e4e7',
    fontSize: 9,
    color: '#71717a',
    textAlign: 'right',
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
  const header = promptHeaderFor(mode, columns, tableIndex, labels)
  const emptyRows = Math.max(0, rowsPerColumn - tableItems.length)
  const cellStyle = (isHeader: boolean, isFirstRow: boolean, colIndex: number) => [
    pdfStyles.cell,
    isHeader ? pdfStyles.th : pdfStyles.td,
    isFirstRow ? pdfStyles.cellTop : undefined,
    colIndex === 0 ? pdfStyles.cellLeft : undefined,
    colIndex === 0 ? pdfStyles.idx : colIndex === 1 ? pdfStyles.prompt : colIndex === 2 ? pdfStyles.answer : pdfStyles.check,
  ]

  return (
    <View style={[pdfStyles.col, columns === 2 && tableIndex === 0 ? pdfStyles.colGap : undefined]}>
      <View style={pdfStyles.row}>
        <View style={cellStyle(true, true, 0)}>
          <Text style={pdfStyles.cellTextStrong}>#</Text>
        </View>
        <View style={cellStyle(true, true, 1)}>
          <Text style={pdfStyles.cellTextStrong}>{header}</Text>
        </View>
        <View style={cellStyle(true, true, 2)}>
          <Text style={pdfStyles.cellTextStrong}>{labels.answer}</Text>
        </View>
        <View style={cellStyle(true, true, 3)}>
          <Text style={pdfStyles.cellTextStrong}>□</Text>
        </View>
      </View>

      {tableItems.map((item, index) => {
        const absoluteIndex = pageIndex * itemsPerPage + (tableIndex === 0 ? index : splitAt + index)
        const { english } = itemTexts(item)
        const prompt = promptFor(item, mode, columns, tableIndex) || english
        return (
          <View key={item.id} style={pdfStyles.row} wrap={false}>
            <View style={cellStyle(false, false, 0)}>
              <Text style={pdfStyles.cellTextMuted}>{absoluteIndex + 1}</Text>
            </View>
            <View style={cellStyle(false, false, 1)}>
              <Text style={pdfStyles.cellText}>{prompt}</Text>
            </View>
            <View style={cellStyle(false, false, 2)}>
              <Text style={pdfStyles.cellText}> </Text>
            </View>
            <View style={cellStyle(false, false, 3)}>
              <Text style={pdfStyles.cellTextMuted}>□</Text>
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
  labels,
  pageNumber,
}: PracticeSheetPdfInput) {
  const itemsPerPage = practiceSheetItemsPerPage(columns)
  const pages = paginateItems(items, itemsPerPage)
  const rowsPerColumn = columns === 2 ? Math.ceil(itemsPerPage / 2) : itemsPerPage

  return (
    <Document>
      {pages.map((pageItems, pageIndex) => {
        const splitAt = columns === 2 ? Math.ceil(pageItems.length / 2) : pageItems.length
        const columnGroups = splitColumns(pageItems, columns)
        return (
          <Page key={pageIndex} size="A4" style={pdfStyles.page}>
            <View style={pdfStyles.header}>
              <View style={pdfStyles.headerSide} />
              <View style={pdfStyles.headerCenter}>
                <Text style={pdfStyles.title}>{notebookName} · {modeTitle}</Text>
                <Text style={pdfStyles.hint}>{hint}</Text>
              </View>
              <View style={pdfStyles.headerSide}>
                <Text style={pdfStyles.date}>{labels.date} {dateValue}</Text>
              </View>
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

            <Text style={pdfStyles.footer}>{pageNumber(pageIndex + 1, pages.length)}</Text>
          </Page>
        )
      })}
    </Document>
  )
}

export async function buildPracticeSheetPdfBlob(input: PracticeSheetPdfInput): Promise<Blob> {
  registerPracticeSheetFont()
  return pdf(<PracticeSheetPdfDocument {...input} />).toBlob()
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
  hint,
  dateLabel,
  dateValue,
  onDateChange,
  pageNumber,
  labels,
}, ref) {
  const splitAt = columns === 2 ? Math.ceil(pageItems.length / 2) : pageItems.length
  const columnGroups = columns === 2
    ? [pageItems.slice(0, splitAt), pageItems.slice(splitAt)]
    : [pageItems]
  const rowsPerColumn = columns === 2 ? Math.ceil(itemsPerPage / 2) : itemsPerPage
  const dateSpacer = `${dateLabel} 0000-00-00`

  return (
    <article
      ref={ref}
      className="practice-sheet"
      data-practice-sheet-page={pageIndex}
    >
      <style>{SHEET_CSS}</style>
      <header className="practice-sheet-header">
        <span className="practice-sheet-header-spacer" aria-hidden>{dateSpacer}</span>
        <div className="practice-sheet-title-wrap">
          <h2 className="practice-sheet-title">{notebookName} · {modeTitle}</h2>
          <p className="practice-sheet-hint">{hint}</p>
        </div>
        <label className="practice-sheet-date">
          <span>{dateLabel}</span>
          <input
            type="date"
            value={dateValue}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </label>
      </header>

      <div className={columns === 2 ? 'practice-sheet-body is-two-cols' : 'practice-sheet-body'}>
        {columnGroups.map((tableItems, tableIndex) => {
          const emptyRows = Math.max(0, rowsPerColumn - tableItems.length)
          return (
            <table key={tableIndex} className="practice-sheet-table">
              <colgroup>
                <col className="idx" />
                <col className="prompt" />
                <col className="answer" />
                <col className="check" />
              </colgroup>
              <thead>
                <tr>
                  <th className="is-center">#</th>
                  <th>{promptHeaderFor(mode, columns, tableIndex, labels)}</th>
                  <th>{labels.answer}</th>
                  <th className="is-center">□</th>
                </tr>
              </thead>
              <tbody>
                {tableItems.map((item, index) => {
                  const absoluteIndex = pageIndex * itemsPerPage + (tableIndex === 0 ? index : splitAt + index)
                  const prompt = promptFor(item, mode, columns, tableIndex)
                  const { english } = itemTexts(item)
                  return (
                    <tr key={item.id}>
                      <td className="is-center is-muted">{absoluteIndex + 1}</td>
                      <td>
                        <span className="prompt-text">{prompt || english}</span>
                      </td>
                      <td />
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

      <footer className="practice-sheet-footer">{pageNumber}</footer>
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
    <div className="mx-auto overflow-hidden rounded-xl bg-white shadow-[0_8px_22px_rgba(15,23,42,0.08)]" style={frameStyle}>
      <div style={stageStyle}>{children}</div>
    </div>
  )
}
