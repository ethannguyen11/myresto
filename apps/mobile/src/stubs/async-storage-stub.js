// Web stub for @react-native-async-storage/async-storage.
// Falls back to localStorage so login/token storage works on web.
module.exports = {
  getItem: async (key) => {
    try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
  },
  setItem: async (key, value) => {
    try { globalThis.localStorage?.setItem(key, value); } catch {}
  },
  removeItem: async (key) => {
    try { globalThis.localStorage?.removeItem(key); } catch {}
  },
  multiGet: async (keys) => keys.map(k => [k, globalThis.localStorage?.getItem(k) ?? null]),
  multiSet: async (pairs) => pairs.forEach(([k, v]) => { try { globalThis.localStorage?.setItem(k, v); } catch {} }),
  multiRemove: async (keys) => keys.forEach(k => { try { globalThis.localStorage?.removeItem(k); } catch {} }),
  clear: async () => { try { globalThis.localStorage?.clear(); } catch {} },
  getAllKeys: async () => {
    try { return Object.keys(globalThis.localStorage ?? {}); } catch { return []; }
  },
  useAsyncStorage: (key) => ({
    getItem: async () => { try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; } },
    setItem: async (value) => { try { globalThis.localStorage?.setItem(key, value); } catch {} },
    removeItem: async () => { try { globalThis.localStorage?.removeItem(key); } catch {} },
  }),
};
