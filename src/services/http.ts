declare const __HRPRO_API_URL__: string | undefined;

const normalizeBase = (value?: string) => {
  if (!value || typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : undefined;
};

const runtimeApiBase = normalizeBase((window as any).HRPRO_API_URL as string | undefined);
const buildApiBase = normalizeBase(__HRPRO_API_URL__);

export const API_BASE = runtimeApiBase || buildApiBase || 'http://localhost:4000';

export const getAuthToken = () => localStorage.getItem('hrpro_token');

export const setAuthToken = (token: string) => {
  localStorage.setItem('hrpro_token', token);
};

export const clearAuthToken = () => {
  localStorage.removeItem('hrpro_token');
};

export const request = async <T>(
  path: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed');
  }

  return response.json();
};
