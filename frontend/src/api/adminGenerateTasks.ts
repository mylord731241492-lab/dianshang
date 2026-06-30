import { http } from './http';

export interface AdminGenerateTask {
  id: string;
  taskId?: string;
  userId?: string;
  username?: string;
  lineKey?: string;
  routeName?: string;
  routeDisplayName?: string;
  model?: string;
  modelKey?: string;
  modelDisplayName?: string;
  resolvedModel?: string;
  prompt?: string;
  promptPreview?: string;
  promptLength?: number;
  resultUrl?: string;
  imageUrl?: string;
  status?: string;
  progress?: number;
  cost?: number;
  costPoints?: number;
  chargeStatus?: string;
  imageCount?: number;
  size?: string;
  resolvedSize?: string;
  quality?: string;
  referenceImageCount?: number;
  referenceImageTotalSizeText?: string;
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
}

export interface AdminGenerateTaskSummary {
  total?: number;
  pending?: number;
  running?: number;
  success?: number;
  failed?: number;
  queueMode?: string;
}

export interface AdminGenerateTaskListParams {
  page?: number;
  pageSize?: number;
  status?: string;
}

export interface AdminGenerateTaskListResponse {
  success?: boolean;
  items: AdminGenerateTask[];
  tasks: AdminGenerateTask[];
  list?: AdminGenerateTask[];
  data?: AdminGenerateTask[];
  total: number;
  page: number;
  pageSize: number;
  summary: AdminGenerateTaskSummary;
}

interface RawAdminGenerateTaskListResponse {
  success?: boolean;
  items?: AdminGenerateTask[];
  tasks?: AdminGenerateTask[];
  list?: AdminGenerateTask[];
  data?: AdminGenerateTask[];
  total?: number;
  page?: number;
  pageSize?: number;
  summary?: AdminGenerateTaskSummary;
}

export async function getAdminGenerateTasks(
  params: AdminGenerateTaskListParams = {}
): Promise<AdminGenerateTaskListResponse> {
  const requestParams = {
    ...params,
    status: params.status && params.status !== 'all' ? params.status : undefined
  };
  const response = await http.get<RawAdminGenerateTaskListResponse>('/api/admin/generate-tasks', {
    params: requestParams
  });
  const data = response.data;
  const tasks = data.tasks || data.items || data.list || data.data || [];
  return {
    ...data,
    items: tasks,
    tasks,
    total: Number(data.total ?? tasks.length),
    page: Number(data.page ?? params.page ?? 1),
    pageSize: Number(data.pageSize ?? params.pageSize ?? (tasks.length || 10)),
    summary: data.summary || {}
  };
}
