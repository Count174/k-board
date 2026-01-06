const BASE_URL = '/api';

function joinUrl(base, endpoint) {
  const ep = String(endpoint || '').trim();
  if (!ep) return base;
  return ep.startsWith('/') ? `${base}${ep}` : `${base}/${ep}`;
}

async function parseJsonOrEmpty(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export const get = async (endpoint) => {
  const res = await fetch(joinUrl(BASE_URL, endpoint), {
    credentials: 'include',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Ошибка: ${res.status}`);
  }

  return res.json();
};

export async function post(endpoint, body) {
  const res = await fetch(joinUrl(BASE_URL, endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body ?? {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Ошибка запроса');
  }

  return parseJsonOrEmpty(res);
}

export const remove = async (endpoint) => {
  const res = await fetch(joinUrl(BASE_URL, endpoint), {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Ошибка удаления: ${res.status}`);
  }

  // DELETE часто возвращает 204 No Content
  return;
};