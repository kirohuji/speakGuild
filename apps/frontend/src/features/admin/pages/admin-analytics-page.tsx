import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart3, Users, TrendingUp, DollarSign,
  MessageSquare, Clapperboard, Puzzle, Loader2,
  Calendar, Activity, Crown, Brain, Zap,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/cn';
import { get } from '@/lib/request';
import { getAiUsageStats, type AiUsageStats } from '@/features/admin/api';

// ─── Types ──────────────────────────────────────────────────

interface TrendPoint {
  date: string;
  amount?: number;
  count?: number;
}

interface TopScene {
  id: string;
  name: string;
  sessionCount: number;
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
  totalSessionCount: number;
  todaySessionCount: number;
  totalScriptCount: number;
  sceneCount: number;
  chunkCount: number;
  revenueTrend: TrendPoint[];
  sessionTrend: TrendPoint[];
  topScenes: TopScene[];
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

// ─── Mini Metric ────────────────────────────────────────────

function MiniMetric({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'cyan';
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    amber: 'bg-amber-500/10 text-amber-500',
    violet: 'bg-violet-500/10 text-violet-500',
    rose: 'bg-rose-500/10 text-rose-500',
    cyan: 'bg-cyan-500/10 text-cyan-500',
  };

  return (
    <div className="flex items-center gap-3">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', colors[accent])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

// ─── Chart Tooltip ──────────────────────────────────────────

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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [aiStats, setAiStats] = useState<AiUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, aiData] = await Promise.all([
        getDashboardStats(),
        getAiUsageStats(),
      ]);
      setStats(data);
      setAiStats(aiData);
    } catch {
      setError('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ─── Loading ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px]" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
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

  // ─── Chart data ───────────────────────────────────────────

  const revenueData = (stats.revenueTrend || []).map((d) => ({
    date: d.date?.slice(5),
    revenue: (d.amount || 0) / 100,
  }));

  const sessionData = (stats.sessionTrend || []).map((d) => ({
    date: d.date?.slice(5),
    练习会话: d.count || 0,
  }));

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">数据统计</h1>
          <p className="text-sm text-muted-foreground">核心运营指标一览</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          数据实时更新
        </div>
      </div>

      <Separator />

      {/* ─── KPI Row: 用户 & 营收 ────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-none">
          <CardContent className="p-5">
            <MiniMetric
              icon={Users}
              label="总用户"
              value={fmtInt(stats.userCount)}
              accent="blue"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              本周新增 <span className="font-medium text-foreground">{fmtInt(stats.newUsersThisWeek)}</span> 人
              &nbsp;·&nbsp; 今日活跃 <span className="font-medium text-foreground">{fmtInt(stats.todayActiveUsers)}</span> 人
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="p-5">
            <MiniMetric
              icon={Crown}
              label="付费用户"
              value={fmtInt(stats.paidUserCount)}
              accent="amber"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              转化率 <span className="font-medium text-foreground">{pct(stats.conversionRate)}</span>
              &nbsp;·&nbsp; 今日收入 <span className="font-medium text-foreground">{fmtMoney(stats.todayRevenue)}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="p-5">
            <MiniMetric
              icon={DollarSign}
              label="总收入"
              value={fmtMoney(stats.totalRevenue)}
              accent="emerald"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              本月 <span className="font-medium text-foreground">{fmtMoney(stats.monthRevenue)}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="p-5">
            <MiniMetric
              icon={Activity}
              label="练习会话"
              value={fmtInt(stats.totalSessionCount)}
              accent="violet"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              今日 <span className="font-medium text-foreground">{fmtInt(stats.todaySessionCount)}</span> 次
              &nbsp;·&nbsp; 剧本通关 <span className="font-medium text-foreground">{fmtInt(stats.totalScriptCount)}</span> 次
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Content Stats ───────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-none">
          <CardContent className="p-5">
            <MiniMetric
              icon={Puzzle}
              label="场景"
              value={fmtInt(stats.sceneCount)}
              accent="rose"
            />
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-5">
            <MiniMetric
              icon={MessageSquare}
              label="Chunk 表达块"
              value={fmtInt(stats.chunkCount)}
              accent="cyan"
            />
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-5">
            <MiniMetric
              icon={Clapperboard}
              label="剧本通关"
              value={fmtInt(stats.totalScriptCount)}
              accent="violet"
            />
          </CardContent>
        </Card>
      </div>

      {/* ─── Charts Row ──────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue Trend */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-500" />
              近 30 天收入趋势（元）
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {revenueData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">暂无收入数据</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip prefix="¥" />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="url(#revGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Session Trend */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              近 30 天练习会话趋势
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {sessionData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">暂无练习数据</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={sessionData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="练习会话" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Top Scenes Ranking ──────────────────────────── */}
      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Puzzle className="h-4 w-4 text-violet-500" />
            热门场景排行
            {stats.topScenes?.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">
                Top {stats.topScenes.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(!stats.topScenes || stats.topScenes.length === 0) ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <div className="space-y-1">
              {stats.topScenes.map((scene, idx) => {
                const maxCount = stats.topScenes[0]?.sessionCount || 1;
                const barWidth = Math.max((scene.sessionCount / maxCount) * 100, 3);
                return (
                  <div key={scene.id} className="flex items-center gap-3 py-2.5">
                    <span className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      idx === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' :
                      idx === 1 ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400' :
                      idx === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' :
                      'bg-muted text-muted-foreground',
                    )}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">{scene.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0 tabular-nums">
                          {fmtInt(scene.sessionCount)} 次
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-violet-500 transition-all duration-500"
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

      {/* ─── AI 用量统计 ──────────────────────────────── */}
      {aiStats && (
        <>
          <Separator />
          <div>
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Brain className="h-5 w-5 text-violet-500" />
              AI Token 消耗统计
            </h2>
            <p className="text-sm text-muted-foreground">DeepSeek API 调用量与用户 AI 功能使用情况</p>
          </div>

          {/* KPI 卡片 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="shadow-none">
              <CardContent className="p-5">
                <MiniMetric icon={MessageSquare} label="今日对话判定" value={fmtInt(aiStats.overview.todayDialogue)} accent="violet" />
                <p className="mt-3 text-xs text-muted-foreground">
                  本周 <span className="font-medium text-foreground">{fmtInt(aiStats.overview.weekDialogue)}</span>
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent className="p-5">
                <MiniMetric icon={BarChart3} label="今日汇总分析" value={fmtInt(aiStats.overview.todaySummary)} accent="blue" />
                <p className="mt-3 text-xs text-muted-foreground">
                  本周 <span className="font-medium text-foreground">{fmtInt(aiStats.overview.weekSummary)}</span>
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent className="p-5">
                <MiniMetric icon={Zap} label="今日 Token" value={fmtInt(aiStats.overview.todayTokens)} accent="amber" />
                <p className="mt-3 text-xs text-muted-foreground">
                  本周 <span className="font-medium text-foreground">{fmtInt(aiStats.overview.weekTokens)}</span>
                  &nbsp;·&nbsp; 本月 <span className="font-medium text-foreground">{fmtInt(aiStats.overview.monthTokens)}</span>
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent className="p-5">
                <MiniMetric
                  icon={Brain}
                  label="单词缓存"
                  value={fmtInt(aiStats.overview.totalCachedWords)}
                  accent="emerald"
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  重复查询零成本
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent className="p-5">
                <MiniMetric
                  icon={TrendingUp}
                  label="本月总调用"
                  value={fmtInt(aiStats.overview.monthDialogue + aiStats.overview.monthSummary)}
                  accent="cyan"
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  日人均 {aiStats.overview.totalUsers > 0
                    ? ((aiStats.overview.monthDialogue + aiStats.overview.monthSummary) / 30 / aiStats.overview.totalUsers).toFixed(1)
                    : '0'} 次
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 趋势图 + Top 用户 */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-violet-500" />
                  近 30 天 AI 调用趋势
                </CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={aiStats.trend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip content={<ChartTooltip prefix="" />} />
                    <Bar dataKey="dialogue" name="对话判定" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="summary" name="汇总分析" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-500" />
                  Top AI 用户（近 30 天）
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[280px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-2 text-left font-medium text-muted-foreground">用户</th>
                        <th className="py-2 text-right font-medium text-muted-foreground">对话判定</th>
                        <th className="py-2 text-right font-medium text-muted-foreground">汇总分析</th>
                        <th className="py-2 text-right font-medium text-muted-foreground">Tokens</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {aiStats.topUsers.map((u, i) => (
                        <tr key={u.userId} className="hover:bg-muted/20">
                          <td className="py-2">
                            <span className="text-muted-foreground mr-2">{i + 1}.</span>
                            {u.name || u.email}
                          </td>
                          <td className="py-2 text-right">{u.dialogue}</td>
                          <td className="py-2 text-right">{u.summary}</td>
                          <td className="py-2 text-right font-semibold">{fmtInt(u.tokens)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
