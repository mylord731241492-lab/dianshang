import type { Component } from 'vue';
import {
  Activity,
  BarChart3,
  Coins,
  CreditCard,
  Gauge,
  KeyRound,
  ListChecks,
  ReceiptText,
  Recycle,
  Settings,
  ShieldCheck,
  Users
} from 'lucide-vue-next';

export interface AdminNavigationItem {
  label: string;
  path: string;
  group: 'overview' | 'operations' | 'system';
  icon: Component;
}

export const adminNavigationItems: AdminNavigationItem[] = [
  { label: '控制台 Dashboard', path: '/admin/dashboard', group: 'overview', icon: Gauge },
  { label: '用户管理', path: '/admin/users', group: 'operations', icon: Users },
  { label: '回收站', path: '/admin/recycle-bin', group: 'operations', icon: Recycle },
  { label: '订单管理', path: '/admin/orders', group: 'operations', icon: ReceiptText },
  { label: '消费日志', path: '/admin/logs', group: 'operations', icon: Coins },
  { label: '任务监控', path: '/admin/generate-tasks', group: 'operations', icon: Activity },
  { label: '兑换码管理', path: '/admin/redeem-codes', group: 'operations', icon: CreditCard },
  { label: 'API 线路', path: '/admin/api-providers', group: 'system', icon: KeyRound },
  { label: '模型价格', path: '/admin/model-prices', group: 'system', icon: BarChart3 },
  { label: '模板工作流', path: '/admin/template-workflows', group: 'system', icon: ListChecks },
  { label: '系统设置', path: '/admin/settings', group: 'system', icon: Settings }
];

export const adminNavigationGroups = [
  { key: 'overview', label: '总览' },
  { key: 'operations', label: '运营' },
  { key: 'system', label: '系统' }
] as const;

export const adminBrandIcon = ShieldCheck;
