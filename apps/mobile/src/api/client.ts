import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const BASE_URL = __DEV__
  ? 'http://192.168.0.6:3000'
  : 'https://api.chefai.fr';

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('access_token');
}

export async function apiRequest<T = any>(
  method: string,
  path: string,
  body?: any,
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && !path.includes('/auth/login')) {
    await AsyncStorage.removeItem('access_token');
    router.replace('/login');
  }

  const data = await response.json();
  if (!response.ok) {
    const err: any = new Error(data?.message ?? 'Request failed');
    err.response = { status: response.status, data };
    throw err;
  }
  return data;
}

export async function apiUpload<T = any>(path: string, formData: FormData): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // No Content-Type — fetch sets it automatically with the multipart boundary

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (response.status === 401) {
    await AsyncStorage.removeItem('access_token');
    router.replace('/login');
  }

  const data = await response.json();
  if (!response.ok) {
    const err: any = new Error(data?.message ?? 'Upload failed');
    err.response = { status: response.status, data };
    throw err;
  }
  return data;
}
