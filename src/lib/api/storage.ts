import { ApiError } from '@/lib/api/client';

export type StorageUploadResult = {
  path: string;
  public_url: string;
};

export async function uploadFile(
  bucket: string,
  file: File,
  path?: string,
): Promise<string> {
  const form = new FormData();
  form.append('bucket', bucket);
  form.append('file', file);
  if (path) form.append('path', path);

  const res = await fetch('/api/proxy/storage/upload', {
    method: 'POST',
    credentials: 'include',
    body: form,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? res.statusText);
  }

  const data = (await res.json()) as StorageUploadResult;
  return data.public_url;
}
