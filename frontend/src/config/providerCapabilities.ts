export type ProviderCapabilityKind = 'image.generate' | 'image.edit' | 'text.responses';

export interface ProviderRequestExample {
  label: string;
  capability: ProviderCapabilityKind;
  endpoint: string;
  method: 'POST';
  contentType: string;
  requestFormat: string;
  body: Record<string, unknown>;
}

export const GPT_IMAGE_2_REQUEST_EXAMPLES: ProviderRequestExample[] = [
  {
    label: '文生图',
    capability: 'image.generate',
    endpoint: '/images/generations',
    method: 'POST',
    contentType: 'application/json',
    requestFormat: 'packy-openai-images-generations',
    body: {
      model: 'gpt-image-2',
      prompt: 'string',
      size: '1024x1024',
      quality: 'auto',
      output_format: 'png',
      response_format: 'url',
      n: 1
    }
  },
  {
    label: '图生图 / 局部重绘',
    capability: 'image.edit',
    endpoint: '/images/edits',
    method: 'POST',
    contentType: 'multipart/form-data',
    requestFormat: 'packy-openai-images-edits',
    body: {
      model: 'gpt-image-2',
      image: '<file>',
      mask: '<file optional>',
      prompt: 'string',
      size: '1024x1024',
      quality: 'auto',
      output_format: 'png',
      response_format: 'url',
      n: 1
    }
  }
];

export const GPT_5_6_TERRA_REQUEST_EXAMPLES: ProviderRequestExample[] = [
  {
    label: '文本生成',
    capability: 'text.responses',
    endpoint: '/responses',
    method: 'POST',
    contentType: 'application/json',
    requestFormat: 'openai-responses',
    body: {
      model: 'gpt-5.6-terra',
      input: 'string'
    }
  }
];

export const PROVIDER_CAPABILITY_REGISTRY: Record<string, ProviderRequestExample[]> = {
  'gpt-image-2': GPT_IMAGE_2_REQUEST_EXAMPLES,
  'gpt-5.6-terra': GPT_5_6_TERRA_REQUEST_EXAMPLES
};

export function getProviderRequestExamples(modelKey?: string) {
  return modelKey ? PROVIDER_CAPABILITY_REGISTRY[modelKey] || [] : [];
}
