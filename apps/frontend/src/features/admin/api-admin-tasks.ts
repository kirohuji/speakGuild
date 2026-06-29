import { get, post } from '@/lib/request';

export type AdminTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

export interface AdminTask {
  id: string;
  type: string;
  status: AdminTaskStatus;
  title: string;
  targetType?: string | null;
  targetId?: string | null;
  bullJobId?: string | null;
  progress: number;
  currentStep?: string | null;
  totalItems: number;
  processedItems: number;
  successItems: number;
  failedItems: number;
  payload?: any;
  summary?: any;
  errorMessage?: string | null;
  createdById?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTaskLog {
  id: string;
  taskId: string;
  level: 'info' | 'warn' | 'error';
  step?: string | null;
  message: string;
  meta?: any;
  createdAt: string;
}

export interface AdminTaskDetail extends AdminTask {
  logs: AdminTaskLog[];
}

export interface AdminTaskListResult {
  items: AdminTask[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const adminTasksApi = {
  list: (params?: { type?: string; status?: AdminTaskStatus | 'all'; page?: number; pageSize?: number }) =>
    get<AdminTaskListResult>('/admin/tasks', {
      ...params,
      status: params?.status === 'all' ? undefined : params?.status,
    }),

  get: (id: string) => get<AdminTaskDetail>(`/admin/tasks/${id}`, undefined, { dedupe: false }),

  retry: (id: string) => post<AdminTask>(`/admin/tasks/${id}/retry`),

  cancel: (id: string) => post<AdminTaskDetail>(`/admin/tasks/${id}/cancel`),
};
