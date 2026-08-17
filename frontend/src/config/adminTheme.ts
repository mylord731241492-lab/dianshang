import type { GlobalThemeOverrides } from 'naive-ui';

// Admin 后台统一的 naive-ui 主题覆盖：主强调橙 + 卡片式圆角（对齐用户中心抽屉）。
// 通过 <n-config-provider abstract> 注入，不新增 DOM 节点。
export const adminNaiveThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#f97316',
    primaryColorHover: '#ea580c',
    primaryColorPressed: '#c2410c',
    primaryColorSuppl: '#ea580c',
    borderRadius: '12px',
    borderRadiusSmall: '8px'
  },
  Tag: {
    borderRadius: '999px'
  }
};
