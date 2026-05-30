const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function getToken() {
  return localStorage.getItem('aura_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 204) return null;

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new ApiError(data?.detail || 'Something went wrong', res.status);
  }

  return data;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  signup:      (body) => request('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login:       (body) => request('/auth/login',  { method: 'POST', body: JSON.stringify(body) }),
  googleLogin: (body) => request('/auth/google',  { method: 'POST', body: JSON.stringify(body) }),
  me:          ()     => request('/auth/me'),
};

// ── Chats ─────────────────────────────────────────────────────────────────────

export const chatApi = {
  list:    ()       => request('/chats'),
  get:     (id)     => request(`/chats/${id}`),
  delete:  (id)     => request(`/chats/${id}`, { method: 'DELETE' }),
  rename:  (id, t)  => request(`/chats/${id}`, { method: 'PATCH', body: JSON.stringify({ title: t }) }),
  send:    (body)   => request('/chats/message', { method: 'POST', body: JSON.stringify(body) }),
};

// ── Streaming ─────────────────────────────────────────────────────────────────

export function streamMessage(body, callbacks) {
  const token = getToken();
  const ctrl = new AbortController();

  fetch(`${BASE_URL}/chats/message/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: ctrl.signal,
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Stream failed' }));
      callbacks.onError?.(err.detail);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === 'chat_info') callbacks.onChatInfo?.(event);
          else if (event.type === 'chunk')   callbacks.onChunk?.(event.content);
          else if (event.type === 'title_update') callbacks.onTitleUpdate?.(event.title);
          else if (event.type === 'done')    callbacks.onDone?.(event);
          else if (event.type === 'error')   callbacks.onError?.(event.message);
        } catch {}
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') callbacks.onError?.(err.message);
  });

  return () => ctrl.abort();
}

// ── Files ─────────────────────────────────────────────────────────────────────

export async function uploadFile(file, chatId) {
  const token = getToken();
  const fd = new FormData();
  fd.append('file', file);

  const url = `${BASE_URL}/files/upload${chatId ? `?chat_id=${chatId}` : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.detail || 'Upload failed', res.status);
  return data;
}

export { ApiError };
