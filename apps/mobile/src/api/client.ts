import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { router } from 'expo-router';

// Production: public API once deployed
// Development — Android emulator: host machine is 10.0.2.2
//             — iOS simulator / web: localhost resolves to host machine
const BASE_URL = __DEV__
  ? Platform.OS === 'android'
    ? 'http://10.0.2.2:3000'
    : 'http://localhost:3000'
  : 'https://api.chefai.fr'; // URL de production future

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Attach JWT token to every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 → redirect to login (except on /auth/login itself)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url: string = error.config?.url ?? '';
    if (error.response?.status === 401 && !url.includes('/auth/login')) {
      await AsyncStorage.removeItem('access_token');
      router.replace('/login');
    }
    console.error('[API]', error.config?.method?.toUpperCase(), url, error.response?.status);
    return Promise.reject(error);
  },
);
