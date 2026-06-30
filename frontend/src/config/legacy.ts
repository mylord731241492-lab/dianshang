export const legacyOrigin = import.meta.env.VITE_LEGACY_ORIGIN || 'http://127.0.0.1:3456';

export function legacyUrl(path: string) {
  const safePath = path.startsWith('/') ? path : `/${path}`;
  return `${legacyOrigin}${safePath}`;
}
