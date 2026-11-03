function normalizePath(url, baseURL) {
  if (typeof url !== 'string' || !url.trim()) return null;

  let pathname;
  try {
    pathname = new URL(url, 'http://localhost').pathname;
  } catch {
    return null;
  }

  try {
    const basePath = new URL(baseURL || '/', 'http://localhost').pathname.replace(/\/$/, '');
    if (basePath && basePath !== '/' && (pathname === basePath || pathname.startsWith(`${basePath}/`))) {
      pathname = pathname.slice(basePath.length) || '/';
    }
  } catch {
    // Keep the parsed request path if an unusual baseURL cannot be normalized.
  }

  return pathname.replace(/\/$/, '') || '/';
}

function isWithinPath(path, prefix) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function shouldRevalidateIdentityOn401(url, baseURL = '/api') {
  const path = normalizePath(url, baseURL);
  if (!path) return false;

  // These APIs have their own credentials or failure state. Only /v1/me is
  // authoritative for session validity; membership failures are non-fatal.
  if (isWithinPath(path, '/auth') || path === '/v1/me' || isWithinPath(path, '/memberships')) {
    return false;
  }

  return true;
}

export const AUTH_IDENTITY_REVALIDATION_EVENT = 'auth:identity-revalidation-required';
