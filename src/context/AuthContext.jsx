// ─────────────────────────────────────────────
// Morphia — Auth Context (refactored)
//
// State: user, membership, isAuthenticated, isLoading
// Actions: login(), logout(), refreshMembership()
//
// Uses authStorage (not raw localStorage) and authService.
// isLoading prevents flash of login page on refresh.
// ─────────────────────────────────────────────

import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { authStorage } from '../features/auth/authStorage';
import { currentUserReducer, initialCurrentUserState, isCurrentUserRequest } from '../features/auth/currentUserAccess';
import { getCurrentUser } from '../features/auth/services/currentUserService';
import { initialMembershipFreshness, isCurrentMembershipRefresh, membershipFreshnessReducer } from '../features/membership/membershipPresentation';
import { AUTH_IDENTITY_REVALIDATION_EVENT } from '../services/api/auth401Policy';
import { getMyMembership, MEMBERSHIP_API_SUPPORTED } from '../services/membershipService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [currentUserState, dispatchCurrentUser] = useReducer(currentUserReducer, initialCurrentUserState);
  const [membershipState, dispatchMembership] = useReducer(membershipFreshnessReducer, initialMembershipFreshness);
  const [isLoading, setIsLoading] = useState(true);
  const membershipSessionVersion = useRef(0);
  const membershipRequestVersion = useRef(0);
  const currentUserRequestVersion = useRef(0);
  const currentUserVerificationInFlight = useRef(null);

  const logout = useCallback(() => {
    membershipSessionVersion.current += 1;
    membershipRequestVersion.current += 1;
    currentUserRequestVersion.current += 1;
    authStorage.clear();
    setUser(null);
    dispatchCurrentUser({ type: 'logout' });
    dispatchMembership({ type: 'logout' });
  }, []);

  const expireSession = useCallback(() => {
    logout();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.replace('/login');
    }
  }, [logout]);

  // ── Membership helpers ──────────────────────
  const storeMembership = useCallback((nextMembership) => {
    dispatchMembership({ type: 'server-confirmed', membership: nextMembership });
    setUser((current) => {
      if (!current) return current;
      const nextUser = { ...current, membership: nextMembership };
      authStorage.setUser(nextUser);
      return nextUser;
    });
    return nextMembership;
  }, []);

  const refreshMembership = useCallback(async () => {
    if (!MEMBERSHIP_API_SUPPORTED) {
      dispatchMembership({ type: 'unsupported' });
      return null;
    }

    const token = authStorage.getToken();
    const request = {
      requestId: membershipRequestVersion.current + 1,
      sessionId: membershipSessionVersion.current,
      token,
    };
    membershipRequestVersion.current = request.requestId;
    const currentRequest = () => ({
      requestId: membershipRequestVersion.current,
      sessionId: membershipSessionVersion.current,
      token: authStorage.getToken(),
    });

    if (!token) {
      dispatchMembership({ type: 'refresh-failed' });
      return null;
    }
    dispatchMembership({ type: 'refresh-start' });
    try {
      const nextMembership = await getMyMembership();
      if (!isCurrentMembershipRefresh(request, currentRequest())) return null;
      return storeMembership(nextMembership);
    } catch {
      if (isCurrentMembershipRefresh(request, currentRequest())) {
        dispatchMembership({ type: 'refresh-failed' });
      }
      return null;
    }
  }, [storeMembership]);

  const verifyCurrentUser = useCallback(async () => {
    const token = authStorage.getToken();
    if (!token) {
      logout();
      return null;
    }

    const sessionId = membershipSessionVersion.current;
    const inFlight = currentUserVerificationInFlight.current;
    if (inFlight && inFlight.token === token && inFlight.sessionId === sessionId) {
      return inFlight.promise;
    }

    const request = {
      requestId: currentUserRequestVersion.current + 1,
      sessionId,
      token,
    };
    currentUserRequestVersion.current = request.requestId;
    const currentRequest = () => ({
      requestId: currentUserRequestVersion.current,
      sessionId: membershipSessionVersion.current,
      token: authStorage.getToken(),
    });

    dispatchCurrentUser({ type: 'request-started' });
    const verification = (async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!isCurrentUserRequest(request, currentRequest())) return null;
        if (
          !currentUser
          || typeof currentUser !== 'object'
          || Array.isArray(currentUser)
          || !Array.isArray(currentUser.contexts)
          || !currentUser.contexts.every((context) => typeof context === 'string' && context.length > 0)
        ) {
          throw new Error('Phản hồi current-user không hợp lệ.');
        }
        dispatchCurrentUser({ type: 'server-confirmed', currentUser });
        return currentUser;
      } catch (error) {
        if (isCurrentUserRequest(request, currentRequest())) {
          if (error.response?.status === 401) {
            expireSession();
          } else {
            dispatchCurrentUser({ type: error.response?.status === 403 ? 'forbidden' : 'request-failed' });
          }
        }
        return null;
      } finally {
        if (currentUserVerificationInFlight.current?.promise === verification) {
          currentUserVerificationInFlight.current = null;
        }
      }
    })();
    currentUserVerificationInFlight.current = { token, sessionId, promise: verification };
    return verification;
  }, [expireSession, logout]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const revalidateIdentity = () => {
      if (authStorage.getToken()) void verifyCurrentUser();
    };
    window.addEventListener(AUTH_IDENTITY_REVALIDATION_EVENT, revalidateIdentity);
    return () => window.removeEventListener(AUTH_IDENTITY_REVALIDATION_EVENT, revalidateIdentity);
  }, [verifyCurrentUser]);

  // ── Restore session on mount ────────────────
  useEffect(() => {
    let active = true;
    const token = authStorage.getToken();
    const savedUser = authStorage.getUser();

    if (!savedUser || !token || authStorage.isTokenExpired(token)) {
      const hadStoredSession = Boolean(savedUser || token);
      authStorage.clear();
      dispatchCurrentUser({ type: 'logout' });
      setIsLoading(false);
      if (hadStoredSession && typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
      return () => { active = false; };
    }

    const restoredUser = { ...savedUser };
    delete restoredUser.membership;
    setUser(restoredUser);
    dispatchMembership({ type: 'restore', membership: savedUser.membership || null });

    // Membership endpoints remain disabled until the Backend supports them.
    if (MEMBERSHIP_API_SUPPORTED) void refreshMembership();
    else dispatchMembership({ type: 'unsupported' });
    void verifyCurrentUser().finally(() => { if (active) setIsLoading(false); });

    return () => { active = false; };
  }, [refreshMembership, verifyCurrentUser]);

  // ── Actions ─────────────────────────────────
  const login = useCallback(async (data) => {
    if (!data || typeof data.token !== 'string' || !data.token.trim() || authStorage.isTokenExpired(data.token)) {
      throw new Error('Phản hồi đăng nhập chưa có token hợp lệ. Vui lòng thử lại.');
    }
    membershipSessionVersion.current += 1;
    membershipRequestVersion.current += 1;
    currentUserRequestVersion.current += 1;
    authStorage.setToken(data.token);
    authStorage.setUser(data);
    setUser(data);
    dispatchMembership(MEMBERSHIP_API_SUPPORTED
      ? { type: 'server-confirmed', membership: data.membership || null }
      : { type: 'unsupported' });
    return verifyCurrentUser();
  }, [verifyCurrentUser]);

  // ── Provider ────────────────────────────────
  return (
    <AuthContext.Provider
      value={{
        user,
        currentUser: currentUserState.currentUser,
        currentUserStatus: currentUserState.status,
        sessionVersion: membershipSessionVersion.current,
        membership: membershipState.membership,
        membershipStatus: membershipState.status,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshMembership,
        verifyCurrentUser,
        updateMembership: storeMembership,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
