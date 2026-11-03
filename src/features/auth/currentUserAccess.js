export const initialCurrentUserState = {
  currentUser: null,
  status: 'unauthenticated',
};

export function currentUserReducer(state, action) {
  switch (action.type) {
    case 'request-started':
      return { currentUser: null, status: 'loading' };
    case 'server-confirmed':
      return { currentUser: action.currentUser, status: 'verified' };
    case 'forbidden':
      return { currentUser: null, status: 'forbidden' };
    case 'request-failed':
      return { currentUser: null, status: 'error' };
    case 'logout':
      return initialCurrentUserState;
    default:
      return state;
  }
}

export function isCurrentUserRequest(request, current) {
  return Boolean(
    request
    && current
    && request.requestId === current.requestId
    && request.sessionId === current.sessionId
    && typeof request.token === 'string'
    && request.token.length > 0
    && request.token === current.token,
  );
}

export function getPostLoginPath(currentUser) {
  const contexts = currentUser?.contexts;
  if (!Array.isArray(contexts) || !contexts.every((context) => typeof context === 'string' && context.length > 0)) {
    return null;
  }
  return contexts.includes('ADMIN') ? '/admin' : '/';
}

export function getInternalAccessState({ isLoading, isAuthenticated, status, currentUser }, requiredContext) {
  if (isLoading) return 'loading';
  if (!isAuthenticated) return 'unauthenticated';
  if (status === 'loading' || status === 'unauthenticated') return 'loading';
  if (status === 'error') return 'error';
  if (status === 'forbidden') return 'forbidden';
  if (status !== 'verified') return 'error';

  const contexts = currentUser?.contexts;
  if (!Array.isArray(contexts) || !contexts.every((context) => typeof context === 'string' && context.length > 0)) {
    return 'forbidden';
  }
  return contexts.includes(requiredContext) ? 'allowed' : 'forbidden';
}
