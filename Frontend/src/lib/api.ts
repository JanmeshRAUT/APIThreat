export const API_BASE = import.meta.env.VITE_API_URL ?? 'https://apithreat.onrender.com';

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = localStorage.getItem('gatekeeper_admin_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401 && !path.startsWith('/api/auth/')) {
    localStorage.removeItem('gatekeeper_admin_token');
    window.location.assign(window.location.pathname);
  }

  return response;
}
