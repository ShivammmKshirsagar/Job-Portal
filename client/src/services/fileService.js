import api, { getBackendOrigin } from './api';

/**
 * Resolves an uploaded file path against the configured backend origin.
 * - Leaves absolute URLs (e.g. Unsplash, external CDNs, blob:, data:) unchanged.
 * - Prepends configured backend origin (e.g. Render) to relative paths (/uploads/...).
 * - Falls back to relative path for local development (uses Vite proxy).
 */
export const resolveFileUrl = (url) => {
  if (!url) return '';
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return url;
  }

  const origin = getBackendOrigin();
  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  return origin ? `${origin}${normalizedPath}` : normalizedPath;
};

/**
 * Checks if a file path corresponds to a publicly accessible sample asset
 * that does not require private candidate authentication.
 */
export const isPublicSampleFile = (url) => {
  if (!url) return false;
  const filename = url.split('/').pop().split('?')[0];
  return (
    filename.startsWith('sample_resume_') ||
    filename.startsWith('Interview_Prep_') ||
    filename === '.gitkeep'
  );
};

/**
 * Authenticated file viewing and downloading utility.
 * - Public sample assets are opened or downloaded directly.
 * - Private user uploads (candidate resumes, chat attachments) are fetched via
 *   the authenticated Axios client (attaching the JWT Bearer token in headers),
 *   converted to a secure Blob URL, and rendered or downloaded.
 * - Blob URLs are cleanly revoked after viewing.
 * - Avoids passing JWT tokens in plain URL query strings.
 */
export const openFile = async (url, { filename = 'document.pdf', download = false } = {}) => {
  if (!url) return;
  const fullUrl = resolveFileUrl(url);

  // 1. Public sample asset: direct link
  if (isPublicSampleFile(url)) {
    if (download) {
      const a = document.createElement('a');
      a.href = fullUrl;
      a.download = filename;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      window.open(fullUrl, '_blank', 'noopener,noreferrer');
    }
    return;
  }

  // Pre-open preview tab synchronously to avoid browser popup blockers after async network request
  let previewWindow = null;
  if (!download && typeof window !== 'undefined') {
    try {
      previewWindow = window.open('about:blank', '_blank');
      if (previewWindow) {
        previewWindow.document.write(
          '<!DOCTYPE html><html><head><title>Loading document...</title><style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;color:#64748b;}p{font-size:14px;font-weight:600;}</style></head><body><p>Loading document preview...</p></body></html>'
        );
      }
    } catch {
      previewWindow = null;
    }
  }

  // 2. Private file: authenticated Axios fetch with JWT Bearer header
  try {
    const response = await api.get(fullUrl, {
      baseURL: '',
      responseType: 'blob',
      headers: {
        Accept: '*/*',
      },
    });

    const contentType = response.headers['content-type'] || 'application/pdf';
    const blob = new Blob([response.data], { type: contentType });
    const blobUrl = window.URL.createObjectURL(blob);

    if (download) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (previewWindow && !previewWindow.closed) {
      previewWindow.location.href = blobUrl;
    } else {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    // Clean up temporary Blob URL after 60 seconds
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 60000);
  } catch (error) {
    console.error('[FileService] Failed to load authenticated file:', error);
    if (previewWindow && !previewWindow.closed) {
      previewWindow.close();
    }
    const status = error.response?.status;
    let message = 'Unable to open file. Please verify network connectivity or file availability.';
    if (status === 401) {
      message = 'Authentication required to view this file. Please sign in.';
    } else if (status === 404) {
      message = 'This document is no longer available on the server. Please re-upload or select an updated file.';
    }
    alert(message);
  }
};
