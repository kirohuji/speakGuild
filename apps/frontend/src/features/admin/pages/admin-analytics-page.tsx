import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart3, Users, TrendingUp, DollarSign,
  FileText, Target, BookOpen, Loader2,
  Calendar, ArrowUpRight, Activity,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { get } from '@/lib/request';
import { useAuth } from '@/providers/auth-provider';

// ─── Types ──────────────────────────────────────────────────

interface TrendPoint {
  date: string;
  amount?: number;
  count?: number;
}

interface TopBank {
  id: string;
  name: string;
  province: string;
  practiceCount: number;
}

interface DashboardStats {
  userCount: number;
  todayActiveUsers: number;
  newUsersThisWeek: number;
  paidUserCount: number;
  conversionRate: number;
  totalRevenue: number;
  monthRevenue: number;
  todayRevenue: number;
  totalPracticeCount: number;
  todayPracticeCount: number;
  totalMockCount: number;
  questionBankCount: number;
  questionItemCount: number;
  revenueTrend: TrendPoint[];
  practiceTrend: TrendPoint[];
  topBanks: TopBank[];
}

async function getDashboardStats(): Promise<DashboardStats> {
  return get('/admin/stats/dashboard');
}

// ─── Format helpers ─────────────────────────────────────────

const fmtInt = (n: number | undefined | null) =>
  n != null ? n.toLocaleString() : '—';

const fmtMoney = (cents: number) => {
  const yuan = cents / 100;
  if (yuan >= 10000) return `¥${(yuan / 10000).toFixed(1)}万`;
  return `¥${yuan.toFixed(0)}`;
};

const pct = (n: number) => `${n.toFixed(1)}%`;

// ─── Stat Card ──────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: 'emerald' | 'blue' | 'amber' | 'violet' | 'rose';
}) {
  const accentMap = {
    emerald: 'bg-emerald-500/10 text-emerald-500',
    blue: 'bg-blue-500/10 text-blue-500',
    amber: 'bg-amber-500/10 text-amber-500',
    violet: 'bg-violet-500/10 text-violet-500',
    rose: 'bg-rose-500/10 text-rose-500',
  };

  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', accentMap[accent || 'blue'])}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">
              {label}{sub && <span className="ml-1.5">{sub}</span>}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Chart tooltip ──────────────────────────────────────────

function ChartTooltip({ active, payload, label, prefix }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-muted-foreground mb-0.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-foreground font-semibold">
          {prefix}{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────

export function AdminAnalyticsPage() {
  const { session } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch {
      setError('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ─── Loading skeleton ───────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[280px]" />
          <Skeleton className="h-[280px]" />
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm text-muted-foreground">{error || '暂无数据'}</p>
      </div>
    );
  }

  // Prepare trend data for charts
  const revenueData = stats.revenueTrend?.map((d) => ({
    date: d.date?.slice(5), // MM-DD
    revenue: (d.amount || 0) / 100,
  })) || [];

  const practiceData = stats.practiceTrend?.map((d) => ({
    date: d.date?.slice(5),
    count: d.count || 0,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">数据统计</h1>
        <p className="text-sm text-muted-foreground">核心运营指标概览</p>
      </div>

      {/* ─── Metric Cards Row ─────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={Users}
          label="总用户数"
          value={fmtInt(stats.userCount)}
          sub={`本周新增 ${fmtInt(stats.newUsersThisWeek)}`}
          accent="blue"
        />
        <StatCard
          icon={Activity}
          label="今日活跃"
          value={fmtInt(stats.todayActiveUsers)}
          sub={`今日练习 ${fmtInt(stats.todayPracticeCount)} 题`}
          accent="emerald"
        />
        <StatCard
          icon={DollarSign}
          label="总收入"
          value={fmtMoney(stats.totalRevenue)}
          sub={`本月 ${fmtMoney(stats.monthRevenue)}`}
          accent="amber"
        />
        <StatCard
          icon={TrendingUp}
          label="付费转化率"
          value={pct(stats.conversionRate)}
          sub={`${fmtInt(stats.paidUserCount)} 人付费`}
          accent="violet"
        />
        <StatCard
          icon={Target}
          label="模考次数"
          value={fmtInt(stats.totalMockCount)}
          sub={`题库 ${fmtInt(stats.questionBankCount)} 个`}
          accent="rose"
        />
      </div>

      {/* ─── Secondary Stats ──────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{fmtInt(stats.totalPracticeCount)}</p>
                <p className="text-xs text-muted-foreground">总练习量</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                <BookOpen className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{fmtInt(stats.questionItemCount)}</p>
                <p className="text-xs text-muted-foreground">题目总数</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <Calendar className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{fmtMoney(stats.todayRevenue)}</p>
                <p className="text-xs text-muted-foreground">今日收入</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <BookOpen className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{fmtInt(stats.questionBankCount)}</p>
                <p className="text-xs text-muted-foreground">题库总数</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Trend Charts ─────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue Trend */}
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-500" />
              近 30 天收入趋势
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {revenueData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">暂无数据</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip content={<ChartTooltip prefix="¥" />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Practice Trend */}
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              近 30 天练习量趋势
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {practiceData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">暂无数据</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={practiceData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Top Banks Ranking ────────────────────────────── */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-violet-500" />
            热门题库排行 Top {stats.topBanks?.length || 0}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(!stats.topBanks || stats.topBanks.length === 0) ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <div className="space-y-1">
              {stats.topBanks.map((bank, idx) => {
                const maxCount = stats.topBanks[0]?.practiceCount || 1;
                const barWidth = Math.max((bank.practiceCount / maxCount) * 100, 2);
                return (
                  <div
                    key={bank.id}
                    className="flex items-center gap-3 py-2"
                  >
                    <span className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                      idx < 3
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                        : 'bg-muted text-muted-foreground',
                    )}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-medium truncate">{bank.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                          {fmtInt(bank.practiceCount)} 次练习
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-violet-500 transition-all"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
