import { get, patch, post } from '@/lib/request';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  username: string | null;
  image: string | null;
  role: 'user' | 'admin';
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  createdAt: string;
  updatedAt: string;
  online?: boolean;
  activeSessionCount?: number;
  recentSession?: {
    updatedAt: string;
    ipAddress: string | null;
    userAgent: string | null;
  } | null;
  membership?: {
    status: string;
    expiredAt: string | null;
    plan: { name: string; level: string } | null;
  } | null;
}

export interface AdminUserDetail extends AdminUser {
  outputLevel?: string;
  outputLevelDetail?: {
    source?: string;
    assessedAt?: string;
    [key: string]: unknown;
  } | null;
  totalXp?: number;
  points?: number;
  userLevel?: number;
  learningGoals?: string[];
  presence?: {
    online: boolean;
    socketCount: number;
  };
  sessions?: Array<{
    id: string;
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
    ipAddress: string | null;
    userAgent: string | null;
  }>;
  accounts?: Array<{
    id: string;
    providerId: string;
    accountId: string;
    createdAt: string;
    updatedAt: string;
  }>;
  membership?: {
    status: string;
    startedAt: string | null;
    expiredAt: string | null;
    plan: { id: string; name: string; level: string } | null;
  } | null;
  _count: {
    practiceSessions: number;
    scriptRecords: number;
  };
}

export interface AdminUsersResult {
  list: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminMember {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'expired' | 'cancelled';
  startedAt: string;
  expiredAt: string;
  rcCustomerId: string | null;
  user: { id: string; email: string; name: string; username: string | null };
  plan: { id: string; name: string; level: string };
}

export interface AdminMemberDetail extends AdminMember {
  orders: AdminOrder[];
}

export interface AdminMembersResult {
  list: AdminMember[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminOrder {
  id: string;
  orderNo: string;
  userId: string;
  planId: string;
  amount: number;
  paymentMethod: 'alipay' | 'wechat';
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  paymentRef: string | null;
  billingCycle: string;
  paidAt: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string };
  plan: { id: string; name: string; level: string };
}

export interface AdminOrdersResult {
  list: AdminOrder[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminOrderStats {
  totalOrders: number;
  paidOrders: number;
  totalRevenue: number;
  recentOrders: AdminOrder[];
}

export async function listUsers(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
}) {
  return get<AdminUsersResult>('/admin/users', params);
}

export async function getUserDetail(id: string) {
  return get<AdminUserDetail>(`/admin/users/${id}`);
}

export async function updateUserRole(id: string, role: 'user' | 'admin') {
  return patch<AdminUser>(`/admin/users/${id}/role`, { role });
}

// ─── 会员管理 ──────────────────────────────────────────────

export async function listMembers(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
}) {
  return get<AdminMembersResult>('/admin/members', params);
}

export async function getMemberDetail(userId: string) {
  return get<AdminMemberDetail>(`/admin/members/${userId}`);
}

export async function cancelMembership(userId: string) {
  return post<AdminMember>(`/admin/members/${userId}/cancel`);
}

// ─── 订单/账单管理 ──────────────────────────────────────────

export async function listOrders(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
}) {
  return get<AdminOrdersResult>('/admin/orders', params);
}

export async function getOrderStats() {
  return get<AdminOrderStats>('/admin/orders/stats');
}

// ─── AI 用量统计 ──────────────────────────────────────────

export interface AiUsageOverview {
  todayDialogue: number
  todaySummary: number
  todayTokens: number
  weekDialogue: number
  weekSummary: number
  weekTokens: number
  monthDialogue: number
  monthSummary: number
  monthTokens: number
  totalCachedWords: number
  totalUsers: number
}

export interface AiUsageTrendPoint {
  date: string
  dialogue: number
  summary: number
  tokens: number
}

export interface AiUsageTopUser {
  userId: string
  name: string
  email: string
  dialogue: number
  summary: number
  tokens: number
}

export interface AiUsageStats {
  overview: AiUsageOverview
  trend: AiUsageTrendPoint[]
  topUsers: AiUsageTopUser[]
}

export interface UserAiUsageDaily {
  date: string
  dialogue: number
  summary: number
  tokens: number
}

export interface UserAiUsage {
  user: { id: string; name: string; email: string; role: string }
  totals: { dialogue: number; summary: number; tokens: number }
  dailyUsages: UserAiUsageDaily[]
  cachedWordCount: number
}

export async function getAiUsageStats(): Promise<AiUsageStats> {
  return get('/admin/stats/ai-usage')
}

export async function getUserAiUsage(userId: string): Promise<UserAiUsage> {
  return get(`/admin/users/${userId}/ai-usage`)
}

// ─── 测试支付 ──────────────────────────────────────────────

export interface TestPaymentResult {
  orderNo: string;
  amount: number;
  paymentMethod: string;
  status: string;
  payUrl?: string;
}

export async function testPayment() {
  return post<TestPaymentResult>('/admin/test-payment');
}
