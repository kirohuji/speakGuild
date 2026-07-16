import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, Shield, ShieldAlert, ChevronLeft, ChevronRight,
  Mail, Phone, Calendar, Loader2, ArrowLeft, CheckCircle2, XCircle,
  MessageSquare, Clapperboard, Star, Target, BarChart3, MonitorSmartphone, Link2,
  GitBranch, TestTube2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton'
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/cn';
import {
  listUsers, updateUserRole, getUserDetail, getUserAiUsage, getUserLearningOverview, getUserLoginHistory,
  updateUserOtaTest,
  type AdminUser, type AdminUserDetail, type AdminUsersResult, type UserAiUsage, type AdminUserLearningOverview,
  type AdminLoginHistoryResult,
} from '@/features/admin/api';
import { AdminPagination } from '@/features/admin/components/admin-pagination';
import { useAuth } from '@/providers/auth-provider';

// ─── Helpers ────────────────────────────────────────────────

const fmtShort = (n: number | undefined | null) => {
  if (n == null) return '—';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

const fmtDateTime = (value: string | Date | undefined | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('zh-CN');
};

const learningGoalLabels: Record<string, string> = {
  foundation_start: '零基础开口',
  daily_scenes: '日常实战',
  exam_ielts: '雅思口语',
  story_roleplay: '故事剧情',
  course_system: '系统课程',
  arrival_roots: '日常实战',
  daily_hustle: '日常实战',
  people: '日常实战',
  work_study: '系统课程',
  crisis_mode: '日常实战',
  out_about: '日常实战',
};

const summarizeUserAgent = (userAgent: string | null | undefined) => {
  if (!userAgent) return '未知设备';
  const os = /iPhone|iPad|iOS/i.test(userAgent)
    ? 'iOS'
    : /Android/i.test(userAgent)
      ? 'Android'
      : /Windows/i.test(userAgent)
        ? 'Windows'
        : /Mac OS|Macintosh/i.test(userAgent)
          ? 'macOS'
          : /Linux/i.test(userAgent)
            ? 'Linux'
            : '未知系统';
  const browser = /Edg\//i.test(userAgent)
    ? 'Edge'
    : /Chrome\//i.test(userAgent)
      ? 'Chrome'
      : /Safari\//i.test(userAgent)
        ? 'Safari'
        : /Firefox\//i.test(userAgent)
          ? 'Firefox'
          : '未知浏览器';

  return `${os} · ${browser}`;
};

const platformLabel = (platform: string | null | undefined) => {
  if (platform === 'ios') return 'iOS';
  if (platform === 'android') return 'Android';
  if (platform === 'web') return 'Web';
  return platform || '未知平台';
};

const versionWithBuild = (version: string | null | undefined, build: string | null | undefined) => {
  if (!version && !build) return '暂无';
  if (version && build) return `v${version} (${build})`;
  return version ? `v${version}` : `Build ${build}`;
};

function StatDot({
  icon: Icon, label, value, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan';
}) {
  const colors: Record<string, string> = {
    blue: 'text-blue-500 bg-blue-500/10',
    violet: 'text-violet-500 bg-violet-500/10',
    emerald: 'text-emerald-500 bg-emerald-500/10',
    amber: 'text-amber-500 bg-amber-500/10',
    rose: 'text-rose-500 bg-rose-500/10',
    cyan: 'text-cyan-500 bg-cyan-500/10',
  };
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5">
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', colors[accent])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-none">{fmtShort(value)}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function UserLearningTabs({ overview }: { overview: AdminUserLearningOverview | null }) {
  if (!overview) {
    return (
      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        学习数据暂未加载或暂无记录
      </div>
    );
  }

  const warmupPct = overview.warmup.totalItems > 0
    ? Math.round((overview.warmup.masteredItems / overview.warmup.totalItems) * 100)
    : 0;

  return (
    <Tabs defaultValue="packages" className="rounded-xl border p-3">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="packages" className="text-xs">学习包</TabsTrigger>
        <TabsTrigger value="warmup" className="text-xs">知识点</TabsTrigger>
        <TabsTrigger value="vn" className="text-xs">VN</TabsTrigger>
        <TabsTrigger value="story" className="text-xs">剧本</TabsTrigger>
      </TabsList>

      <TabsContent value="packages" className="mt-3 space-y-2">
        {overview.packages.length ? overview.packages.slice(0, 5).map((pack) => (
          <div key={pack.sceneId} className="rounded-lg bg-muted/35 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{pack.title}</p>
                <p className="text-[11px] text-muted-foreground">{pack.topicCount} 话题 · 知识点 {pack.warmup.mastered}/{pack.warmup.total}</p>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px]">{pack.mastery}%</Badge>
            </div>
            <Progress value={pack.mastery} className="mt-2 h-1" />
          </div>
        )) : <p className="py-4 text-center text-xs text-muted-foreground">暂无学习包</p>}
      </TabsContent>

      <TabsContent value="warmup" className="mt-3 space-y-3">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="rounded-lg bg-muted/35 py-2"><p className="text-base font-bold">{overview.warmup.totalItems}</p><p className="text-[10px] text-muted-foreground">题目</p></div>
          <div className="rounded-lg bg-muted/35 py-2"><p className="text-base font-bold text-emerald-600">{overview.warmup.masteredItems}</p><p className="text-[10px] text-muted-foreground">掌握</p></div>
          <div className="rounded-lg bg-muted/35 py-2"><p className="text-base font-bold text-amber-600">{overview.warmup.dueItems}</p><p className="text-[10px] text-muted-foreground">待复习</p></div>
          <div className="rounded-lg bg-muted/35 py-2"><p className="text-base font-bold text-red-600">{overview.warmup.overdueItems}</p><p className="text-[10px] text-muted-foreground">逾期</p></div>
        </div>
        <Progress value={warmupPct} className="h-1.5" />
      </TabsContent>

      <TabsContent value="vn" className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/35 py-3"><p className="text-lg font-bold">{overview.practice.sessionCount}</p><p className="text-[10px] text-muted-foreground">会话</p></div>
        <div className="rounded-lg bg-muted/35 py-3"><p className="text-lg font-bold">{overview.practice.analyzedCount}</p><p className="text-[10px] text-muted-foreground">已分析</p></div>
        <div className="rounded-lg bg-muted/35 py-3"><p className="text-lg font-bold">{overview.practice.avgScore ?? '—'}</p><p className="text-[10px] text-muted-foreground">均分</p></div>
      </TabsContent>

      <TabsContent value="story" className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/35 py-3"><p className="text-lg font-bold">{overview.story.recordCount}</p><p className="text-[10px] text-muted-foreground">记录</p></div>
        <div className="rounded-lg bg-muted/35 py-3"><p className="text-lg font-bold text-emerald-600">{overview.story.passedCount}</p><p className="text-[10px] text-muted-foreground">通过</p></div>
        <div className="rounded-lg bg-muted/35 py-3"><p className="text-lg font-bold text-amber-600">{overview.story.xpEarned}</p><p className="text-[10px] text-muted-foreground">XP</p></div>
      </TabsContent>
    </Tabs>
  );
}

// ─── Main Page ──────────────────────────────────────────────

export function AdminUsersPage() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [data, setData] = useState<AdminUsersResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await listUsers({ page, pageSize, keyword: keyword || undefined });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, keyword]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Admin guard redirect
  if (session && session.user.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <ShieldAlert className="h-16 w-16 text-muted-foreground/30" />
        <p className="mt-4 text-lg font-semibold text-muted-foreground">需要管理员权限</p>
        <p className="mt-1 text-sm text-muted-foreground/60">您的账号没有访问此页面的权限</p>
        <Button variant="outline" className="mt-6" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回首页
        </Button>
      </div>
    );
  }

  const handleSearch = () => {
    setPage(1);
    setKeyword(searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">用户管理</h1>
        <p className="text-sm text-muted-foreground">管理系统中的所有用户账号</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data?.total ?? '--'}</p>
                <p className="text-xs text-muted-foreground">用户总数</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <Shield className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {data ? data.list.filter((u) => u.role === 'admin').length : '--'}
                </p>
                <p className="text-xs text-muted-foreground">管理员</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {data ? data.list.filter((u) => u.emailVerified).length : '--'}
                </p>
                <p className="text-xs text-muted-foreground">邮箱已验证</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
                <Calendar className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {data && data.list.length > 0
                    ? new Date(data.list[0].createdAt).toLocaleDateString('zh-CN')
                    : '--'}
                </p>
                <p className="text-xs text-muted-foreground">最新注册</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索栏 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索邮箱、姓名或用户名..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} size="sm">
          搜索
        </Button>
        {keyword && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput('');
              setKeyword('');
              setPage(1);
            }}
          >
            清除
          </Button>
        )}
      </div>

      {/* 用户表格 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">用户列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !data || data.list.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-sm font-medium text-muted-foreground">
                {keyword ? '没有匹配的用户' : '暂无用户'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                {keyword ? '尝试更换搜索关键词' : '用户注册后会显示在这里'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      用户
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider sm:table-cell">
                      角色
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider md:table-cell">
                      验证状态
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider lg:table-cell">
                      登录设备
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider lg:table-cell">
                      注册时间
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[60px]">
                      内测
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.list.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      onRoleUpdated={fetchUsers}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 分页 */}
          {data && data.total > 0 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">每页</span>
                <Select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                  className="h-8 w-[72px] text-xs"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </Select>
                <span className="text-xs text-muted-foreground whitespace-nowrap">条</span>
              </div>
              <p className="text-xs text-muted-foreground">
                共 {data.total} 条，第 {page}/{totalPages} 页
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 单行用户组件 ──────────────────────────────────────────────────────────

function OtaToggle({
  userId,
  enabled,
  onToggled,
}: {
  userId: string;
  enabled: boolean;
  onToggled: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(enabled);

  useEffect(() => {
    setChecked(enabled);
  }, [enabled]);

  const handleToggle = async (next: boolean) => {
    setChecked(next);
    setLoading(true);
    try {
      // 打开内测 = staging 通道，关闭 = 恢复普通用户
      await updateUserOtaTest(userId, {
        enabled: next,
        channel: next ? 'staging' : 'production',
      });
      onToggled();
    } catch {
      setChecked(!next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Switch
      checked={checked}
      onCheckedChange={handleToggle}
      disabled={loading}
    />
  );
}

function UserRow({
  user,
  onRoleUpdated,
}: {
  user: AdminUser;
  onRoleUpdated: () => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [roleConfirmOpen, setRoleConfirmOpen] = useState(false);
  const [newRole, setNewRole] = useState<'user' | 'admin'>(user.role);
  const [updating, setUpdating] = useState(false);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [learningOverview, setLearningOverview] = useState<AdminUserLearningOverview | null>(null);
  const [aiUsage, setAiUsage] = useState<UserAiUsage | null>(null);
  const [aiUsageLoading, setAiUsageLoading] = useState(false);
  const [otaSaving, setOtaSaving] = useState(false);
  const [otaEnabled, setOtaEnabled] = useState(false);
  const [otaChannel, setOtaChannel] = useState('production');
  const [otaPlatform, setOtaPlatform] = useState('');
  const [otaReleaseLine, setOtaReleaseLine] = useState('');
  const [otaTargetVersion, setOtaTargetVersion] = useState('');
  const [otaNotes, setOtaNotes] = useState('');
  const [loginHistory, setLoginHistory] = useState<AdminLoginHistoryResult | null>(null);
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(false);

  const loadLoginHistory = async (page = 1, pageSize = loginHistory?.pageSize ?? 10) => {
    setLoginHistoryLoading(true);
    try {
      setLoginHistory(await getUserLoginHistory(user.id, { page, pageSize }));
    } finally {
      setLoginHistoryLoading(false);
    }
  };

  const openDetail = async () => {
    setDetailOpen(true);
    setDetailLoading(true);
    setLearningOverview(null);
    setLoginHistory(null);
    try {
      const [d, overview, history] = await Promise.all([
        getUserDetail(user.id),
        getUserLearningOverview(user.id).catch(() => null),
        getUserLoginHistory(user.id, { page: 1, pageSize: 10 }).catch(() => null),
      ]);
      setDetail(d);
      setOtaEnabled(Boolean(d.mobileOtaTester?.enabled));
      setOtaChannel(d.mobileOtaTester?.channel || 'production');
      setOtaPlatform(d.mobileOtaTester?.platform || '');
      setOtaReleaseLine(d.mobileOtaTester?.targetReleaseLine || '');
      setOtaTargetVersion(d.mobileOtaTester?.targetVersion || '');
      setOtaNotes(d.mobileOtaTester?.notes || '');
      setLearningOverview(overview);
      setLoginHistory(history);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveOtaTest = async () => {
    setOtaSaving(true);
    try {
      // enabled 由列表 Switch 控制，这里只保存高级配置
      const next = await updateUserOtaTest(user.id, {
        enabled: true, // 能打开详情说明 Switch 已开，保持 enabled
        channel: otaChannel,
        platform: otaPlatform || undefined,
        targetReleaseLine: otaReleaseLine || undefined,
        targetVersion: otaTargetVersion || undefined,
        notes: otaNotes || undefined,
      });
      setDetail((prev) => prev ? { ...prev, mobileOtaTester: next } : prev);
      onRoleUpdated();
    } catch {
      // ignore
    } finally {
      setOtaSaving(false);
    }
  };

  const handleRoleChange = async () => {
    if (newRole === user.role) {
      setRoleConfirmOpen(false);
      return;
    }
    setUpdating(true);
    try {
      await updateUserRole(user.id, newRole);
      onRoleUpdated();
      setRoleConfirmOpen(false);
    } catch {
      // ignore
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <tr
        className="transition-colors hover:bg-muted/30 cursor-pointer"
        onClick={openDetail}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold',
              user.role === 'admin'
                ? 'bg-amber-500/15 text-amber-600'
                : 'bg-primary/10 text-primary'
            )}>
              {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {user.name || '未命名'}
                {user.role === 'admin' && (
                  <Shield className="inline-block ml-1.5 h-3.5 w-3.5 text-amber-500" />
                )}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              {(user.mobileOtaTester?.lastBundleVersion || user.mobileOtaTester?.lastNativeVersion) && (
                <p className="text-[10px] text-muted-foreground/60 truncate">
                  {user.mobileOtaTester?.lastNativeVersion && `原生 v${user.mobileOtaTester.lastNativeVersion}`}
                  {user.mobileOtaTester?.lastNativeVersion && user.mobileOtaTester?.lastBundleVersion && ' · '}
                  {user.mobileOtaTester?.lastBundleVersion && `OTA v${user.mobileOtaTester.lastBundleVersion}`}
                </p>
              )}
              {user.online && (
                <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  在线
                </span>
              )}
            </div>
          </div>
        </td>
        <td className="hidden px-4 py-3 sm:table-cell">
          <Badge
            variant={user.role === 'admin' ? 'default' : 'secondary'}
            className={cn(
              'text-xs',
              user.role === 'admin' && 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/15'
            )}
          >
            {user.role === 'admin' ? '管理员' : '用户'}
          </Badge>
        </td>
        <td className="hidden px-4 py-3 md:table-cell">
          <div className="flex items-center gap-2">
            {user.emailVerified ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <XCircle className="h-4 w-4 text-muted-foreground/40" />
            )}
            <span className="text-xs text-muted-foreground">
              {user.emailVerified ? '已验证' : '未验证'}
            </span>
          </div>
        </td>
        <td className="hidden px-4 py-3 lg:table-cell">
          <div className="max-w-[180px]">
            <p className="truncate text-sm text-foreground">
              {summarizeUserAgent(user.recentSession?.userAgent)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.activeSessionCount ? `${user.activeSessionCount} 个会话` : '暂无会话'}
              {user.recentSession?.ipAddress ? ` · ${user.recentSession.ipAddress}` : ''}
            </p>
          </div>
        </td>
        <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
          {new Date(user.createdAt).toLocaleDateString('zh-CN')}
        </td>
        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
          <OtaToggle
            userId={user.id}
            enabled={user.mobileOtaTester?.enabled ?? false}
            onToggled={onRoleUpdated}
          />
        </td>
        <td className="px-4 py-3 text-right">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              openDetail();
            }}
          >
            详情
          </Button>
        </td>
      </tr>

      {/* 用户详情弹窗 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="h-[88vh] w-[calc(100vw-32px)] max-w-[1180px] overflow-hidden p-0">
          {detailLoading ? (
            <div className="grid h-full grid-cols-[320px_minmax(0,1fr)]">
              <div className="border-r p-5">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="mt-5 h-40 w-full" />
                <Skeleton className="mt-5 h-28 w-full" />
              </div>
              <div className="p-5">
                <Skeleton className="h-10 w-72" />
                <Skeleton className="mt-5 h-[520px] w-full" />
              </div>
            </div>
          ) : detail ? (
            <div className="grid h-full min-h-0 grid-cols-[320px_minmax(0,1fr)]">
              <aside className="flex min-h-0 flex-col border-r bg-muted/20">
                <div className="border-b px-5 py-4">
                  <DialogTitle className="text-base">用户详情</DialogTitle>
                  <DialogDescription className="mt-1 text-xs">账号状态、学习进度、设备与用量</DialogDescription>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold',
                      detail.role === 'admin'
                        ? 'bg-amber-500/15 text-amber-600'
                        : 'bg-primary/10 text-primary'
                    )}>
                      {detail.name?.[0]?.toUpperCase() || detail.email[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-lg font-semibold">{detail.name || '未命名'}</p>
                        <Badge
                          variant={detail.role === 'admin' ? 'default' : 'secondary'}
                          className={cn('shrink-0 text-xs', detail.role === 'admin' && 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/15')}
                        >
                          {detail.role === 'admin' ? '管理员' : '用户'}
                        </Badge>
                      </div>
                      {detail.username && <p className="truncate text-sm text-muted-foreground">@{detail.username}</p>}
                      <Badge
                        variant="outline"
                        className={cn('mt-2 text-xs', detail.presence?.online ? 'border-emerald-300 text-emerald-600' : 'text-muted-foreground')}
                      >
                        {detail.presence?.online ? `在线 · ${detail.presence.socketCount} 连接` : '离线'}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-background px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">输出等级</p>
                      <p className="mt-1 text-xl font-bold text-primary">{detail.outputLevel || 'L1'}</p>
                    </div>
                    <div className="rounded-lg bg-background px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">用户等级</p>
                      <p className="mt-1 text-xl font-bold text-violet-500">Lv.{detail.userLevel ?? 1}</p>
                    </div>
                    <div className="rounded-lg bg-background px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">经验</p>
                      <p className="mt-1 text-xl font-bold text-amber-500">{fmtShort(detail.totalXp ?? 0)}</p>
                    </div>
                    <div className="rounded-lg bg-background px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">积分</p>
                      <p className="mt-1 text-xl font-bold text-emerald-500">{fmtShort(detail.points ?? 0)}</p>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg bg-background px-3 py-3 text-xs">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{detail.email}</span>
                      <Badge variant="outline" className={cn('text-[10px]', detail.emailVerified ? 'border-emerald-300 text-emerald-600' : 'text-muted-foreground')}>
                        {detail.emailVerified ? '已验证' : '未验证'}
                      </Badge>
                    </div>
                    {detail.phoneNumber && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{detail.phoneNumber}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{fmtDateTime(detail.createdAt)} 注册</span>
                    </div>
                  </div>

                  {detail.membership ? (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3">
                      <p className="text-sm font-medium text-amber-700">{detail.membership.plan?.name || '会员'}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {detail.membership.status === 'active' ? '生效中' : detail.membership.status === 'expired' ? '已过期' : '已取消'}
                        {detail.membership.expiredAt ? ` · ${fmtDateTime(detail.membership.expiredAt)}` : ''}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-background px-3 py-3">
                      <p className="text-sm font-medium">免费用户</p>
                      <p className="mt-1 text-xs text-muted-foreground">暂无会员订阅</p>
                    </div>
                  )}

                  {detail.learningGoals && detail.learningGoals.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">学习目标</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detail.learningGoals.map((goal) => (
                          <Badge key={goal} variant="secondary" className="text-[11px]">{learningGoalLabels[goal] ?? goal}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t p-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">角色管理</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={detail.role === 'user' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => { setNewRole('user'); setRoleConfirmOpen(true); }}
                    >
                      普通用户
                    </Button>
                    <Button
                      variant={detail.role === 'admin' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => { setNewRole('admin'); setRoleConfirmOpen(true); }}
                    >
                      <Shield className="mr-1.5 h-3.5 w-3.5" />
                      管理员
                    </Button>
                  </div>
                </div>
              </aside>

              <section className="flex min-h-0 flex-col">
                <Tabs defaultValue="learning" className="flex min-h-0 flex-1 flex-col">
                  <div className="border-b px-5 py-3">
                    <TabsList className="grid w-full max-w-2xl grid-cols-4">
                      <TabsTrigger value="learning">学习追踪</TabsTrigger>
                      <TabsTrigger value="access">设备账号</TabsTrigger>
                      <TabsTrigger value="ota">内测配置</TabsTrigger>
                      <TabsTrigger value="ai">AI 用量</TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                    <TabsContent value="learning" className="m-0 space-y-4">
                      <div className="grid grid-cols-4 gap-3">
                        <StatDot icon={Target} label="知识点题目" value={learningOverview?.warmup.totalItems ?? 0} accent="cyan" />
                        <StatDot icon={CheckCircle2} label="已掌握" value={learningOverview?.warmup.masteredItems ?? 0} accent="emerald" />
                        <StatDot icon={MessageSquare} label="VN 会话" value={detail._count.practiceSessions} accent="blue" />
                        <StatDot icon={Clapperboard} label="剧本记录" value={detail._count.storyRecords} accent="violet" />
                      </div>
                      <UserLearningTabs overview={learningOverview} />
                      {detail.outputLevelDetail && (
                        <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                          <span>输出等级来源：{detail.outputLevelDetail.source === 'self_assessment' ? '用户自评' : String(detail.outputLevelDetail.source || '未知')}</span>
                          <span className="ml-4">更新时间：{fmtDateTime(String(detail.outputLevelDetail.assessedAt || ''))}</span>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="access" className="m-0 space-y-4">
                      <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-4">
                        <div className="rounded-lg border">
                          <div className="flex items-center justify-between border-b px-4 py-3">
                            <p className="flex items-center gap-2 text-sm font-medium">
                              <MonitorSmartphone className="h-4 w-4 text-emerald-500" />
                              登录历史
                            </p>
                            <Badge variant="outline" className="text-xs">共 {loginHistory?.total ?? 0} 次登录</Badge>
                          </div>
                          <div className="divide-y">
                            {loginHistoryLoading ? (
                              <div className="flex items-center justify-center px-4 py-10 text-sm text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />加载登录记录
                              </div>
                            ) : loginHistory?.list.length ? loginHistory.list.map((session) => (
                              <div key={session.id} className="px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="truncate text-sm font-medium">
                                    {session.deviceName || session.deviceModel || summarizeUserAgent(session.userAgent)}
                                  </p>
                                  <span className="shrink-0 text-[11px] text-muted-foreground">登录于 {fmtDateTime(session.loginAt)}</span>
                                </div>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                  <Badge variant="outline" className="text-[10px]">{platformLabel(session.platform)}</Badge>
                                  {(session.operatingSystem || session.osVersion) && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      {[session.operatingSystem, session.osVersion].filter(Boolean).join(' ')}
                                    </Badge>
                                  )}
                                  {session.nativeVersion && <Badge variant="secondary" className="text-[10px]">App {versionWithBuild(session.nativeVersion, session.nativeBuild)}</Badge>}
                                  {session.bundleVersion && <Badge variant="secondary" className="text-[10px]">OTA v{session.bundleVersion}</Badge>}
                                </div>
                                <p className="mt-1.5 truncate text-xs text-muted-foreground">
                                  IP: {session.ipAddress || '未知'} · 厂商: {session.manufacturer || '未知'} · 过期: {fmtDateTime(session.expiresAt)}
                                </p>
                              </div>
                            )) : <p className="px-4 py-8 text-center text-sm text-muted-foreground">暂无登录记录</p>}
                          </div>
                          {loginHistory && (
                            <AdminPagination
                              total={loginHistory.total}
                              page={loginHistory.page}
                              pageSize={loginHistory.pageSize}
                              pageSizes={[5, 10, 20, 50]}
                              onPageChange={(page) => void loadLoginHistory(page, loginHistory.pageSize)}
                              onPageSizeChange={(pageSize) => void loadLoginHistory(1, pageSize)}
                            />
                          )}
                        </div>

                        <div className="space-y-4">
                          <div className="rounded-lg border px-4 py-3">
                            <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                              <Link2 className="h-4 w-4 text-blue-500" />
                              绑定账号
                            </p>
                            {detail.accounts?.length ? (
                              <div className="flex flex-wrap gap-2">
                                {detail.accounts.map((account) => (
                                  <Badge key={account.id} variant="secondary" className="text-xs">
                                    {account.providerId === 'credential' ? '邮箱密码' : account.providerId === 'wechat' ? '微信' : account.providerId === 'apple' ? 'Apple' : account.providerId}
                                  </Badge>
                                ))}
                              </div>
                            ) : <p className="text-xs text-muted-foreground">暂无绑定账号</p>}
                          </div>

                          <div className="rounded-lg border px-4 py-3">
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">最近设备</p>
                              <Badge variant="outline" className="text-xs">
                                {platformLabel(detail.mobileOtaTester?.lastPlatform)}
                              </Badge>
                            </div>
                            <div className="space-y-2 text-xs">
                              <div>
                                <p className="text-muted-foreground">设备</p>
                                <p className="mt-0.5 text-sm font-medium">
                                  {detail.mobileOtaTester?.lastDeviceName || detail.mobileOtaTester?.lastDeviceModel || summarizeUserAgent(detail.sessions?.[0]?.userAgent)}
                                </p>
                                {detail.mobileOtaTester?.lastDeviceModel && detail.mobileOtaTester?.lastDeviceName && (
                                  <p className="mt-0.5 text-muted-foreground">{detail.mobileOtaTester.lastDeviceModel}</p>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-md bg-muted/40 px-2 py-1.5">
                                  <p className="text-muted-foreground">系统</p>
                                  <p className="mt-0.5 font-medium">
                                    {detail.mobileOtaTester?.lastOperatingSystem || platformLabel(detail.mobileOtaTester?.lastPlatform)}
                                    {detail.mobileOtaTester?.lastOsVersion ? ` ${detail.mobileOtaTester.lastOsVersion}` : ''}
                                  </p>
                                </div>
                                <div className="rounded-md bg-muted/40 px-2 py-1.5">
                                  <p className="text-muted-foreground">厂商</p>
                                  <p className="mt-0.5 font-medium">{detail.mobileOtaTester?.lastManufacturer || '暂无'}</p>
                                </div>
                                <div className="rounded-md bg-muted/40 px-2 py-1.5">
                                  <p className="text-muted-foreground">App</p>
                                  <p className="mt-0.5 font-medium">{versionWithBuild(detail.mobileOtaTester?.lastNativeVersion, detail.mobileOtaTester?.lastNativeBuild)}</p>
                                </div>
                                <div className="rounded-md bg-muted/40 px-2 py-1.5">
                                  <p className="text-muted-foreground">OTA</p>
                                  <p className="mt-0.5 font-medium">{detail.mobileOtaTester?.lastBundleVersion ? `v${detail.mobileOtaTester.lastBundleVersion}` : '暂无'}</p>
                                </div>
                              </div>
                              <p className="text-muted-foreground">最近上报：{fmtDateTime(detail.mobileOtaTester?.lastCheckAt)}</p>
                              <p className="text-muted-foreground">最近 IP：{detail.mobileOtaTester?.lastIpAddress || detail.sessions?.[0]?.ipAddress || '暂无 IP'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="ota" className="m-0 space-y-4">
                      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-medium">
                            <TestTube2 className="h-4 w-4 text-cyan-500" />
                            OTA 内测配置
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">列表中的“内测”开关控制是否启用；这里配置目标通道和版本。</p>
                        </div>
                        <Badge variant="outline" className={cn('text-xs', otaEnabled ? 'border-cyan-300 text-cyan-600' : 'text-muted-foreground')}>
                          {otaEnabled ? '已开启' : '未开启'}
                        </Badge>
                      </div>

                      {(detail.mobileOtaTester?.lastBundleVersion || detail.mobileOtaTester?.lastNativeVersion) && (
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-lg bg-muted/40 px-3 py-2">
                            <p className="text-[10px] text-muted-foreground">原生版本</p>
                            <p className="text-sm font-mono font-medium">{versionWithBuild(detail.mobileOtaTester?.lastNativeVersion, detail.mobileOtaTester?.lastNativeBuild)}</p>
                          </div>
                          <div className="rounded-lg bg-muted/40 px-3 py-2">
                            <p className="text-[10px] text-muted-foreground">热更包版本</p>
                            <p className="text-sm font-mono font-medium">{detail.mobileOtaTester?.lastBundleVersion ? `v${detail.mobileOtaTester.lastBundleVersion}` : '暂无'}</p>
                          </div>
                          <div className="rounded-lg bg-muted/40 px-3 py-2">
                            <p className="text-[10px] text-muted-foreground">最近检查</p>
                            <p className="text-sm font-medium">{fmtDateTime(detail.mobileOtaTester?.lastCheckAt)}</p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                          通道
                          <Select value={otaChannel} onChange={(e) => setOtaChannel(e.target.value)}>
                            <option value="production">正式版 (production)</option>
                            <option value="staging">预发布 (staging)</option>
                          </Select>
                        </label>
                        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                          平台限制
                          <Select value={otaPlatform} onChange={(e) => setOtaPlatform(e.target.value)}>
                            <option value="">不限平台</option>
                            <option value="ios">iOS</option>
                            <option value="android">Android</option>
                          </Select>
                        </label>
                        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                          目标发布线
                          <div className="relative">
                            <GitBranch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input className="pl-8" placeholder="1.2" value={otaReleaseLine} onChange={(e) => setOtaReleaseLine(e.target.value)} />
                          </div>
                        </label>
                        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                          精确版本
                          <Input placeholder="1.2.3，可留空" value={otaTargetVersion} onChange={(e) => setOtaTargetVersion(e.target.value)} />
                        </label>
                        <label className="col-span-2 flex flex-col gap-1.5 text-xs text-muted-foreground">
                          备注
                          <Input placeholder="测试说明" value={otaNotes} onChange={(e) => setOtaNotes(e.target.value)} />
                        </label>
                      </div>

                      <div className="flex justify-end">
                        <Button size="sm" onClick={handleSaveOtaTest} disabled={otaSaving || !otaEnabled}>
                          {otaSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          保存内测配置
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="ai" className="m-0 space-y-4">
                      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <BarChart3 className="h-4 w-4 text-violet-500" />
                          AI 用量统计（近 30 天）
                        </p>
                        {aiUsage === null && !aiUsageLoading && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async (e) => {
                              e.stopPropagation()
                              setAiUsageLoading(true)
                              try {
                                const data = await getUserAiUsage(user.id)
                                setAiUsage(data)
                              } catch { setAiUsage(null) }
                              finally { setAiUsageLoading(false) }
                            }}
                          >
                            加载 AI 用量
                          </Button>
                        )}
                      </div>
                      {aiUsageLoading ? (
                        <div className="space-y-3">
                          <Skeleton className="h-20 w-full" />
                          <Skeleton className="h-60 w-full" />
                        </div>
                      ) : aiUsage ? (
                        <>
                          <div className="grid grid-cols-4 gap-3">
                            <StatDot icon={MessageSquare} label="对话判定" value={aiUsage.totals.dialogue} accent="violet" />
                            <StatDot icon={BarChart3} label="汇总分析" value={aiUsage.totals.summary} accent="blue" />
                            <StatDot icon={Target} label="Tokens" value={aiUsage.totals.tokens} accent="amber" />
                            <StatDot icon={Star} label="缓存单词" value={aiUsage.cachedWordCount} accent="emerald" />
                          </div>
                          <div className="overflow-hidden rounded-lg border">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-muted/40">
                                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">日期</th>
                                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">对话判定</th>
                                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">汇总分析</th>
                                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Tokens</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {aiUsage.dailyUsages.map((d) => (
                                  <tr key={d.date} className="hover:bg-muted/20">
                                    <td className="px-3 py-2 text-muted-foreground">{d.date}</td>
                                    <td className="px-3 py-2 text-right">{d.dialogue}</td>
                                    <td className="px-3 py-2 text-right">{d.summary}</td>
                                    <td className="px-3 py-2 text-right">{fmtShort(d.tokens)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : (
                        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">点击加载后查看该用户的 AI 调用情况</p>
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
              </section>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">加载失败</div>
          )}
        </DialogContent>
      </Dialog>

      {/* 角色修改确认弹窗 */}
      <Dialog open={roleConfirmOpen} onOpenChange={setRoleConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认修改角色</DialogTitle>
            <DialogDescription>
              确定要将 <span className="font-semibold text-foreground">{user.name || user.email}</span> 的角色
              修改为 <span className="font-semibold text-foreground">{newRole === 'admin' ? '管理员' : '普通用户'}</span> 吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleConfirmOpen(false)}>
              取消
            </Button>
            <Button onClick={handleRoleChange} disabled={updating}>
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
