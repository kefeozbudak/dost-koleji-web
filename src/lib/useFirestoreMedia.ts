import { useState, useEffect } from 'react';
import { getCachedMediaSync, fetchMediaByIdCached } from './resolveMedia';

function extractMediaId(url: string | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('firestore-media:')) return url.split('firestore-media:')[1] || null;
  if (url.startsWith('/api/media/')) return url.split('/api/media/')[1] || null;
  return null;
}

export function useFirestoreMedia(url: string | undefined): string | undefined {
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(() => {
    if (!url) return undefined;
    const mediaId = extractMediaId(url);
    if (mediaId) {
      return getCachedMediaSync(mediaId);
    }
    return url;
  });

  useEffect(() => {
    if (!url) {
      setResolvedUrl(undefined);
      return;
    }

    const mediaId = extractMediaId(url);
    if (mediaId) {
      const cached = getCachedMediaSync(mediaId);
      if (cached) {
        setResolvedUrl(cached);
        return;
      }
      let active = true;
      fetchMediaByIdCached(mediaId).then((res) => {
        if (active && res) {
          setResolvedUrl(res);
        }
      });
      return () => {
        active = false;
      };
    } else {
      setResolvedUrl(url);
    }
  }, [url]);

  return resolvedUrl;
}
