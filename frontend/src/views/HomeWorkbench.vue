<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  BookOpen,
  ChevronDown,
  Clock,
  Download,
  FolderPlus,
  GalleryHorizontal,
  Home,
  LayoutTemplate,
  Save,
  Sparkles,
  Trash2,
  UserCircle,
  Workflow,
  X
} from 'lucide-vue-next';
import {
  generateTemplateImage,
  uploadTemplateFile,
  type GeneratedImage
} from '../api/templateImage';
import { http, getApiErrorMessage } from '../api/http';
import { legacyUrl } from '../config/legacy';

const heroBackgroundUrl = new URL('../assets/home-product-workbench.png', import.meta.url).href;

interface CanvasProject {
  id: string;
  name: string;
  thumbnail?: string;
  updatedAt?: string;
  createdAt?: string;
}

const router = useRouter();
const projects = ref<CanvasProject[]>([]);
const uploadedImages = ref<Array<{ name: string; url: string; preview: string }>>([]);
const generatedImages = ref<GeneratedImage[]>([]);
const loadingProjects = ref(false);
const uploading = ref(false);
const generating = ref(false);
const errorMessage = ref('');

const form = reactive({
  mode: 'quick',
  prompt: '',
  imageRouteId: '',
  imageModelKey: 'gpt-image-2',
  imageCount: '1',
  ratio: '1:1',
  quality: '1k'
});

const modeOptions = [
  { label: 'Chat 对话', value: 'chat' },
  { label: 'Fast 快速', value: 'quick' },
  { label: 'AI 专业绘图 Agent', value: 'agent', badge: 'new' }
];

const countOptions = [
  { label: '1 张', value: '1' },
  { label: '2 张', value: '2' },
  { label: '4 张', value: '4' }
];

const ratioOptions = [
  { label: '1:1', value: '1:1' },
  { label: '4:5', value: '4:5' },
  { label: '3:4', value: '3:4' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' }
];

const qualityOptions = [
  { label: '1K', value: '1k' },
  { label: '2K', value: '2k' },
  { label: '4K', value: '4k' }
];

const sideItems = [
  { label: '首页', to: '/', icon: Home, active: true },
  { label: '新画布', to: '/canvas', icon: Workflow },
  { label: '模板', to: '/template-image', icon: LayoutTemplate },
  { label: '图库', to: '/gallery', icon: GalleryHorizontal },
  { label: '指南', to: '/user/center', icon: BookOpen }
];

const imageRouteOptions = computed(() => {
  return [{ label: 'GPT Image 2', value: 'route_openai_gpt_image_2' }];
});

const modelOptions = computed(() => {
  return [{ label: 'GPT Image 2', value: 'gpt-image-2' }];
});

const selectedModelLabel = computed(() => modelOptions.value.find((item) => item.value === form.imageModelKey)?.label || 'GPT Image 2');
const selectedCountLabel = computed(() => countOptions.find((item) => item.value === form.imageCount)?.label || '1 张');
const selectedQualityLabel = computed(() => qualityOptions.find((item) => item.value === form.quality)?.label || '1K');
const estimatedCost = computed(() => Number(form.imageCount || 1) * 10);

function canvasUrl(projectId?: string) {
  const suffix = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return `${legacyUrl('/canvas')}${suffix}`;
}

function openCanvas(projectId?: string) {
  window.location.href = canvasUrl(projectId);
}

function navigateHomeItem(to: string) {
  if (to === '/canvas') {
    openCanvas();
    return;
  }
  router.push(to);
}

function resultUrl(item: GeneratedImage) {
  return item.url || item.imageUrl || item.preview || '';
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

async function addFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []).slice(0, 6 - uploadedImages.value.length);
  if (!files.length) return;
  uploading.value = true;
  errorMessage.value = '';
  try {
    for (const file of files) {
      const preview = URL.createObjectURL(file);
      const url = await uploadTemplateFile(file);
      uploadedImages.value.push({ name: file.name, url, preview });
    }
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '图片上传失败', { unauthorized: '请先登录后再上传图片。' });
  } finally {
    input.value = '';
    uploading.value = false;
  }
}

function removeImage(index: number) {
  const [item] = uploadedImages.value.splice(index, 1);
  if (item?.preview) URL.revokeObjectURL(item.preview);
}

async function generateImage() {
  if (!form.prompt.trim() && !uploadedImages.value.length) {
    errorMessage.value = '请输入提示词或添加图片。';
    return;
  }
  generating.value = true;
  errorMessage.value = '';
  generatedImages.value = [];
  try {
    const data = await generateTemplateImage({
      templateKey: 'home-index',
      templateType: 'home-index',
      prompt: form.prompt.trim(),
      fields: { userPrompt: form.prompt.trim(), mode: form.mode },
      imageSlots: {
        reference: uploadedImages.value.map((item) => ({ name: item.name, url: item.url }))
      },
      ratio: form.ratio,
      quality: form.quality.toUpperCase(),
      imageCount: Number(form.imageCount || 1),
      imageRouteId: form.imageRouteId,
      imageModelKey: form.imageModelKey,
      imageModel: form.imageModelKey,
      selectedPrompts: form.prompt.trim()
        ? [{ id: 'home_prompt', label: '首页提示词', prompt: form.prompt.trim() }]
        : []
    });
    generatedImages.value = data.resultImages || data.images || data.results || [];
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '生成图片失败', { unauthorized: '请先登录后再生成图片。' });
  } finally {
    generating.value = false;
  }
}

async function createProject() {
  try {
    const response = await http.post<{ id?: string; project?: CanvasProject }>('/api/user/projects', { name: '空白画布' });
    const id = response.data.project?.id || response.data.id;
    openCanvas(id);
  } catch {
    openCanvas();
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

onMounted(async () => {
  form.imageRouteId = imageRouteOptions.value[0]?.value || '';
  await loadProjects();
});
</script>

<template>
  <main class="home-shell home-legacy-shell">
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
            <Download :size="15" />
            <span>导出</span>
          </button>
          <button type="button" class="workflow-action" @click="openCanvas()">
            <Save :size="15" />
            <span>保存</span>
          </button>
          <button type="button" class="workflow-action" @click="router.push('/user/records')">
            <Clock :size="15" />
            <span>历史记录</span>
          </button>
        </div>
        <button type="button" class="header-icon-button" title="样式 1：视频播放">
          <Sparkles :size="18" />
        </button>
        <button type="button" class="header-icon-button user" title="登录" @click="router.push('/login')">
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

        <section class="hero-panel liquid-glass-strong" aria-label="首页快速生成">
          <div class="hero-inner liquid-glass-strong">
            <div class="hero-tabs liquid-glass" role="tablist" aria-label="生成模式">
              <button
                v-for="item in modeOptions"
                :key="item.value"
                type="button"
                class="hero-tab"
                :class="{ active: form.mode === item.value }"
                @click="form.mode = item.value"
              >
                {{ item.label }}
                <span v-if="item.badge" class="tab-badge">{{ item.badge }}</span>
              </button>
            </div>

            <div class="prompt-row">
              <label class="upload-box liquid-glass" :title="uploadedImages.length ? '继续添加图片' : '可选：拖拽或添加底图'">
                <input type="file" accept="image/*" multiple @change="addFiles" />
                <div v-if="uploading" class="upload-state">
                  <span class="upload-plus">...</span>
                  <span>上传中</span>
                </div>
                <div v-else-if="uploadedImages.length" class="upload-preview">
                  <div class="upload-preview-grid">
                    <figure v-for="(image, index) in uploadedImages.slice(0, 4)" :key="image.preview" class="upload-preview-thumb">
                      <span class="upload-order-badge">{{ index + 1 }}</span>
                      <img :src="image.preview" alt="" />
                      <button type="button" title="移除图片" @click.prevent="removeImage(index)">
                        <X :size="13" />
                      </button>
                    </figure>
                  </div>
                  <span class="upload-count-badge">{{ uploadedImages.length }} 张</span>
                </div>
                <div v-else class="upload-empty">
                  <span class="upload-plus">+</span>
                  <span>添加图片</span>
                  <small>可选：拖拽或添加底图</small>
                </div>
              </label>

              <div class="prompt-input-wrap liquid-glass">
                <textarea
                  v-model="form.prompt"
                  class="prompt-input"
                  maxlength="500"
                  placeholder="请输入你的图片生成创意与排版需求，例如：雨天魔法森林、日照暖阳黄金沙滩..."
                  @keydown.ctrl.enter.prevent="generateImage"
                ></textarea>
                <span class="prompt-count">{{ form.prompt.length }} / 500</span>
              </div>
            </div>

            <div class="params-row">
              <div class="params-left">
                <label class="param-pill liquid-glass">
                  <span class="pill-dot"></span>
                  <select v-model="form.imageModelKey">
                    <option v-for="item in modelOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
                  </select>
                  <span>{{ selectedModelLabel }}</span>
                  <ChevronDown :size="14" />
                </label>
                <label class="param-pill liquid-glass">
                  <select v-model="form.imageCount">
                    <option v-for="item in countOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
                  </select>
                  <span>{{ selectedCountLabel }}</span>
                  <ChevronDown :size="14" />
                </label>
                <label class="param-pill liquid-glass">
                  <select v-model="form.ratio">
                    <option v-for="item in ratioOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
                  </select>
                  <span>{{ form.ratio }}</span>
                  <ChevronDown :size="14" />
                </label>
                <label class="param-pill liquid-glass">
                  <select v-model="form.quality">
                    <option v-for="item in qualityOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
                  </select>
                  <span>{{ selectedQualityLabel }}</span>
                  <ChevronDown :size="14" />
                </label>
                <div class="power-cost liquid-glass">
                  <span>预计消耗</span>
                  <strong>{{ estimatedCost }}</strong>
                  <span>算力</span>
                </div>
              </div>
              <button type="button" class="generate-button" :disabled="generating || uploading" @click="generateImage">
                <Sparkles :size="17" />
                <span>{{ generating ? '生成中' : '生成' }}</span>
              </button>
            </div>

            <p v-if="errorMessage" class="home-error">{{ errorMessage }}</p>
            <div v-if="generatedImages.length" class="home-generated-strip">
              <a v-for="image in generatedImages" :key="resultUrl(image)" :href="resultUrl(image)" target="_blank">
                <img :src="resultUrl(image)" alt="生成结果" />
              </a>
            </div>
          </div>
        </section>

        <section class="history-carousel" aria-label="我的历史画布项目">
          <div class="history-header">
            <h2>我的历史画布项目</h2>
            <button type="button" @click="createProject">
              <FolderPlus :size="14" />
              新建项目 +
            </button>
          </div>
          <div v-if="loadingProjects" class="history-empty liquid-glass">正在加载画布项目</div>
          <div v-else class="history-wrap">
            <button type="button" class="history-nav history-nav-left" aria-label="上一组">
              <span>‹</span>
            </button>
            <div class="history-track">
              <article class="history-card" @click="openProject()">
                <div class="history-thumb">
                  <div class="history-blank">
                    <span>+</span>
                    <em>空白画布</em>
                  </div>
                  <div class="history-hover">进入画布 -></div>
                </div>
                <div class="history-meta">
                  <strong>示例项目</strong>
                  <span>{{ formatTime() }}</span>
                </div>
              </article>

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
            <button type="button" class="history-nav history-nav-right" aria-label="下一组">
              <span>›</span>
            </button>
          </div>
        </section>
      </section>
    </section>
  </main>
</template>
