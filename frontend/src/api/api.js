const BASE_URL = '/k-board/api'; 

export const get = async (endpoint) => {
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
  return res.json();
};

export async function post(endpoint, body) {
  const res = await fetch(`/k-board/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(text || 'Ошибка запроса');
  }

  // Если тело пустое — вернём {}
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export const remove = async (endpoint) => {
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Ошибка удаления: ${res.status}`);
};