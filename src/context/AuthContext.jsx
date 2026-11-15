import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session === undefined ? 'init' : session?.user?.id ?? 'anon';

  const loadProfile = useCallback(async (id) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    if (uid === 'init') return;
    if (uid === 'anon') {
      setProfile(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single()
      .then(({ data }) => {
        if (!active) return;
        setProfile(data ?? null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [uid]);

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    isManager: profile?.role === 'manager',
    refreshProfile: () => session?.user && loadProfile(session.user.id),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
