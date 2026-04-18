const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';


function getTokens() {
  if (typeof window === 'undefined') return { accessToken: null, refreshToken: null };
  return {
    accessToken: localStorage.getItem('relife_access_token'),
    refreshToken: localStorage.getItem('relife_refresh_token')
  };
}


async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = getTokens();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    if (!res.ok) return null;
    const data = await res.json();
    localStorage.setItem('relife_access_token', data.accessToken);
    return data.accessToken;
  } catch { return null; }
}


async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const { accessToken } = getTokens();

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers
    },
    ...options
  });

  if (res.status === 401 && retry) {
    const code = await res.json().then(d => d.code).catch(() => null);
    if (code === 'TOKEN_EXPIRED') {
      const newToken = await refreshAccessToken();
      if (newToken) return request<T>(path, options, false);
    }
    // Force logout
    localStorage.removeItem('relife_access_token');
    localStorage.removeItem('relife_refresh_token');
    window.location.reload();
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}




export async function authRegister(name: string, email: string, password: string) {
  return request<any>('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
}

export async function authMe() {
  return request<any>('/api/auth/me');
}

export async function authLogin(email: string, password: string) {
  return request<any>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export async function authLogout() {
  return request<any>('/api/auth/logout', { method: 'POST' });
}