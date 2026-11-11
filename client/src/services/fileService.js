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

  // 2. Private file: authenticated Axios fetch with JWT Bearer header
  try {
    const response = await api.get(fullUrl, {
      baseURL: '',
      responseType: 'blob',
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
    } else {
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    }

    // Clean up temporary Blob URL after 60 seconds
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 60000);
  } catch (error) {
    console.error('[FileService] Failed to load authenticated file:', error);
    alert(
      error.response?.status === 401
        ? 'Authentication required to view this file. Please sign in.'
        : 'Unable to open file. Please verify network connectivity or file availability.'
    );
  }
};
