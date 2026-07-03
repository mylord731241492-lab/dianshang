import { http } from './http';

export interface AdminTemplateSlot {
  key?: string;
  group?: string;
  label?: string;
  description?: string;
  role?: string;
  required?: boolean;
  multiple?: boolean;
  maxFiles?: number;
  accept?: string;
}

export interface AdminTemplateField {
  key?: string;
  label?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  mapsTo?: string;
  options?: string[];
}

export interface AdminTemplateWorkflow {
  key: string;
  id?: string;
  templateType?: string;
  name?: string;
  templateName?: string;
  desc?: string;
  enabled?: boolean;
  version?: number;
  imageSlots?: AdminTemplateSlot[];
  fields?: AdminTemplateField[];
  outputSchema?: {
    type?: string;
    maxItems?: number;
  };
  promptBlocks?: Record<string, string>;
  presetPrompts?: Array<{
    id?: string;
    title?: string;
    label?: string;
    prompt?: string;
    negativePrompt?: string;
    styleTags?: string[];
  }>;
  skillPrompts?: Array<{
    id?: string;
    title?: string;
    label?: string;
    prompt?: string;
  }>;
  categoryId?: string;
  categoryName?: string;
  coverImage?: string;
  tags?: string[];
  platformTags?: string[];
  sort?: number;
  galleryEnabled?: boolean;
  ratioOptions?: Array<{ label?: string; value?: string }>;
  recommendedRatio?: string;
  generateDefaults?: {
    platform?: string;
    ratio?: string;
    quality?: string;
    imageCount?: number;
  };
  skillFile?: {
    fileName?: string;
    path?: string;
    exists?: boolean;
    updatedAt?: string;
    promptCount?: number;
  };
}

export interface AdminTemplateWorkflowResponse {
  success?: boolean;
  templates: AdminTemplateWorkflow[];
  items: AdminTemplateWorkflow[];
  data: AdminTemplateWorkflow[];
  platforms: string[];
  qualities: string[];
  ratios: string[];
  model_configs?: Record<string, unknown>;
}

interface RawAdminTemplateWorkflowResponse {
  success?: boolean;
  templates?: AdminTemplateWorkflow[];
  items?: AdminTemplateWorkflow[];
  data?: AdminTemplateWorkflow[];
  platforms?: string[];
  qualities?: string[];
  ratios?: string[];
  model_configs?: Record<string, unknown>;
}

export async function getAdminTemplateWorkflows(): Promise<AdminTemplateWorkflowResponse> {
  const response = await http.get<RawAdminTemplateWorkflowResponse>('/api/admin/template-workflows');
  const data = response.data;
  const templates = data.templates || data.items || data.data || [];
  return {
    ...data,
    templates,
    items: templates,
    data: templates,
    platforms: data.platforms || [],
    qualities: data.qualities || [],
    ratios: data.ratios || [],
    model_configs: data.model_configs || {}
  };
}

export async function uploadAdminTemplateSkill(templateKey: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const response = await http.post<{
    success?: boolean;
    template?: AdminTemplateWorkflow;
    skill?: Record<string, unknown>;
    file?: AdminTemplateWorkflow['skillFile'];
  }>(`/api/admin/template-workflows/${encodeURIComponent(templateKey)}/skill/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
}
