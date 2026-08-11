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

export interface QueueStatusItem {
  name: string;
  label: string;
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
}

export interface QueuesStatusResult {
  queues: QueueStatusItem[];
  totalWaiting: number;
  totalActive: number;
  totalDelayed: number;
  totalFailed: number;
}

export interface QueueJobInfo {
  id: string;
  name: string;
  status: string;
  progress: number;
  attemptsMade: number;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  data: any;
}

export interface QueueJobsResult {
  queueName: string;
  jobs: QueueJobInfo[];
  total: number;
}

export const adminTasksApi = {
  list: (params?: { type?: string; status?: AdminTaskStatus | 'all' | 'active'; page?: number; pageSize?: number }) =>
    get<AdminTaskListResult>('/admin/tasks', {
      ...params,
      status: params?.status === 'all' || params?.status === 'active' ? undefined : params?.status,
      statuses: params?.status === 'active' ? 'queued,running' : undefined,
    }),

  get: (id: string) => get<AdminTaskDetail>(`/admin/tasks/${id}`, undefined, { dedupe: false }),

  retry: (id: string) => post<AdminTask>(`/admin/tasks/${id}/retry`),

  cancel: (id: string) => post<AdminTaskDetail>(`/admin/tasks/${id}/cancel`),

  /** 获取所有队列的状态概览 */
  getQueuesStatus: () => get<QueuesStatusResult>('/admin/tasks/queues/status'),

  /** 查看某个队列中的任务 */
  getQueueJobs: (queueName: string, statuses?: string[]) =>
    get<QueueJobsResult>(`/admin/tasks/queues/${queueName}/jobs`, {
      statuses: statuses?.join(',') ?? 'waiting,active,delayed',
    }),

  /** 插队：把排队中的任务提到队列最前面 */
  prioritize: (id: string) => post<AdminTaskDetail>(`/admin/tasks/${id}/prioritize`),

  /** 强制执行：立即执行一个排队中或失败的任务 */
  forceRun: (id: string) => post<AdminTaskDetail>(`/admin/tasks/${id}/force-run`),
};
