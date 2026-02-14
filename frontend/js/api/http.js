export async function http(url, { method = "GET", headers = {}, body } = {}) {
  const token = localStorage.getItem("authAccessToken");

  const response = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API ${response.status}: ${errorText}`);
  }

  if (response.status === 204) return null;

  return response.json();
}

export function json(url, { method = "GET", body } = {}) {
  return http(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}
