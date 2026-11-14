// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import type { CheckInCalendar } from '@/features/points/api'
const mock=vi.hoisted(()=>({hasDayActivity:false,calendar:{startDate:'',endDate:'',dates:[],totalCheckIns:0,currentStreak:0,dailyStats:[],makeup:{cost:200,pointsBalance:500,today:'2026-11-14',latestDate:'2026-11-13'}} as CheckInCalendar,fetch:vi.fn(async()=>null)}))
vi.mock('@/stores/learning.store',()=>({useLearningStore:Object.assign((select:any)=>select({checkInData:mock.calendar,checkInLoading:false,fetchCheckInCalendar:mock.fetch,invalidateCheckInCalendar:async()=>{}}),{getState:()=>({}),setState:()=>{}})}))
vi.mock('@/stores/user.store',()=>({useUserStore:Object.assign((select:any)=>select({currentUserId:'u'}),{getState:()=>({currentUserId:'u'})})}))
vi.mock('@/stores/home.store',()=>({useHomeStore:{setState:()=>{}}}))
vi.mock('@/providers/auth-session',()=>({getCurrentSessionSnapshot:()=>({user:{id:'u'}})}))
vi.mock('@/features/points/api',()=>({pointsApi:{}}))
vi.mock('@/stores/learning-statistics.store',()=>({useLearningStatistics:()=>({data:{dailyStats:mock.hasDayActivity?[{date:'2026-11-14',active:true,questionCount:1,activeSeconds:60}]:[],hourlyStats:[],hourlyComplete:!mock.hasDayActivity,historyComplete:true}})}))
vi.mock('@/components/ui/drawer',()=>({Drawer:({open,children}:any)=>open?<div>{children}</div>:null,DrawerContent:({children}:any)=><div>{children}</div>,DrawerHeader:({children}:any)=><div>{children}</div>,DrawerTitle:({children}:any)=><h2>{children}</h2>}))
vi.mock('@/components/ui/chart',()=>({ChartContainer:({children}:any)=><div>{children}</div>}))
vi.mock('recharts',()=>({ComposedChart:({children}:any)=><div data-testid="activity-plot">{children}</div>,Bar:()=>null,CartesianGrid:()=>null,Cell:()=>null,LabelList:()=>null,Line:()=>null,ReferenceLine:()=>null,XAxis:()=>null,YAxis:()=>null}))
vi.mock('../daily-activity-chart',async()=>{const actual=await vi.importActual<typeof import('../daily-activity-chart')>('../daily-activity-chart');return {...actual,DailyActivityChart:(props:React.ComponentProps<typeof actual.DailyActivityChart>)=><div data-testid="day-chart"><actual.DailyActivityChart {...props}/></div>}})
vi.mock('react-i18next',()=>({useTranslation:()=>({i18n:{language:'zh-CN'},t:(key:string)=>key})}))
import {CheckInCalendarDrawer} from '../week-tracker'
beforeEach(()=>{mock.hasDayActivity=false;vi.useFakeTimers();vi.setSystemTime(new Date(2026,10,14,10));mock.calendar.startDate='2026-11-01';mock.calendar.endDate='2026-11-30'})
afterEach(()=>{cleanup();vi.useRealTimers()})
describe('day view navigation',()=>{
 it('keeps the day chart when today has daily totals but missing hourly coverage',()=>{
  mock.hasDayActivity=true
  render(<CheckInCalendarDrawer open onOpenChange={()=>{}}/>)
  expect(screen.getByRole('radio',{name:'learning.dayChart.dayView'})).toHaveAttribute('aria-checked','true')
  const chart=screen.getByRole('region',{name:'learning.dayChart.title'})
  expect(within(chart).getByTestId('activity-plot')).toBeInTheDocument()
  expect(within(chart).getByRole('status')).toHaveTextContent('learning.dayChart.partial')
  expect(screen.queryByText('learning.dayChart.unavailable')).not.toBeInTheDocument()
 })
 it('single tap highlights; double tap opens that day; direct Day resets to today',()=>{
  render(<CheckInCalendarDrawer open onOpenChange={()=>{}}/>)
  fireEvent.click(screen.getByRole('radio',{name:'learning.monthView'}))
  fireEvent.click(screen.getByText('13'),{detail:1})
  expect(screen.getByText('13').closest('button')).toHaveAttribute('data-selected','true')
  expect(screen.queryByTestId('day-chart')).not.toBeInTheDocument()
  act(()=>vi.advanceTimersByTime(150))
  fireEvent.click(screen.getByText('13'),{detail:1})
  expect(screen.getByTestId('day-chart')).toBeInTheDocument()
  expect(screen.getAllByText(/2026年11月13日/).length).toBeGreaterThan(0)
  const statusCard=screen.getByText('learning.dayChart.checkInStatus').parentElement!.parentElement!
  expect(within(statusCard).getByRole('button',{name:'learning.dayDetails.makeup'})).toBeEnabled()
  expect(screen.getAllByRole('button',{name:'learning.dayDetails.makeup'})).toHaveLength(1)
  expect(screen.queryByRole('button',{name:'learning.dayChart.backToday'})).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio',{name:'learning.monthView'}))
  expect(screen.getByText('13').closest('button')).toHaveAttribute('data-selected','true')
  fireEvent.click(screen.getByRole('radio',{name:'learning.dayChart.dayView'}))
  expect(screen.getAllByText(/2026年11月14日/).length).toBeGreaterThan(0)
  expect(screen.getByRole('button',{name:'learning.dayChart.nextDay'})).toBeDisabled()
  expect(screen.queryByRole('button',{name:'learning.dayDetails.makeup'})).not.toBeInTheDocument()
  expect(screen.queryByRole('region',{name:'learning.dayDetails.title'})).not.toBeInTheDocument()
 })
})
