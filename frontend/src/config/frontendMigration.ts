export type FrontendMigrationStatus = 'source' | 'legacy' | 'blocked';

export interface FrontendMigrationRoute {
  path: string;
  title: string;
  area: 'front' | 'canvas' | 'template' | 'gallery' | 'user' | 'admin';
  status: FrontendMigrationStatus;
  note: string;
}

export const frontendMigrationRoutes: FrontendMigrationRoute[] = [
  { path: '/', title: '首页', area: 'front', status: 'source', note: '已按旧站实际首页迁移顶部栏、侧栏、生成面板和历史画布项目区。' },
  { path: '/canvas', title: '画布', area: 'canvas', status: 'source', note: 'Vue 入口直接跳转旧画布运行时，不显示迁移中转页。' },
  { path: '/template-image', title: '模板生图', area: 'template', status: 'source', note: '源码第一版已接入模板配置、素材槽、反推和生成接口。' },
  { path: '/gallery', title: '图库历史', area: 'gallery', status: 'source', note: '源码第一版已对接 /api/user/generations。' },
  { path: '/login', title: '登录', area: 'user', status: 'source', note: '源码第一版已对接 /api/auth/login。' },
  { path: '/register', title: '注册', area: 'user', status: 'source', note: '源码第一版已对接验证码和注册接口。' },
  { path: '/user/center', title: '用户中心', area: 'user', status: 'source', note: '源码第一版已接入资料、余额流水和 API 状态。' },
  { path: '/user/records', title: '生成记录', area: 'user', status: 'source', note: '源码第一版已接入生成历史和余额流水。' },
  { path: '/user/redeem', title: '兑换码', area: 'user', status: 'source', note: '源码第一版已接入兑换码提交和流水刷新。' },
  { path: '/admin/login', title: '后台登录', area: 'admin', status: 'source', note: '源码第一版已接入 /api/admin/login，旧后台仍保留独立入口。' },
  { path: '/admin/dashboard', title: '后台控制台', area: 'admin', status: 'source', note: '源码后台已统一共用侧栏；Dashboard 保持只读统计。' },
  { path: '/admin/users', title: '用户管理', area: 'admin', status: 'source', note: '源码第一版已接入只读用户列表与搜索。' },
  { path: '/admin/recycle-bin', title: '回收站', area: 'admin', status: 'source', note: '源码第一版已接入只读回收站列表。' },
  { path: '/admin/orders', title: '订单管理', area: 'admin', status: 'source', note: '源码第一版已接入只读订单列表与搜索。' },
  { path: '/admin/logs', title: '消费日志', area: 'admin', status: 'source', note: '源码第一版已接入只读消费流水列表。' },
  { path: '/admin/generate-tasks', title: '任务监控', area: 'admin', status: 'source', note: '源码第一版已接入只读任务监控列表。' },
  { path: '/admin/redeem-codes', title: '兑换码管理', area: 'admin', status: 'source', note: '源码第一版已接入只读兑换码列表与搜索。' },
  { path: '/admin/api-providers', title: 'API 线路管理', area: 'admin', status: 'source', note: '写入试点已接入旧后台字段、保存回显、默认线路和 API Key 掩码；真实测试连接需确认。' },
  { path: '/admin/model-prices', title: '模型价格', area: 'admin', status: 'source', note: '源码第一版已接入只读模型价格列表与搜索。' },
  { path: '/admin/template-workflows', title: '模板工作流', area: 'admin', status: 'source', note: '源码第一版已接入只读模板工作流列表与搜索。' },
  { path: '/admin/settings', title: '系统设置', area: 'admin', status: 'source', note: '保存试点已接入基础设置和图片工具配置草稿回显。' }
];

export const bridgeRoutes = frontendMigrationRoutes.filter((route) => route.status === 'legacy');
