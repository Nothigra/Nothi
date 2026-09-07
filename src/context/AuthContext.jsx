import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as store from '../lib/accountStore';
import { supabase, isMockMode, withTimeoutSafety } from '../lib/supabase';
import { calculateUserTier } from '../api/creatorApi';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);         // Account object or null
  const [profile, setProfile] = useState(null);    // Same as user for mock mode
  const [isLoading, setIsLoading] = useState(true);

  // Load profile from account and set both user + profile
  const setAccountState = useCallback((account) => {
    if (account) {
      setUser({ id: account.id, email: account.email });
      const tier = calculateUserTier(account.sales_count || 0);
      setProfile({ ...account, tier });
    } else {
      setUser(null);
      setProfile(null);
    }
  }, []);

  // Update profile (persists to account store)
  const updateProfile = useCallback(async (updates) => {
    if (!isMockMode) {
      if (!user) return { success: false, error: 'No user session' };
      try {
        const { error } = await withTimeoutSafety(() =>
          supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id)
        );
        if (!error) {
          setProfile(prev => ({ ...prev, ...updates }));
        }
        return { success: !error, error };
      } catch (error) {
        console.error("Profile update failed:", error);
        return { success: false, error };
      }
    }

    const sessionId = store.getSession();
    if (!sessionId) return { success: false, error: 'No session' };
    
    const updated = store.updateAccount(sessionId, updates);
    if (updated) {
      setProfile(updated);
      return { success: true };
    }
    return { success: false, error: 'Account not found' };
  }, [user]);

  // OAuth login (Google or Discord)
  const loginWithOAuth = useCallback(async (provider) => {
    if (!isMockMode) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (error) throw error;
      return;
    }

    // Mock mode: stable identity per provider
    const result = store.signInWithOAuth(provider);
    if (result.error) throw new Error(result.error);
    
    setAccountState(result.account);
    return { isNewUser: result.isNewUser || !result.account.onboarding_completed };
  }, [setAccountState]);

  // Email/Password Login
  const loginWithEmail = useCallback(async (email, password) => {
    if (!isMockMode) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      return { data, error };
    }

    const result = store.signIn(email, password);
    if (result.error) {
      return { error: { message: result.error } };
    }

    setAccountState(result.account);
    return { error: null };
  }, [setAccountState]);

  // Email/Password Signup
  const signUpWithEmail = useCallback(async (email, password, firstName, lastName) => {
    if (!isMockMode) {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName
          }
        }
      });
      return { data, error };
    }

    const result = store.signUp(email, password, firstName, lastName);
    if (result.error) {
      return { error: { message: result.error } };
    }

    // In mock mode, we'll pretend we need verification by not auto-logging in if we wanted to be strict,
    // but to keep it simple, we'll just set account state or return success.
    // For our new flow, we want to redirect to verify page, so we don't call setAccountState immediately on signup.
    return { data: { user: result.account }, error: null };
  }, []);

  const verifyOtp = useCallback(async (email, token, type = 'signup') => {
    if (!isMockMode) {
      return await supabase.auth.verifyOtp({ email, token, type });
    }
    // Mock mode implementation: simulate success
    const result = store.signIn(email, 'mockpassword'); // just bypass
    setAccountState(result.account);
    return { data: { session: {} }, error: null };
  }, [setAccountState]);

  const resendOtp = useCallback(async (email, type = 'signup') => {
    if (!isMockMode) {
      return await supabase.auth.resend({ type, email });
    }
    return { data: {}, error: null };
  }, []);

  const resetPasswordForEmail = useCallback(async (email) => {
    if (!isMockMode) {
      return await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
    }
    return { data: {}, error: null };
  }, []);

  // Logout
  const logout = useCallback(async () => {
    store.signOut();
    setUser(null);
    setProfile(null);
    if (!isMockMode) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error("Supabase signOut error:", err);
      }
    }
  }, []);

  // Initialize: check for existing session
  useEffect(() => {
    const init = async () => {
      if (isMockMode) {
        // Check for an existing session pointer
        const sessionId = store.getSession();
        if (sessionId) {
          const account = store.getAccount(sessionId);
          if (account) {
            setAccountState(account);
          } else {
            // Session points to a deleted account — clean up
            store.clearSession();
          }
        }
        // If no session, stay logged out (user/profile remain null)
        setIsLoading(false);
        return;
      }

      // Real Supabase auth — wrap getSession in timeout safety so a GoTrue
      // deadlock can't hold isLoading=true indefinitely, which blocks pages like Marketplace.
      let session = null;
      try {
        const { data } = await withTimeoutSafety(() => supabase.auth.getSession(), 6000);
        session = data?.session ?? null;
      } catch (err) {
        console.warn('[AuthContext] getSession() timed out on init — proceeding as logged-out:', err.message);
        // isLoading must still be cleared so the rest of the app unblocks
        setIsLoading(false);
        // Re-attempt in background; onAuthStateChange will fire when the lock breaks
        supabase.auth.refreshSession().catch(() => {});
        return;
      }

      if (session?.user) {
        setUser(session.user);
        
        const [profileRes, followsRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', session.user.id).single(),
          supabase.from('follows').select('creator_id, last_viewed_at').eq('follower_id', session.user.id)
        ]);

        if (profileRes.data) {
          let avatar = profileRes.data.avatar_url;
          if (!avatar && session.user.user_metadata) {
            avatar = session.user.user_metadata.avatar_url || session.user.user_metadata.picture;
            if (avatar) {
              withTimeoutSafety(() => supabase.from('profiles').update({ avatar_url: avatar }).eq('id', session.user.id)).catch(console.error);
            }
          }

          setProfile({
            ...profileRes.data,
            avatar_url: avatar,
            following: (followsRes.data || []).map(f => ({
              creatorId: f.creator_id,
              lastViewedAt: f.last_viewed_at
            }))
          });
        }
      }
      setIsLoading(false);

      // Listen for auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (event === 'INITIAL_SESSION') return;
          
          if (event === 'SIGNED_IN' && session?.user) {
            setUser(session.user);
            
            const [profileRes, followsRes] = await Promise.all([
              supabase.from('profiles').select('*').eq('id', session.user.id).single(),
              supabase.from('follows').select('creator_id, last_viewed_at').eq('follower_id', session.user.id)
            ]);

            if (profileRes.data) {
              let avatar = profileRes.data.avatar_url;
              if (!avatar && session.user.user_metadata) {
                avatar = session.user.user_metadata.avatar_url || session.user.user_metadata.picture;
                if (avatar) {
                  withTimeoutSafety(() => supabase.from('profiles').update({ avatar_url: avatar }).eq('id', session.user.id)).catch(console.error);
                }
              }

              setProfile({
                ...profileRes.data,
                avatar_url: avatar,
                following: (followsRes.data || []).map(f => ({
                  creatorId: f.creator_id,
                  lastViewedAt: f.last_viewed_at
                }))
              });
            }
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
            setProfile(null);
          }
        }
      );

      return () => subscription?.unsubscribe();
    };

    init();
  }, [setAccountState]);

  const followCreator = useCallback(async (creatorId) => {
    if (!profile) return;
    const previousFollowing = [...(profile.following || [])];
    if (!previousFollowing.find(f => f.creatorId === creatorId)) {
      const newFollowing = [...previousFollowing, { creatorId, lastViewedAt: new Date().toISOString() }];
      setProfile(p => ({ ...p, following: newFollowing })); // Optimistic

      if (!isMockMode) {
        if (creatorId.startsWith('mock-')) {
          console.error("Cannot follow a mock creator ID in real mode. Please update seed.js with real UUIDs.");
          setProfile(p => ({ ...p, following: previousFollowing }));
          return;
        }

        const { error } = await withTimeoutSafety(() => supabase.from('follows').insert({ follower_id: profile.id, creator_id: creatorId, last_viewed_at: new Date().toISOString() }));
        if (error) {
          console.error("Follow failed:", error);
          setProfile(p => ({ ...p, following: previousFollowing })); // Rollback
        }
      } else {
        await updateProfile({ following: newFollowing });
      }
    }
  }, [profile, updateProfile]);

  const unfollowCreator = useCallback(async (creatorId) => {
    if (!profile) return;
    const previousFollowing = [...(profile.following || [])];
    const newFollowing = previousFollowing.filter(f => f.creatorId !== creatorId);
    setProfile(p => ({ ...p, following: newFollowing })); // Optimistic

    if (!isMockMode) {
      if (creatorId.startsWith('mock-')) {
        setProfile(p => ({ ...p, following: previousFollowing }));
        return;
      }

      const { data, error } = await withTimeoutSafety(() =>
        supabase
          .from('follows')
          .delete()
          .eq('follower_id', profile.id)
          .eq('creator_id', creatorId)
          .select()
      );

      if (error || !data || data.length === 0) {
        console.error("Unfollow failed:", error || '0 rows matched (RLS block or row missing)');
        setProfile(p => ({ ...p, following: previousFollowing })); // Rollback
      }
    } else {
      await updateProfile({ following: newFollowing });
    }
  }, [profile, updateProfile]);

  const markCreatorViewed = useCallback(async (creatorId) => {
    if (!profile) return;
    const previousFollowing = [...(profile.following || [])];
    const newFollowing = previousFollowing.map(f => 
      f.creatorId === creatorId ? { ...f, lastViewedAt: new Date().toISOString() } : f
    );
    setProfile(p => ({ ...p, following: newFollowing })); // Optimistic

    if (!isMockMode) {
      const { error } = await withTimeoutSafety(() => supabase.from('follows').update({ last_viewed_at: new Date().toISOString() }).match({ follower_id: profile.id, creator_id: creatorId }));
      if (error) {
        console.error("Mark viewed failed:", error);
        setProfile(p => ({ ...p, following: previousFollowing })); // Rollback
      }
    } else {
      await updateProfile({ following: newFollowing });
    }
  }, [profile, updateProfile]);

  const value = {
    user,
    profile,
    isLoading,
    isAuthenticated: !!user,
    needsOnboarding: !!user && (!profile || !profile.onboarding_completed),
    isMockMode,
    loginWithOAuth,
    loginWithEmail,
    signUpWithEmail,
    verifyOtp,
    resendOtp,
    resetPasswordForEmail,
    logout,
    updateProfile,
    followCreator,
    unfollowCreator,
    markCreatorViewed,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthContext;
