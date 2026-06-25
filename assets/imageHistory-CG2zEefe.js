import { r as ref } from "./index-DglIsp_g.js";

const STORAGE_KEY = "ai-canvas-image-history";
const MAX_ITEMS = 200;
const imageHistory = ref([]);

const normalizeUrl = (value = "") => {
  const url = String(value || "").trim();
  return url.startsWith("data:image/png;base64,/uploads/") ? url.slice(22) : url;
};

const canPersistUrl = (value = "") => {
  const url = normalizeUrl(value);
  return !!(url && !url.startsWith("data:") && !url.startsWith("blob:"));
};

const isLocalOnlyHistoryItem = (item = {}) => {
  if (item.assetId || item.localFileName) return true;
  if (item.assetKind && item.assetKind !== "generated") return true;
  return false;
};

const saveImageHistory = () => {
  try {
    const rows = imageHistory.value.map((item) => ({
      ...item,
      url: canPersistUrl(item.url) ? normalizeUrl(item.url) : "",
      assetId: item.assetId || "",
      localFileName: item.localFileName || "",
      assetKind: item.assetKind || "",
      width: item.width || 0,
      height: item.height || 0,
      requestedSize: item.requestedSize || ""
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch (error) {
    console.error("Failed to save image history:", error);
    window.$message?.warning("图片历史保存失败，可能是浏览器存储空间不足");
  }
};

const normalizeServerHistoryItem = (item = {}) => ({
  id: item.id || `server_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  url: normalizeUrl(item.url || item.imageUrl || item.resultUrl || item.result_url || ""),
  assetId: item.assetId || "",
  localFileName: item.localFileName || "",
  assetKind: "generated",
  label: item.label || "生成图片",
  prompt: item.prompt || "",
  model: item.model || item.modelKey || item.model_key || "",
  size: item.size || item.requestedSize || "",
  requestedSize: item.requestedSize || item.size || "",
  width: Number(item.width || 0) || 0,
  height: Number(item.height || 0) || 0,
  quality: item.quality || "",
  clarity: item.clarity || "",
  nodeId: item.nodeId || "",
  serverSynced: true,
  createdAt: item.createdAt || item.created_at || new Date().toISOString()
});

const syncServerImageHistory = async () => {
  try {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    const response = await fetch("/api/user/generations", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return;

    const payload = await response.json();
    const rows = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.data) ? payload.data : [];
    const serverItems = rows
      .map(normalizeServerHistoryItem)
      .filter((item) => item.url || item.assetId || item.localFileName);
    const localOnly = imageHistory.value.filter(isLocalOnlyHistoryItem);

    imageHistory.value = [...serverItems, ...localOnly].slice(0, MAX_ITEMS);
    saveImageHistory();
  } catch (error) {
    console.warn("Failed to sync server image history:", error);
  }
};

const initImageHistory = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const rows = JSON.parse(stored);
      imageHistory.value = Array.isArray(rows)
        ? rows.map((item) => ({ ...item, url: normalizeUrl(item?.url) })).filter((item) => item?.url || item?.assetId || item?.localFileName)
        : [];
    }
  } catch (error) {
    console.error("Failed to load image history:", error);
    imageHistory.value = [];
  }
  syncServerImageHistory();
};

const addImageHistory = (item) => {
  if (!item?.url && !item?.assetId && !item?.localFileName) return null;
  const url = normalizeUrl(item.url);
  const safeUrl = (item.assetId || item.localFileName) && !canPersistUrl(url) ? "" : url;
  const row = {
    id: `history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    url: safeUrl,
    assetId: item.assetId || "",
    localFileName: item.localFileName || "",
    assetKind: item.assetKind || "",
    label: item.label || "生成图片",
    prompt: item.prompt || "",
    model: item.model || "",
    size: item.size || "",
    requestedSize: item.requestedSize || item.size || "",
    width: Number(item.width || item.assetWidth || 0) || 0,
    height: Number(item.height || item.assetHeight || 0) || 0,
    quality: item.quality || "",
    clarity: item.clarity || "",
    nodeId: item.nodeId || "",
    createdAt: item.createdAt || new Date().toISOString()
  };
  const key = row.assetId || row.localFileName || row.url;
  imageHistory.value = [row, ...imageHistory.value.filter((existing) => (existing.assetId || existing.localFileName || existing.url) !== key)].slice(0, MAX_ITEMS);
  saveImageHistory();
  return row;
};

const removeImageHistory = (id) => {
  imageHistory.value = imageHistory.value.filter((item) => item.id !== id);
  saveImageHistory();
};

const clearImageHistory = () => {
  imageHistory.value = [];
  saveImageHistory();
};

export { addImageHistory as a, imageHistory as b, clearImageHistory as c, initImageHistory as i, removeImageHistory as r };
