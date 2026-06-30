const host = typeof location !== 'undefined' ? location.hostname : 'localhost';

export const API_ORIGIN = `http://${host}:2002`;
export const API_URL = `${API_ORIGIN}/api`;

// Converte o caminho de um recurso para o endereço completo da API.
export function resolveApiAsset(url: string): string {
  if (!url || url.startsWith('http')) return url;

  const normalizedUrl = url
    .replace(/^\/api\/uploads\/images\/([^/]+)$/, '/api/images/load/$1')
    .replace(/^\/api\/images\/([^/]+)$/, '/api/images/load/$1');

  return `${API_ORIGIN}${normalizedUrl}`;
}
