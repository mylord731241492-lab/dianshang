<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  ArrowRight,
  BookOpen,
  Clock,
  FolderPlus,
  GalleryHorizontal,
  Home,
  LayoutGrid,
  LayoutTemplate,
  Trash2,
  UserCircle,
  Workflow
} from 'lucide-vue-next';
import { http, getApiErrorMessage } from '../api/http';
import UserCenterDrawer from '../components/UserCenterDrawer.vue';

// 首页：保留原布局（顶栏 + 侧轨 + Hero + 历史项目）。
// 中央生成模块改为「创建画布」，下方为历史项目。
// 主题跟随画布明暗：读取 infinite-canvas:theme_store（与画布同一个主题存储）。

interface CanvasProject {
  id: string;
  name: string;
  thumbnail?: string;
  updatedAt?: string;
  createdAt?: string;
}

const heroBackgroundUrl = new URL('../assets/home-product-workbench.png', import.meta.url).href;

// 新画布项目的空信封：不附带会创建无信封数据，被新画布误判为旧格式。
const EMPTY_CANVAS_ENVELOPE = {
  schema: 'hjm.infinite-canvas.project',
  schemaVersion: 1,
  engine: 'infinite-canvas',
  upstreamVersion: '0.10.0',
  project: {
    nodes: [],
    connections: [],
    chatSessions: [],
    activeChatId: null,
    backgroundMode: 'lines',
    showImageInfo: false,
    viewport: { x: 0, y: 0, k: 1 }
  }
};

const router = useRouter();
const projects = ref<CanvasProject[]>([]);
const loadingProjects = ref(false);
const creating = ref(false);
const errorMessage = ref('');
const userCenterOpen = ref(false);

const theme = ref<'light' | 'dark'>(readCanvasTheme());

function readCanvasTheme(): 'light' | 'dark' {
  try {
    const raw = window.localStorage.getItem('infinite-canvas:theme_store');
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.state?.theme === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

const sideItems = [
  { label: '首页', to: '/', icon: Home, active: true },
  { label: '新画布', to: '/canvas', icon: Workflow },
  { label: '模板', to: '/template-image', icon: LayoutTemplate },
  { label: '图库', to: '/gallery', icon: GalleryHorizontal },
  { label: '指南', to: '/user/center', icon: BookOpen }
];

function canvasUrl(projectId?: string, prompt?: string) {
  const params = new URLSearchParams();
  if (projectId) params.set('projectId', projectId);
  if (prompt) params.set('prompt', prompt);
  const suffix = params.size ? `?${params.toString()}` : '';
  return `/canvas${projectId ? `/${encodeURIComponent(projectId)}` : ''}${suffix}`;
}

function openCanvas(projectId?: string, prompt?: string) {
  const url = canvasUrl(projectId, prompt);
  if (!window.localStorage.getItem('auth_token')) {
    window.location.assign('/login?redirect=' + encodeURIComponent(url));
    return;
  }
  window.location.href = url;
}

function navigateHomeItem(to: string) {
  if (to === '/canvas') {
    openCanvas();
    return;
  }
  router.push(to);
}

function formatTime(value?: string) {
  if (!value) return new Date().toLocaleString('zh-CN', { hour12: false });
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

async function loadProjects() {
  if (!window.localStorage.getItem('auth_token')) {
    projects.value = [];
    return;
  }
  loadingProjects.value = true;
  try {
    const response = await http.get<{ items?: CanvasProject[]; projects?: CanvasProject[] }>('/api/user/projects');
    projects.value = response.data.items || response.data.projects || [];
  } catch {
    projects.value = [];
  } finally {
    loadingProjects.value = false;
  }
}

async function createProject(prompt?: string) {
  if (creating.value) return;
  if (!window.localStorage.getItem('auth_token')) {
    window.location.assign('/login?redirect=' + encodeURIComponent('/canvas'));
    return;
  }
  creating.value = true;
  errorMessage.value = '';
  try {
    const name = prompt ? prompt.slice(0, 20) : '空白画布';
    const response = await http.post<{ id?: string; project?: CanvasProject }>('/api/user/projects', { name, data: EMPTY_CANVAS_ENVELOPE });
    const id = response.data.project?.id || response.data.id;
    openCanvas(id, prompt);
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '创建画布失败', { unauthorized: '请先登录后再创建画布。' });
    creating.value = false;
  }
}

function openProject(project?: CanvasProject) {
  openCanvas(project?.id);
}

async function deleteProject(project: CanvasProject, event: MouseEvent) {
  event.stopPropagation();
  try {
    await http.delete(`/api/user/projects/${encodeURIComponent(project.id)}`);
    projects.value = projects.value.filter((item) => item.id !== project.id);
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '删除画布项目失败');
  }
}


function handleUserButtonClick() {
  if (window.localStorage.getItem('auth_token')) {
    userCenterOpen.value = true;
    return;
  }
  window.location.assign('/login?redirect=' + encodeURIComponent('/user/center'));
}

onMounted(() => {
  loadProjects();
});
</script>

<template>
  <main class="home-shell home-legacy-shell" :class="`theme-${theme}`">
    <div class="home-background" aria-hidden="true">
      <div class="home-bg-image" :style="{ backgroundImage: `url(${heroBackgroundUrl})` }"></div>
      <div class="home-glow glow-one"></div>
      <div class="home-glow glow-two"></div>
    </div>

    <header class="home-header">
      <button type="button" class="brand-lockup" @click="router.push('/')">
        <span class="brand-orb"></span>
        <span class="brand-text">电商自动化工作台</span>
        <span class="brand-beta">Beta</span>
      </button>
      <div class="header-actions">
        <div class="global-workflow-actions">
          <button type="button" class="workflow-action" @click="openCanvas()">
            <LayoutGrid :size="15" />
            <span>画布中心</span>
          </button>
          <button type="button" class="workflow-action" @click="router.push('/user/records')">
            <Clock :size="15" />
            <span>历史记录</span>
          </button>
        </div>
        <button type="button" class="header-icon-button user" title="用户中心" @click="handleUserButtonClick">
          <UserCircle :size="22" />
        </button>
      </div>
    </header>

    <aside class="side-rail" aria-label="Home navigation">
      <template v-for="(item, index) in sideItems" :key="item.to">
        <button type="button" class="side-item" :class="{ active: item.active }" @click="navigateHomeItem(item.to)">
          <component :is="item.icon" :size="18" />
          <span>{{ item.label }}</span>
        </button>
        <span v-if="index === 0" class="side-divider"></span>
      </template>
    </aside>

    <section class="home-main">
      <section class="hero-section">
        <h1 class="hero-title">电商全流程工作台</h1>
        <p class="hero-desc">从主图、模板、画布到图库，统一完成电商素材生产与管理</p>

        <section class="hero-panel liquid-glass-strong" aria-label="创建画布">
          <div class="hero-inner liquid-glass-strong create-inner">
            <button type="button" class="create-card" :disabled="creating" @click="createProject()">
              <span class="create-icon">
                <FolderPlus :size="26" />
              </span>
              <span class="create-text">
                <strong>{{ creating ? '正在创建…' : '创建画布' }}</strong>
                <small>空白项目 · 图片节点 + 生图节点 + Agent 助手</small>
              </span>
              <ArrowRight :size="22" class="create-arrow" />
            </button>
            <p v-if="errorMessage" class="home-error">{{ errorMessage }}</p>
          </div>
        </section>

        <section class="history-carousel" aria-label="我的历史画布项目">
          <div class="history-header">
            <h2>我的历史画布项目</h2>
            <button type="button" @click="createProject()">
              <FolderPlus :size="14" />
              新建项目 +
            </button>
          </div>
          <div v-if="loadingProjects" class="history-empty liquid-glass">正在加载画布项目</div>
          <div v-else class="history-wrap">
            <div class="history-track">
              <article v-for="project in projects" :key="project.id" class="history-card" @click="openProject(project)">
                <div class="history-thumb">
                  <img v-if="project.thumbnail" :src="project.thumbnail" alt="" />
                  <div v-else class="history-blank">
                    <span>+</span>
                    <em>空白画布</em>
                  </div>
                  <button type="button" class="history-delete" title="删除画布项目" @click="(event) => deleteProject(project, event)">
                    <Trash2 :size="15" />
                  </button>
                  <div class="history-hover">进入画布 -></div>
                </div>
                <div class="history-meta">
                  <strong>{{ project.name || '未命名项目' }}</strong>
                  <span>{{ formatTime(project.updatedAt || project.createdAt) }}</span>
                </div>
              </article>
            </div>
          </div>
        </section>

      </section>
    </section>

    <UserCenterDrawer :open="userCenterOpen" @close="userCenterOpen = false" />
  </main>
</template>

<style scoped>
/* ===== 创建画布模块（替换原生成表单，沿用原有玻璃质感） ===== */
.create-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 34px 28px 26px;
}

.create-card {
  display: flex;
  align-items: center;
  gap: 18px;
  width: min(520px, 100%);
  padding: 20px 24px;
  border: 1px solid rgba(56, 130, 246, 0.35);
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(56, 130, 246, 0.14), rgba(16, 185, 129, 0.08));
  color: inherit;
  cursor: pointer;
  box-shadow: 0 8px 28px rgba(56, 130, 246, 0.12);
  transition: transform 0.18s ease-out, border-color 0.18s ease-out;
}

.create-card:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: rgba(56, 130, 246, 0.75);
}

.create-card:disabled {
  opacity: 0.6;
  cursor: wait;
}

.create-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: rgba(56, 130, 246, 0.18);
  color: #2f6fe0;
  flex-shrink: 0;
}

.create-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: left;
  flex: 1;
}

.create-text strong {
  font-size: 19px;
  font-weight: 700;
}

.create-text small {
  font-size: 12px;
  opacity: 0.55;
}

.create-arrow {
  opacity: 0.5;
  transition: transform 0.18s, opacity 0.18s;
}

.create-card:hover:not(:disabled) .create-arrow {
  transform: translateX(4px);
  opacity: 1;
}

.create-hint {
  margin: 0;
  font-size: 12px;
  opacity: 0.5;
}

/* ===== 性能：移除大面积 backdrop-filter（hover 重绘主凶），视觉以半透底色兜底 ===== */
.home-legacy-shell .home-background::after,
.home-legacy-shell .home-header,
.home-legacy-shell .hero-panel,
.home-legacy-shell .hero-inner,
.home-legacy-shell .history-carousel,
.liquid-glass,
.liquid-glass-strong {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* ===== 历史卡片动画优化：去掉 scale 与遮罩淡入淡出，只保留瞬时状态切换 ===== */
.home-legacy-shell .history-card {
  transition: transform 0.16s ease-out, border-color 0.16s ease-out;
}

.home-legacy-shell .history-card:hover {
  transform: translateY(-2px);
}

.home-legacy-shell .history-hover {
  transition: none;
}

/* ===== 暗色主题（匹配画布暗色模式） ===== */
.theme-dark.home-legacy-shell {
  background: #0a0c10;
  color: #e7eaf0;
}

.theme-dark .home-background {
  background:
    radial-gradient(circle at 16% 14%, rgba(56, 130, 246, 0.1), transparent 32%),
    radial-gradient(circle at 82% 20%, rgba(16, 185, 129, 0.08), transparent 36%),
    linear-gradient(180deg, #0a0c10 0%, #0c1016 50%, #090b0f 100%);
}

.theme-dark .home-bg-image {
  opacity: 0.14;
  filter: blur(14px) saturate(0.7) brightness(0.55);
}

.theme-dark .home-background::after {
  background:
    linear-gradient(90deg, rgba(10, 12, 16, 0.88) 0%, rgba(10, 12, 16, 0.66) 45%, rgba(10, 12, 16, 0.35) 100%),
    radial-gradient(circle at 58% 48%, rgba(56, 130, 246, 0.08), transparent 38%),
    linear-gradient(180deg, rgba(10, 12, 16, 0.1), rgba(10, 12, 16, 0.35));
}

.theme-dark .hero-title,
.theme-dark .brand-text,
.theme-dark .history-header h2 {
  color: #f2f4f8;
}

.theme-dark .hero-desc,
.theme-dark .create-hint {
  color: rgba(231, 234, 240, 0.55);
}

.theme-dark .liquid-glass,
.theme-dark .liquid-glass-strong,
.theme-dark .hero-panel,
.theme-dark .hero-inner,
.theme-dark .history-empty {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.09);
  box-shadow: none;
}

.theme-dark .home-header {
  background: transparent;
  box-shadow: none;
}

.theme-dark .global-workflow-actions,
.theme-dark .side-rail {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: none;
}

.theme-dark .workflow-action,
.theme-dark .side-item,
.theme-dark .history-header button {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  color: rgba(231, 234, 240, 0.75);
  box-shadow: none;
}

.theme-dark .workflow-action:hover,
.theme-dark .side-item:hover,
.theme-dark .history-header button:hover {
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
}

.theme-dark .side-item.active {
  background: rgba(56, 130, 246, 0.18);
  color: #7eb0f9;
}

.theme-dark .header-icon-button {
  color: rgba(231, 234, 240, 0.75);
  border-color: rgba(255, 255, 255, 0.1);
}

.theme-dark .brand-beta {
  background: rgba(56, 130, 246, 0.18);
  color: #7eb0f9;
}

.theme-dark .create-card {
  background: linear-gradient(135deg, rgba(56, 130, 246, 0.2), rgba(16, 185, 129, 0.1));
  color: #e7eaf0;
}

.theme-dark .create-icon {
  color: #7eb0f9;
}

.theme-dark .history-card {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
}

.theme-dark .history-card:hover {
  border-color: rgba(56, 130, 246, 0.5);
}

.theme-dark .history-meta strong {
  color: #e7eaf0;
}

.theme-dark .history-meta span {
  color: rgba(231, 234, 240, 0.4);
}

.theme-dark .history-blank {
  color: rgba(231, 234, 240, 0.3);
}
</style>
