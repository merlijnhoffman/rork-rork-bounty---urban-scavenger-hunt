import { supabase } from '@/lib/supabase';

const BUCKET = 'clue-media';

/**
 * Strips leading slashes, query strings and duplicated bucket-name prefixes
 * from a stored media path. Admin uploads are inconsistent — some store
 * "clue-media/xyz.jpg", some "/xyz.jpg", some the full public URL — so the
 * path is normalized before building a URL.
 */
export function normalizeMediaPath(raw: string): string {
  let p = raw.trim().split('?')[0].replace(/^\/+/, '');
  const bucketPrefix = `${BUCKET}/`;
  while (p.startsWith(bucketPrefix)) {
    p = p.slice(bucketPrefix.length);
  }
  return p;
}

/** True when the value is a full URL that points outside Supabase storage. */
export function isExternalMediaUrl(raw: string): boolean {
  return /^https?:\/\//i.test(raw) && !raw.includes('/storage/v1/object/');
}

/**
 * Builds a playable public URL for a stored clue media value, tolerating
 * messy input: bare paths, bucket-prefixed paths, or full storage URLs.
 */
export function buildPublicMediaUrl(raw: string): string {
  if (isExternalMediaUrl(raw)) return raw;
  if (raw.includes('/storage/v1/object/')) return raw;
  const path = normalizeMediaPath(raw);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl ?? raw;
}

/**
 * Fallback: mints a short-lived signed URL. Used when the public URL 404s
 * (e.g. the bucket is not public yet).
 */
export async function getSignedMediaUrl(raw: string): Promise<string | null> {
  try {
    if (isExternalMediaUrl(raw)) return null;
    const path = normalizeMediaPath(raw);
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
