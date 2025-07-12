const BASE_URL = '/k-board/api'; 

export const get = async (endpoint) => {
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
  return res.json();
};

export const post = async (endpoint, data) => {
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
};

export const remove = async (endpoint) => {
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Ошибка удаления: ${res.status}`);
};