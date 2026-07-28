import localforage from "localforage";

import { readImageMeta } from "@/lib/image-utils";
import { getAssetsApi } from "@/integrations/hajimi/browser-client";
import { assetStorageKey, parseAssetStorageKey } from "@/integrations/hajimi/assets-api";

// ADR-0006：账号图片资产的事实源是服务端 /api/user/assets*，IndexedDB 只保留按用户隔离的
// 瞬态缓存（401/登出时由 integrations/hajimi/browser-client 清空）。
// 一切来源（本地文件、剪贴板、裁剪、生成结果 Blob/Data URL）都先上传云端，
// 项目节点只保存 storageKey = "asset:<assetId>" 与展示元数据；旧 "image:" 键仅用于读取历史本地数据。

export type UploadedImage = {
    url: string;
    storageKey: string;
    width: number;
    height: number;
    bytes: number;
    mimeType: string;
};

const store = localforage.createInstance({ name: "infinite-canvas", storeName: "image_files" });
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

export async function uploadImage(input: string | Blob): Promise<UploadedImage> {
    const blob = typeof input === "string" ? await (await fetch(input)).blob() : input;
    const tempUrl = URL.createObjectURL(blob);
    const meta = await readImageMeta(tempUrl);
    URL.revokeObjectURL(tempUrl);
    const asset = await getAssetsApi().upload(blob);
    const storageKey = assetStorageKey(asset.id);
    await store.setItem(storageKey, blob);
    const url = rememberObjectUrl(storageKey, blob);
    return { url, storageKey, width: meta.width, height: meta.height, bytes: blob.size, mimeType: asset.mimeType || blob.type || meta.mimeType };
}

// 生图任务结果已在服务端落入资产库（source='generated'）：不重复上传，
// 只把字节经短时 accessUrl 读进瞬态缓存并读取尺寸，节点保存 storageKey = "asset:<assetId>"。
export async function adoptCloudAssetImage(assetId: string, accessUrl?: string): Promise<UploadedImage | null> {
    const storageKey = assetStorageKey(assetId);
    try {
        let blob = await store.getItem<Blob>(storageKey);
        if (!blob) {
            const url = accessUrl || (await getAssetsApi().getAccessUrl(assetId)).url;
            const response = await fetch(url);
            if (!response.ok) return null;
            blob = await response.blob();
            await store.setItem(storageKey, blob);
        }
        const tempUrl = URL.createObjectURL(blob);
        const meta = await readImageMeta(tempUrl);
        URL.revokeObjectURL(tempUrl);
        const url = rememberObjectUrl(storageKey, blob);
        return { url, storageKey, width: meta.width, height: meta.height, bytes: blob.size, mimeType: blob.type || meta.mimeType };
    } catch {
        return null;
    }
}

export async function resolveImageUrl(storageKey?: string, fallback = "") {
    if (!storageKey) return fallback;
    const cached = objectUrls.get(storageKey);
    if (cached) return cached;
    const blob = (await store.getItem<Blob>(storageKey)) || (await fetchCloudAssetBlob(storageKey));
    if (!blob) return fallback;
    return rememberObjectUrl(storageKey, blob);
}

export async function getImageBlob(storageKey: string) {
    return (await store.getItem<Blob>(storageKey)) || (await fetchCloudAssetBlob(storageKey));
}

export async function setImageBlob(storageKey: string, blob: Blob) {
    await store.setItem(storageKey, blob);
    return rememberObjectUrl(storageKey, blob);
}

export async function imageToDataUrl(image: { url?: string; dataUrl?: string; storageKey?: string }) {
    const url = image.dataUrl || (await resolveImageUrl(image.storageKey, image.url || ""));
    if (!url || url.startsWith("data:")) return url;
    return blobToDataUrl(await (await fetch(url)).blob());
}

export async function deleteStoredImages(keys: Iterable<string>) {
    await Promise.all(
        Array.from(new Set(keys)).map(async (key) => {
            const url = objectUrls.get(key);
            if (url) URL.revokeObjectURL(url);
            objectUrls.delete(key);
            await store.removeItem(key);
        }),
    );
}

// 只清理浏览器临时 Object URL 与本地瞬态缓存；云端资产与对象存储不受影响，
// 云对象的删除只能由后端软删除接口完成，浏览器不得调用对象存储删除接口。
export async function cleanupUnusedImages(usedData: unknown) {
    const usedKeys = collectImageStorageKeys(usedData);
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

// 会话失效（401/登出）时清空全部图片瞬态缓存；不影响服务端资产。
export async function clearTransientImageCache() {
    for (const url of objectUrls.values()) URL.revokeObjectURL(url);
    objectUrls.clear();
    await store.clear();
}

export function collectImageStorageKeys(value: unknown, keys = new Set<string>()) {
    if (!value || typeof value !== "object") return keys;
    if (
        "storageKey" in value &&
        typeof value.storageKey === "string" &&
        (value.storageKey.startsWith("image:") || value.storageKey.startsWith("asset:"))
    )
        keys.add(value.storageKey);
    Object.values(value).forEach((item) => (Array.isArray(item) ? item.forEach((child) => collectImageStorageKeys(child, keys)) : collectImageStorageKeys(item, keys)));
    return keys;
}

function blobToDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("读取图片失败"));
        reader.readAsDataURL(blob);
    });
}
