import localforage from "localforage";

import { getAssetsApi } from "@/integrations/hajimi/browser-client";
import { assetStorageKey, parseAssetStorageKey } from "@/integrations/hajimi/assets-api";

// ADR-0006：视频/音频资产与图片同一契约——一切来源先上传 /api/user/assets/upload，
// 节点只保存 storageKey = "asset:<assetId>"；IndexedDB 仅为按用户隔离的瞬态缓存，
// 旧 "<prefix>:" 键仅用于读取历史本地数据。

export type UploadedFile = { url: string; storageKey: string; bytes: number; mimeType: string; width?: number; height?: number; durationMs?: number };

const store = localforage.createInstance({ name: "infinite-canvas", storeName: "media_files" });
const objectUrls = new Map<string, string>();

function rememberObjectUrl(storageKey: string, blob: Blob) {
    const existing = objectUrls.get(storageKey);
    if (existing) URL.revokeObjectURL(existing);
    const url = URL.createObjectURL(blob);
    objectUrls.set(storageKey, url);
    return url;
}

// 缓存未命中时经后端签发的 15 分钟短时效 URL 回读资产字节并写回瞬态缓存。
async function fetchCloudAssetBlob(storageKey: string): Promise<Blob | null> {
    const assetId = parseAssetStorageKey(storageKey);
    if (!assetId) return null;
    try {
        const access = await getAssetsApi().getAccessUrl(assetId);
        const response = await fetch(access.url);
        if (!response.ok) return null;
        const blob = await response.blob();
        await store.setItem(storageKey, blob);
        return blob;
    } catch {
        return null;
    }
}

// prefix 参数仅为兼容旧调用签名保留；云端资产键固定为 asset:<assetId>。
export async function uploadMediaFile(input: string | Blob, _prefix = "file"): Promise<UploadedFile> {
    const blob = typeof input === "string" ? await (await fetch(input)).blob() : input;
    const tempUrl = URL.createObjectURL(blob);
    const meta = blob.type.startsWith("video/") ? await readVideoMeta(tempUrl) : blob.type.startsWith("audio/") ? await readAudioMeta(tempUrl) : {};
    const asset = await getAssetsApi().upload(blob);
    const storageKey = assetStorageKey(asset.id);
    await store.setItem(storageKey, blob);
    const url = rememberObjectUrl(storageKey, blob);
    return { url, storageKey, bytes: blob.size, mimeType: asset.mimeType || blob.type || "application/octet-stream", ...meta };
}

export async function resolveMediaUrl(storageKey?: string, fallback = "") {
    if (!storageKey) return fallback;
    const cached = objectUrls.get(storageKey);
    if (cached) return cached;
    const blob = (await store.getItem<Blob>(storageKey)) || (await fetchCloudAssetBlob(storageKey));
    if (!blob) return fallback;
    return rememberObjectUrl(storageKey, blob);
}

export async function getMediaBlob(storageKey: string) {
    return (await store.getItem<Blob>(storageKey)) || (await fetchCloudAssetBlob(storageKey));
}

export async function setMediaBlob(storageKey: string, blob: Blob) {
    await store.setItem(storageKey, blob);
    return rememberObjectUrl(storageKey, blob);
}

export async function deleteStoredMedia(keys: Iterable<string>) {
    await Promise.all(
        Array.from(new Set(keys)).map(async (key) => {
            const url = objectUrls.get(key);
            if (url) URL.revokeObjectURL(url);
            objectUrls.delete(key);
            await store.removeItem(key);
        }),
    );
}

// 只清理浏览器临时 Object URL 与本地瞬态缓存；云端资产与对象存储不受影响。
export async function cleanupUnusedMedia(usedData: unknown) {
    const usedKeys = collectMediaStorageKeys(usedData);
    for (const [key, url] of objectUrls) {
        if (usedKeys.has(key)) continue;
        URL.revokeObjectURL(url);
        objectUrls.delete(key);
    }
    const unused: string[] = [];
    await store.iterate((_value, key) => {
        if (!usedKeys.has(key)) unused.push(key);
    });
    await Promise.all(unused.map((key) => store.removeItem(key)));
}

// 会话失效（401/登出）时清空全部媒体瞬态缓存；不影响服务端资产。
export async function clearTransientMediaCache() {
    for (const url of objectUrls.values()) URL.revokeObjectURL(url);
    objectUrls.clear();
    await store.clear();
}

export function collectMediaStorageKeys(value: unknown, keys = new Set<string>()) {
    if (!value || typeof value !== "object") return keys;
    if ("storageKey" in value && typeof value.storageKey === "string" && value.storageKey.includes(":")) keys.add(value.storageKey);
    Object.values(value).forEach((item) => (Array.isArray(item) ? item.forEach((child) => collectMediaStorageKeys(child, keys)) : collectMediaStorageKeys(item, keys)));
    return keys;
}

function readVideoMeta(url: string) {
    return new Promise<{ width: number; height: number; durationMs?: number }>((resolve) => {
        const video = document.createElement("video");
        const done = () => resolve({ width: video.videoWidth || 1280, height: video.videoHeight || 720, durationMs: Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : undefined });
        video.onloadedmetadata = done;
        video.onerror = done;
        video.src = url;
    });
}

function readAudioMeta(url: string) {
    return new Promise<{ durationMs?: number }>((resolve) => {
        const audio = document.createElement("audio");
        const done = () => resolve({ durationMs: Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : undefined });
        audio.onloadedmetadata = done;
        audio.onerror = done;
        audio.src = url;
    });
}
