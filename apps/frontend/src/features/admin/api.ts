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
  membership?: {
    status: string;
    expiredAt: string | null;
    plan: { name: string; level: string } | null;
  } | null;
}

export interface AdminUserDetail extends AdminUser {
  membership?: {
    status: string;
    startedAt: string | null;
    expiredAt: string | null;
    plan: { id: string; name: string; level: string } | null;
  } | null;
  _count: {
    practiceRecords: number;
    mockExamRecords: number;
    vocabularyWords: number;
    orders: number;
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
