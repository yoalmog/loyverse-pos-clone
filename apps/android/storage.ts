/**
 * Durable Local Storage for Loyverse POS Android
 * Uses @react-native-async-storage/async-storage when available,
 * with automatic fallback to localStorage (Web) or in-memory persistence.
 */

const memoryCache = new Map<string, string>();

let nativeStorage: any = null;
try {
  // Dynamically attempt require for React Native environments
  nativeStorage = require('@react-native-async-storage/async-storage').default;
} catch {
  nativeStorage = null;
}

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (nativeStorage) {
      try {
        const val = await nativeStorage.getItem(key);
        if (val !== null) return val;
      } catch (e) {
        console.warn('[Storage] Native storage read error:', e);
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      } catch (e) {
        console.warn('[Storage] LocalStorage read error:', e);
      }
    }

    return memoryCache.get(key) || null;
  },

  async setItem(key: string, value: string): Promise<void> {
    memoryCache.set(key, value);

    if (nativeStorage) {
      try {
        await nativeStorage.setItem(key, value);
      } catch (e) {
        console.warn('[Storage] Native storage write error:', e);
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
      } catch (e) {
        console.warn('[Storage] LocalStorage write error:', e);
      }
    }
  },

  async removeItem(key: string): Promise<void> {
    memoryCache.delete(key);

    if (nativeStorage) {
      try {
        await nativeStorage.removeItem(key);
      } catch (e) {
        console.warn('[Storage] Native storage delete error:', e);
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
      } catch (e) {
        console.warn('[Storage] LocalStorage delete error:', e);
      }
    }
  },
};
