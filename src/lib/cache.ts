/**
 * Tarayıcı Önbelleği (localStorage) + Akıllı Senkronizasyon (Stale-While-Revalidate)
 * Sitenin ilk açılışta 0 saniyede yüklenmesini ve Firestore okuma kotasını %95+ korumasını sağlar.
 */

const CACHE_PREFIX = 'dost_swr_v1_';
const inflightMap = new Map<string, Promise<any>>();

export function getCachedData<T = any>(key: string, fallback: T | null = null): T | null {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed?.data !== undefined ? parsed.data : fallback;
  } catch (e) {
    return fallback;
  }
}

export function isCacheFresh(key: string, maxAgeMs: number): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.data === undefined || typeof parsed.updatedAt !== 'number') {
      return false;
    }
    return Date.now() - parsed.updatedAt < maxAgeMs;
  } catch (e) {
    return false;
  }
}

export function setCachedData<T = any>(key: string, data: T): void {
  if (typeof window === 'undefined' || data === undefined) return;
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({
        data,
        updatedAt: Date.now()
      })
    );
  } catch (e) {
    // Eğer localStorage kotası dolarsa eski sayfa/medya önbelleklerini temizleyip tekrar dene
    try {
      Object.keys(localStorage).forEach((k) => {
        if (
          k.startsWith(CACHE_PREFIX + 'page_') ||
          k.startsWith(CACHE_PREFIX + 'media_') ||
          k.startsWith('dost_pv_')
        ) {
          localStorage.removeItem(k);
        }
      });
      localStorage.setItem(
        CACHE_PREFIX + key,
        JSON.stringify({
          data,
          updatedAt: Date.now()
        })
      );
    } catch (_) {
      // Sessizce geç
    }
  }
}

export function removeCachedData(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch (e) {
    // Sessizce geç
  }
}

/**
 * Aynı anda birden fazla bileşenin aynı veriyi (örn. settings/general) çekmesini tek bir Promise'de birleştirir.
 */
export function fetchWithDedup<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (inflightMap.has(key)) {
    return inflightMap.get(key) as Promise<T>;
  }
  const promise = fetcher().finally(() => {
    inflightMap.delete(key);
  });
  inflightMap.set(key, promise);
  return promise;
}

/**
 * Yönetim panelinde sayfa, ayar veya popup güncellendiğinde sunucu RAM önbelleğini anında temizler.
 */
let invalidateTimer: ReturnType<typeof setTimeout> | null = null;
export function invalidateServerPublicCache(): void {
  if (typeof window === 'undefined') return;
  if (invalidateTimer) clearTimeout(invalidateTimer);
  invalidateTimer = setTimeout(() => {
    fetch('/api/cache/invalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => {});
  }, 150);
}
