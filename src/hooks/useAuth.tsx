import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import {
  fetchSession,
  signIn as apiSignIn,
  signOutSession,
  signUp as apiSignUp,
} from '@/lib/api/auth';
import { getMyProfile } from '@/lib/api/profiles';
import { clearLegacySessionStorage, type PublicSession } from '@/lib/auth/session';
import type { Tables } from '@/integrations/supabase/types';

export type AuthUser = {
  id: string;
  email?: string | null;
};

interface AuthContextType {
  user: AuthUser | null;
  session: PublicSession | null;
  loading: boolean;
  profile: Tables<'profiles'> | null;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PublicSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const applySession = useCallback((s: PublicSession | null) => {
    setSession(s);
    setUser(s ? { id: s.user.id, email: s.user.email } : null);
  }, []);

  const refreshProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const data = await getMyProfile();
      setProfile(data as Tables<'profiles'>);
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    clearLegacySessionStorage();
    void (async () => {
      try {
        const s = await fetchSession();
        applySession(s);
      } catch {
        applySession(null);
      } finally {
        setLoading(false);
      }
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
    const data = await apiSignUp(email, password, username);
    applySession(data);
  };

  const signIn = async (email: string, password: string) => {
    const data = await apiSignIn(email, password);
    applySession(data);
  };

  const signOut = async () => {
    try {
      await signOutSession();
    } finally {
      applySession(null);
      setProfile(null);
    }
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
