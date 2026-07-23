import { http } from './http';

export interface TemplateSlot {
  key: string;
  group?: string;
  label: string;
  description?: string;
  required?: boolean;
  multiple?: boolean;
  maxFiles?: number;
  accept?: string;
}

export interface TemplateField {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

export interface TemplateConfig {
  key: string;
  id?: string;
  templateType?: string;
  name: string;
  templateName?: string;
  desc?: string;
  categoryId?: string;
  categoryName?: string;
  enabled?: boolean;
  tags?: string[];
  platformTags?: string[];
  imageSlots?: TemplateSlot[];
  fields?: TemplateField[];
  generateDefaults?: {
    platform?: string;
    ratio?: string;
    quality?: string;
    imageCount?: number;
  };
  ratioOptions?: Array<{ label: string; value: string }>;
}

export interface TemplateSettings {
  templates: TemplateConfig[];
  platforms?: string[];
  qualities?: string[];
  ratios?: string[];
}

export interface ModelRouteItem {
  routeId?: string;
  lineId?: string;
  routeKey?: string;
  lineKey?: string;
  id?: string;
  name?: string;
  displayName?: string;
  routeDisplayName?: string;
  defaultModel?: string;
  defaultImageModel?: string;
  models?: Array<Record<string, string | number | boolean>>;
}

export interface PromptSuggestion {
  id: string;
  label: string;
  title?: string;
  prompt: string;
  text?: string;
  summary?: string;
  description?: string;
  negativePrompt?: string;
  ratio?: string;
  selected?: boolean;
}

export interface GeneratedImage {
  id?: string;
  url?: string;
  imageUrl?: string;
  preview?: string;
}

export async function getTemplateSettings() {
  const response = await http.get<TemplateSettings>('/api/template/settings');
  return response.data;
}

export async function getModelRoutes(group: 'text' | 'image') {
  const response = await http.get<{ items: ModelRouteItem[] }>('/api/model-routes', { params: { group } });
  return response.data.items || [];
}

export async function uploadTemplateFile(file: File) {
  const form = new FormData();
  form.append('file', file);
  const response = await http.post<{ url?: string; imageUrl?: string; originalUrl?: string }>('/api/upload', form);
  return response.data.url || response.data.imageUrl || response.data.originalUrl || '';
}

export async function reverseTemplatePrompt(payload: Record<string, unknown>) {
  const response = await http.post<{
    prompts?: PromptSuggestion[];
    suggestions?: PromptSuggestion[];
    items?: PromptSuggestion[];
    rawText?: string;
  }>('/api/template/reverse-prompt', payload);
  return response.data;
}

export async function generateTemplateImage(payload: Record<string, unknown>) {
  const idempotencyKey =
    String(payload.clientRequestId || '') ||
    globalThis.crypto?.randomUUID?.() ||
    `template-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const response = await http.post<{
    images?: GeneratedImage[];
    resultImages?: GeneratedImage[];
    results?: GeneratedImage[];
    taskId?: string;
    status?: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
    errorMessage?: string;
    totalCost?: number;
    remainingBalance?: number;
  }>('/api/template/generate-image', { ...payload, clientRequestId: idempotencyKey }, {
    headers: { 'Idempotency-Key': idempotencyKey }
  });
  let data = response.data;
  if (!data.taskId || !['pending', 'running'].includes(String(data.status || ''))) return data;
  const taskId = data.taskId;

  for (let attempt = 0; attempt < 1800; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
    const taskResponse = await http.get<typeof data & {
      stage?: string;
      progress?: number;
      queuePosition?: number;
    }>(`/api/generate/tasks/${encodeURIComponent(taskId)}`);
    data = { ...data, ...taskResponse.data };
    if (['success', 'failed', 'cancelled'].includes(String(data.status || ''))) break;
  }
  if (data.status === 'failed' || data.status === 'cancelled') {
    throw new Error(data.errorMessage || '图片生成失败');
  }
  return data;
}
