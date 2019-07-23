import fetch from 'node-fetch';

export async function get(url: string) {
  const response = await fetch(url);
  return response.text();
}

export async function post(url: string, body: any) {
  const response = await fetch(url, { method: 'POST', body });
  return response.text();
}
