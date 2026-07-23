import { useEffect, useState } from 'react';

interface ImageRoute {
  id?: string;
  routeId?: string;
  lineId?: string;
  displayName?: string;
  name?: string;
  enabled?: boolean;
  status?: string;
}

const STORAGE_KEY = 'hjm-chat-image-route-id';

function routeIdOf(route: ImageRoute): string {
  return String(route.id ?? route.routeId ?? route.lineId ?? '').trim();
}

function routeNameOf(route: ImageRoute): string {
  return String(route.displayName ?? route.name ?? '生图线路').trim();
}

function mainAuthToken(): string {
  return (
    window.localStorage.getItem('auth_token') ??
    window.localStorage.getItem('admin_auth_token') ??
    ''
  );
}

export default function HjmImageRouteSelect() {
  const [routes, setRoutes] = useState<ImageRoute[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [status, setStatus] = useState('正在读取…');
  const [saving, setSaving] = useState(false);
  const token = mainAuthToken();

  useEffect(() => {
    let cancelled = false;

    async function loadRoutes() {
      const routesResponse = await fetch('/api/model-routes?group=image', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const routesData = await routesResponse.json();
      if (!routesResponse.ok) {
        throw new Error(routesData?.message || '生图线路加载失败');
      }
      const availableRoutes = (Array.isArray(routesData?.items) ? routesData.items : [])
        .filter(
          (route: ImageRoute) =>
            routeIdOf(route) && route.enabled !== false && route.status !== 'disabled',
        );
      if (cancelled) {
        return;
      }
      setRoutes(availableRoutes);

      let preferredRouteId = window.localStorage.getItem(STORAGE_KEY) ?? '';
      if (token) {
        const statusResponse = await fetch('/api/user/api-status', {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const statusData = await statusResponse.json();
        if (statusResponse.ok) {
          preferredRouteId = String(
            statusData?.provider?.routeId ?? statusData?.provider?.id ?? preferredRouteId,
          );
        }
      }

      const matchedRoute = availableRoutes.find((route: ImageRoute) => routeIdOf(route) === preferredRouteId);
      const nextId = routeIdOf(matchedRoute ?? availableRoutes[0] ?? {});
      setSelectedId(nextId);
      if (nextId) {
        window.localStorage.setItem(STORAGE_KEY, nextId);
      }
      setStatus(token ? '' : '重新登录后可切换');
    }

    void loadRoutes().catch((error) => {
      if (!cancelled) {
        setStatus(error instanceof Error ? error.message : '线路加载失败');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function changeRoute(nextId: string) {
    if (!token || !nextId || nextId === selectedId) {
      return;
    }
    const previousId = selectedId;
    setSelectedId(nextId);
    setSaving(true);
    setStatus('保存中…');
    try {
      const response = await fetch('/api/user/preferences/api-route', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageRouteId: nextId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || '线路切换失败');
      }
      const savedId = String(data?.routeId ?? nextId);
      setSelectedId(savedId);
      window.localStorage.setItem(STORAGE_KEY, savedId);
      setStatus('已切换');
      window.setTimeout(() => setStatus(''), 1600);
    } catch (error) {
      setSelectedId(previousId);
      setStatus(error instanceof Error ? error.message : '线路切换失败');
    } finally {
      setSaving(false);
    }
  }

  if (routes.length === 0 && !status) {
    return null;
  }

  return (
    <div
      className="flex min-w-0 items-center gap-1.5 text-xs text-text-secondary"
      title={status || '选择后，新创建的生图报价将使用该线路'}
      onClick={(event) => event.stopPropagation()}
    >
      <label htmlFor="hjm-image-route-select" className="whitespace-nowrap pl-1">
        生图线路
      </label>
      <select
        id="hjm-image-route-select"
        aria-label="选择生图线路"
        value={selectedId}
        disabled={!token || saving || routes.length === 0}
        onChange={(event) => void changeRoute(event.target.value)}
        className="h-8 max-w-40 rounded-lg border border-border-light bg-surface-secondary px-2 text-xs text-text-primary outline-none transition-colors hover:bg-surface-tertiary focus:border-border-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-border-dark"
      >
        {routes.map((route) => (
          <option key={routeIdOf(route)} value={routeIdOf(route)}>
            {routeNameOf(route)}
          </option>
        ))}
      </select>
      {status && <span className="hidden max-w-24 truncate sm:inline">{status}</span>}
    </div>
  );
}
