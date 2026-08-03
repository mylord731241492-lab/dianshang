import { useCallback, useEffect, useRef, useState } from "react";

import { getAssetsApi } from "@/integrations/hajimi/browser-client";
import type { CloudAsset } from "@/integrations/hajimi/assets-api";

// 云端资产列表 Hook：每个视图持有自己的分页数据，不共享全局 cloudAssets。
// 解决左侧"资产"（source=upload）与"生图记录"（source=generated）共用一份列表时
// 切换互相覆盖、重新挂载重复请求导致的卡顿与重影。

export type CloudAssetFilter = { q?: string; kind?: string; source?: string };

const PAGE_SIZE = 24;

export function useCloudAssetList(baseFilter: CloudAssetFilter) {
    const [items, setItems] = useState<CloudAsset[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const cursorRef = useRef<string | null>(null);
    const filterRef = useRef<CloudAssetFilter>(baseFilter);
    const baseKey = JSON.stringify({ kind: baseFilter.kind || "", source: baseFilter.source || "" });

    const refresh = useCallback(
        async (filter?: CloudAssetFilter) => {
            const next = { ...filterRef.current, ...(filter || {}) };
            filterRef.current = next;
            setLoading(true);
            setError("");
            try {
                const page = await getAssetsApi().list({ ...next, limit: PAGE_SIZE });
                setItems(page.items);
                setNextCursor(page.nextCursor);
                cursorRef.current = page.nextCursor;
            } catch (err) {
                setError(err instanceof Error ? err.message : "加载云端资产失败");
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    // 基础筛选（kind/source）变化时重取第一页；挂载时取一次。
    useEffect(() => {
        filterRef.current = { ...baseFilter };
        void refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baseKey, refresh]);

    const loadMore = useCallback(async () => {
        const cursor = cursorRef.current;
        if (!cursor || loading) return;
        setLoading(true);
        try {
            const page = await getAssetsApi().list({ ...filterRef.current, cursor, limit: PAGE_SIZE });
            setItems((current) => {
                const merged = [...current];
                page.items.forEach((item) => {
                    if (!merged.some((existing) => existing.id === item.id)) merged.push(item);
                });
                return merged;
            });
            setNextCursor(page.nextCursor);
            cursorRef.current = page.nextCursor;
        } catch (err) {
            setError(err instanceof Error ? err.message : "加载云端资产失败");
        } finally {
            setLoading(false);
        }
    }, [loading]);

    const upload = useCallback(
        async (file: Blob, name?: string) => {
            const asset = await getAssetsApi().upload(file, { name });
            await refresh();
            return asset;
        },
        [refresh],
    );

    const rename = useCallback(async (id: string, patch: { name?: string; tags?: string[] }) => {
        const updated = await getAssetsApi().update(id, patch);
        setItems((current) => current.map((item) => (item.id === id ? { ...item, ...updated } : item)));
    }, []);

    const remove = useCallback(async (id: string) => {
        await getAssetsApi().remove(id);
        setItems((current) => current.filter((item) => item.id !== id));
    }, []);

    return { items, nextCursor, loading, error, refresh, loadMore, upload, rename, remove };
}
