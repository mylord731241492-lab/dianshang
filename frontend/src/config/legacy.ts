// 旧版入口默认走同源（Docker 同域部署时新旧版同服务）；仅在本地联调独立旧版服务时通过 VITE_LEGACY_ORIGIN 覆盖。
export const legacyOrigin = import.meta.env.VITE_LEGACY_ORIGIN || '';

export function legacyUrl(path: string) {
  const safePath = path.startsWith('/') ? path : `/${path}`;
  return `${legacyOrigin}${safePath}`;
}
