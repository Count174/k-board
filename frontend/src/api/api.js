const BASE_URL = '/k-board/api'; 

export const get = async (endpoint) => {
  const res = await fetch(`${BASE_URL}/${endpoint}`);
  return res.json();
};

export const post = async (endpoint, data) => {
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
};
