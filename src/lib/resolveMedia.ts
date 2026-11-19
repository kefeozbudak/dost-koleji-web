import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getCachedData, setCachedData } from './cache';

const memoryCache = new Map<string, string>();
const inflightRequests = new Map<string, Promise<string | null>>();

export function getCachedMediaSync(mediaId: string): string | undefined {
  if (memoryCache.has(mediaId)) return memoryCache.get(mediaId);
  const cached = getCachedData<string>(`media_${mediaId}`, null);
  if (cached) {
    memoryCache.set(mediaId, cached);
    return cached;
  }
  return undefined;
}

export async function fetchMediaByIdCached(mediaId: string): Promise<string | null> {
  if (!mediaId) return null;
  const syncUrl = getCachedMediaSync(mediaId);
  if (syncUrl) return syncUrl;

  if (inflightRequests.has(mediaId)) {
    return inflightRequests.get(mediaId)!;
  }

  const req = (async () => {
    try {
      const mediaSnap = await getDoc(doc(db, 'media', mediaId));
      if (mediaSnap.exists()) {
        const mediaData = mediaSnap.data();
        if (mediaData.url) {
          memoryCache.set(mediaId, mediaData.url);
          setCachedData(`media_${mediaId}`, mediaData.url);
          return mediaData.url as string;
        }
      }
    } catch (e) {
      // Ignore error
    } finally {
      inflightRequests.delete(mediaId);
    }
    return null;
  })();

  inflightRequests.set(mediaId, req);
  return req;
}

export async function resolveMediaUrls(obj: any): Promise<any> {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    if (obj.startsWith('/api/media/')) {
      const mediaId = obj.split('/api/media/')[1];
      if (mediaId) {
        const resolved = await fetchMediaByIdCached(mediaId);
        if (resolved) return resolved;
      }
    } else if (obj.startsWith('firestore-media:')) {
      const mediaId = obj.split('firestore-media:')[1];
      if (mediaId) {
        const resolved = await fetchMediaByIdCached(mediaId);
        if (resolved) return resolved;
      }
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return Promise.all(obj.map(item => resolveMediaUrls(item)));
  }
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      newObj[key] = await resolveMediaUrls(obj[key]);
    }
    return newObj;
  }
  return obj;
}
