import fetch from 'node-fetch';
import logger from './logger';

export async function get(url: string) {
  const response = await fetch(url);
  return response.text();
}

export async function post(url: string, body: any) {
  const response = await fetch(url, { method: 'POST', body });
  logger.log(`HTTP response status: ${response.status} - ${response.statusText}`);
  return response.text();
}
