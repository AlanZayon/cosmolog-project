import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { getMyProfile, refreshSession, signIn as apiSignIn, signUp as apiSignUp } from '@/lib/api';
import { isApiConfigured } from '@/lib/api/client';
import {
  isSessionExpired,
  loadSession,
  saveSession,
  sessionWithExpiry,
  type ApiSession,
} from '@/lib/auth/session';
import type { Tables } from '@/integrations/supabase/types';

export type AuthUser = {
  id: string;
  email?: string | null;
};

interface AuthContextType {
  user: AuthUser | null;
  session: ApiSession | null;
  loading: boolean;
  profile: Tables<'profiles'> | null;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function ensureValidSession(): Promise<ApiSession | null> {
  let session = loadSession();
  if (!session) return null;
  if (!isSessionExpired(session)) return session;
  try {
    const refreshed = await refreshSession(session.refresh_token);
    session = sessionWithExpiry(refreshed);
    saveSession(session);
    return session;
  } catch {
    saveSession(null);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ApiSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const applySession = useCallback((s: ApiSession | null) => {
    setSession(s);
    setUser(s ? { id: s.user.id, email: s.user.email } : null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const s = await ensureValidSession();
    applySession(s);
    if (!s?.access_token || !isApiConfigured()) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    try {
      const data = await getMyProfile(s.access_token);
      setProfile(data as Tables<'profiles'>);
    } finally {
      setProfileLoading(false);
    }
  }, [applySession]);

  useEffect(() => {
    if (!isApiConfigured()) {
      setLoading(false);
      return;
    }
    void (async () => {
      const s = await ensureValidSession();
      applySession(s);
      setLoading(false);
    })();
  }, [applySession]);

  useEffect(() => {
    const id = user?.id;
    if (!id) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    void refreshProfile();
  }, [user?.id, refreshProfile]);

  const signUp = async (email: string, password: string, username: string) => {
    if (!isApiConfigured()) throw new Error('NEXT_PUBLIC_API_URL is not configured');
    const data = sessionWithExpiry(await apiSignUp(email, password, username));
    saveSession(data);
    applySession(data);
  };

  const signIn = async (email: string, password: string) => {
    if (!isApiConfigured()) throw new Error('NEXT_PUBLIC_API_URL is not configured');
    const data = sessionWithExpiry(await apiSignIn(email, password));
    saveSession(data);
    applySession(data);
  };

  const signOut = async () => {
    saveSession(null);
    applySession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        profile,
        profileLoading,
        refreshProfile,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
