import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, Shield, ShieldAlert, ChevronLeft, ChevronRight,
  Mail, Phone, Calendar,
  Loader2, ArrowLeft, CheckCircle2, XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton'
import { Select } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import {
  listUsers, updateUserRole, getUserDetail,
  type AdminUser, type AdminUserDetail, type AdminUsersResult,
} from '@/features/admin/api';
import { useAuth } from '@/providers/auth-provider';

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
                      注册时间
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

  const openDetail = async () => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const d = await getUserDetail(user.id);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
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
        <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
          {new Date(user.createdAt).toLocaleDateString('zh-CN')}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>用户详情</DialogTitle>
            <DialogDescription>查看用户信息和统计数据</DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : detail ? (
            <div className="space-y-4 py-2">
              {/* 基本信息 */}
              <div className="flex items-center gap-4">
                <div className={cn(
                  'flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-xl font-bold',
                  detail.role === 'admin'
                    ? 'bg-amber-500/15 text-amber-600'
                    : 'bg-primary/10 text-primary'
                )}>
                  {detail.name?.[0]?.toUpperCase() || detail.email[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold">{detail.name || '未命名'}</p>
                    <Badge
                      variant={detail.role === 'admin' ? 'default' : 'secondary'}
                      className={cn(
                        'text-xs',
                        detail.role === 'admin' && 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/15'
                      )}
                    >
                      {detail.role === 'admin' ? '管理员' : '用户'}
                    </Badge>
                  </div>
                  {detail.username && (
                    <p className="text-sm text-muted-foreground">@{detail.username}</p>
                  )}
                </div>
              </div>

              {/* 联系方式 */}
              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-4">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{detail.email}</span>
                  {detail.emailVerified ? (
                    <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-600">
                      已验证
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      未验证
                    </Badge>
                  )}
                </div>
                {detail.phoneNumber && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{detail.phoneNumber}</span>
                    {detail.phoneNumberVerified ? (
                      <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-600">
                        已验证
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        未验证
                      </Badge>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {new Date(detail.createdAt).toLocaleString('zh-CN')} 注册
                  </span>
                </div>
              </div>

              {/* 统计数据 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border/60 p-3 text-center">
                  <p className="text-2xl font-bold text-blue-500">{detail._count.practiceRecords}</p>
                  <p className="text-xs text-muted-foreground">练习次数</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3 text-center">
                  <p className="text-2xl font-bold text-purple-500">{detail._count.mockExamRecords}</p>
                  <p className="text-xs text-muted-foreground">模考次数</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-500">{detail._count.vocabularyWords}</p>
                  <p className="text-xs text-muted-foreground">生词数</p>
                </div>
              </div>

              {/* 角色修改 */}
              <div className="rounded-xl border border-border/60 p-4">
                <p className="mb-3 text-sm font-medium">角色管理</p>
                <div className="flex items-center gap-3">
                  <Button
                    variant={detail.role === 'user' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setNewRole('user');
                      setRoleConfirmOpen(true);
                    }}
                    className="text-xs"
                  >
                    普通用户
                  </Button>
                  <Button
                    variant={detail.role === 'admin' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setNewRole('admin');
                      setRoleConfirmOpen(true);
                    }}
                    className="text-xs"
                  >
                    <Shield className="mr-1 h-3.5 w-3.5" />
                    管理员
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              加载失败
            </div>
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
