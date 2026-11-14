// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import zhCN from '@/lib/i18n/zh-CN'
import { Calendar } from '@/components/ui/calendar'
import { LearningDayDetails } from '../learning-day-details'
import type { CheckInCalendar } from '@/features/points/api'
const i18n=createInstance()
beforeAll(async()=>{await i18n.use(initReactI18next).init({lng:'zh-CN',resources:{'zh-CN':zhCN},interpolation:{escapeValue:false}})})
afterEach(cleanup)
const calendar:CheckInCalendar={dates:[],totalCheckIns:0,currentStreak:0,dailyStats:[],makeup:{cost:200,pointsBalance:500,today:'2026-11-14',latestDate:'2026-11-13'}}
const props={date:'2026-11-13',dateLabel:'2026年11月13日',today:'2026-11-14',historyComplete:true,calendar,online:true,busy:false,onMakeup:vi.fn()}
function wrap(node:React.ReactNode){return render(<I18nextProvider i18n={i18n}>{node}</I18nextProvider>)}
describe('learning calendar and daily details',()=>{
  it('keeps the clicked calendar day selected',()=>{
    function Harness(){const [selected,setSelected]=useState(new Date(2026,10,13));return <Calendar mode="single" required month={new Date(2026,10,1)} selected={selected} onSelect={setSelected}/>}
    wrap(<Harness/>)
    const previous=screen.getByText('13').closest('button')!
    expect(previous).toHaveAttribute('data-selected','true')
    expect(previous).toHaveClass('bg-primary')
    fireEvent.click(screen.getByText('12'))
    expect(screen.getByText('12').closest('button')).toHaveAttribute('data-selected','true')
    expect(screen.getByText('13').closest('button')).not.toHaveAttribute('data-selected')
  })
  it('shows the selected day rather than monthly totals, with sub-minute precision',()=>{
    wrap(<LearningDayDetails {...props} statistics={{questionCount:12,activeSeconds:45}}/>)
    expect(screen.getByText('12 题')).toBeInTheDocument()
    expect(screen.getByText('不足 1 分钟')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'200 积分补签'})).toBeEnabled()
  })
  it('allows makeup without learning and disables monetary actions offline',()=>{
    const view=wrap(<LearningDayDetails {...props}/>)
    expect(screen.getByText('当天暂无练习记录。')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'200 积分补签'})).toBeEnabled()
    view.rerender(<I18nextProvider i18n={i18n}><LearningDayDetails {...props} online={false}/></I18nextProvider>)
    expect(screen.getByRole('button',{name:'200 积分补签'})).toBeDisabled()
  })
  it('distinguishes made-up days and does not offer a second charge',()=>{
    wrap(<LearningDayDetails {...props} calendar={{...calendar,dates:[props.date],makeupDates:[props.date]}}/>)
    expect(screen.getByText('已补签')).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'200 积分补签'})).not.toBeInTheDocument()
  })
})
