import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";

import { nanoid } from "nanoid";
import { localForageStorage } from "@/lib/localforage-storage";
import { cleanupUnusedImages, resolveImageUrl, uploadImage } from "@/services/image-storage";
import { cleanupUnusedMedia, resolveMediaUrl } from "@/services/file-storage";
import { getAssetsApi } from "@/integrations/hajimi/browser-client";
import type { CloudAsset, CloudAssetKind } from "@/integrations/hajimi/assets-api";

export type AssetKind = "text" | "image" | "video";
export type TextAsset = AssetBase<"text"> & { data: { content: string } };
export type ImageAsset = AssetBase<"image"> & { data: { dataUrl: string; storageKey?: string; width: number; height: number; bytes: number; mimeType: string } };
export type VideoAsset = AssetBase<"video"> & { data: { url: string; storageKey?: string; width: number; height: number; bytes: number; mimeType: string } };
export type Asset = TextAsset | ImageAsset | VideoAsset;

type AssetBase<T extends AssetKind> = {
    id: string;
    kind: T;
    title: string;
    coverUrl: string;
    tags: string[];
    source?: string;
    note?: string;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown>;
};

type AssetStore = {
    hydrated: boolean;
    assets: Asset[];
    addAsset: (asset: Omit<Asset, "id" | "createdAt" | "updatedAt">) => string;
    updateAsset: (id: string, patch: Partial<Omit<Asset, "id" | "createdAt">>) => void;
    removeAsset: (id: string) => void;
    replaceAssets: (assets: Asset[]) => void;
    cleanupImages: (extra?: unknown) => void;
    // 云端资产库（ADR-0006）：事实源为 /api/user/assets*，以下状态只是当前账号的内存镜像，
    // 不持久化到 IndexedDB，401/登出时由 browser-client 调 resetCloudAssets 清空。
    cloudAssets: CloudAsset[];
    cloudNextCursor: string | null;
    cloudLoading: boolean;
    cloudError: string;
    cloudFilter: { q?: string; kind?: CloudAssetKind };
    refreshCloudAssets: (filter?: { q?: string; kind?: CloudAssetKind }) => Promise<void>;
    loadMoreCloudAssets: () => Promise<void>;
    uploadCloudAsset: (file: Blob, name?: string) => Promise<CloudAsset>;
    renameCloudAsset: (id: string, patch: { name?: string; tags?: string[] }) => Promise<void>;
    deleteCloudAsset: (id: string) => Promise<void>;
    resetCloudAssets: () => void;
};

const CLOUD_PAGE_SIZE = 24;

const ASSET_STORE_KEY = "infinite-canvas:asset_store";

const assetStorage: PersistStorage<AssetStore> = {
    getItem: async (name) => {
        const value = await localForageStorage.getItem(name);
        if (!value) return null;
        const parsed = JSON.parse(value) as StorageValue<AssetStore>;
        parsed.state.assets = await Promise.all(
            parsed.state.assets.map(async (asset) => {
                if (asset.kind === "video" && asset.data.storageKey) return { ...asset, data: { ...asset.data, url: await resolveMediaUrl(asset.data.storageKey, asset.data.url) } };
                if (asset.kind !== "image") return asset;
                if (asset.data.storageKey)
                    return {
                        ...asset,
                        coverUrl: asset.coverUrl.startsWith("blob:") ? await resolveImageUrl(asset.data.storageKey, asset.coverUrl) : asset.coverUrl,
                        data: { ...asset.data, dataUrl: await resolveImageUrl(asset.data.storageKey, asset.data.dataUrl) },
                    };
                if (!asset.data.dataUrl.startsWith("data:image/")) return asset;
                const image = await uploadImage(asset.data.dataUrl);
                return { ...asset, coverUrl: asset.coverUrl.startsWith("data:image/") ? image.url : asset.coverUrl, data: { ...asset.data, dataUrl: image.url, storageKey: image.storageKey, bytes: image.bytes, mimeType: image.mimeType } };
            }),
        );
        return parsed;
    },
    setItem: (name, value) => localForageStorage.setItem(name, JSON.stringify(value)),
    removeItem: (name) => localForageStorage.removeItem(name),
};

export const useAssetStore = create<AssetStore>()(
    persist(
        (set, get) => ({
            hydrated: false,
            assets: [],
            addAsset: (asset) => {
                const now = new Date().toISOString();
                const id = nanoid();
                set((state) => ({ assets: [{ ...asset, id, createdAt: now, updatedAt: now } as Asset, ...state.assets] }));
                return id;
            },
            updateAsset: (id, patch) =>
                set((state) => ({
                    assets: state.assets.map((asset) => (asset.id === id ? ({ ...asset, ...patch, updatedAt: new Date().toISOString() } as Asset) : asset)),
                })),
            removeAsset: (id) =>
                set((state) => {
                    const assets = state.assets.filter((asset) => asset.id !== id);
                    get().cleanupImages({ assets });
                    return { assets };
                }),
            replaceAssets: (assets) => set({ assets }),
            cleanupImages: (extra) => {
                window.setTimeout(async () => {
                    const { useCanvasStore } = await import("@/stores/canvas/use-canvas-store");
                    await cleanupUnusedImages({ assets: get().assets, projects: useCanvasStore.getState().projects, extra });
                    await cleanupUnusedMedia({ assets: get().assets, projects: useCanvasStore.getState().projects, extra });
                }, 0);
            },
            cloudAssets: [],
            cloudNextCursor: null,
            cloudLoading: false,
            cloudError: "",
            cloudFilter: {},
            refreshCloudAssets: async (filter) => {
                const nextFilter = filter ?? get().cloudFilter;
                set({ cloudLoading: true, cloudError: "", cloudFilter: nextFilter });
                try {
                    const page = await getAssetsApi().list({ q: nextFilter.q, kind: nextFilter.kind, limit: CLOUD_PAGE_SIZE });
                    set({ cloudAssets: page.items, cloudNextCursor: page.nextCursor, cloudLoading: false });
                } catch (error) {
                    set({ cloudLoading: false, cloudError: error instanceof Error ? error.message : "加载云端资产失败" });
                }
            },
            loadMoreCloudAssets: async () => {
                const { cloudNextCursor, cloudFilter, cloudAssets, cloudLoading } = get();
                if (!cloudNextCursor || cloudLoading) return;
                set({ cloudLoading: true, cloudError: "" });
                try {
                    const page = await getAssetsApi().list({ q: cloudFilter.q, kind: cloudFilter.kind, cursor: cloudNextCursor, limit: CLOUD_PAGE_SIZE });
                    const merged = [...cloudAssets];
                    page.items.forEach((item) => {
                        if (!merged.some((existing) => existing.id === item.id)) merged.push(item);
                    });
                    set({ cloudAssets: merged, cloudNextCursor: page.nextCursor, cloudLoading: false });
                } catch (error) {
                    set({ cloudLoading: false, cloudError: error instanceof Error ? error.message : "加载云端资产失败" });
                }
            },
            uploadCloudAsset: async (file, name) => {
                const asset = await getAssetsApi().upload(file, { name });
                set((state) => ({ cloudAssets: [asset, ...state.cloudAssets.filter((item) => item.id !== asset.id)] }));
                return asset;
            },
            renameCloudAsset: async (id, patch) => {
                const asset = await getAssetsApi().update(id, patch);
                set((state) => ({ cloudAssets: state.cloudAssets.map((item) => (item.id === id ? asset : item)) }));
            },
            // 软删除：仅标记服务端 deleted_at；浏览器不做任何对象存储删除。
            deleteCloudAsset: async (id) => {
                await getAssetsApi().remove(id);
                set((state) => ({ cloudAssets: state.cloudAssets.filter((item) => item.id !== id) }));
            },
            resetCloudAssets: () => set({ cloudAssets: [], cloudNextCursor: null, cloudLoading: false, cloudError: "", cloudFilter: {} }),
        }),
        {
            name: ASSET_STORE_KEY,
            storage: assetStorage,
            // 只持久化本地文本类资产；cloud* 是服务端事实源的内存镜像，不落 IndexedDB。
            partialize: (state) => ({ assets: state.assets }) as StorageValue<AssetStore>["state"],
            onRehydrateStorage: () => () => {
                useAssetStore.setState({ hydrated: true });
            },
        },
    ),
);
