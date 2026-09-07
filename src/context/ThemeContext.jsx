import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from './AuthContext';
import * as store from '../lib/accountStore';
import { applyCustomTheme, clearCustomTheme } from '../utils/themeUtils';
import { supabase, withTimeoutSafety } from '../lib/supabase';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const { profile, isAuthenticated, isMockMode } = useAuth();
  const [themeSaveError, setThemeSaveError] = useState(false);
  const dismissTimer = useRef(null);

  const [theme, setThemeState] = useState(() => {
    if (profile?.custom_theme) return 'custom';
    if (profile?.theme) {
      if (['light', 'dim', 'dark', 'custom'].includes(profile.theme)) {
        return profile.theme;
      }
    }
    if (isMockMode) {
      const sessionId = store.getSession();
      if (sessionId) {
        const account = store.getAccount(sessionId);
        if (account?.theme) return account.theme;
      }
    }
    return localStorage.getItem('digilab-guest-theme') || 'dark';
  });

  // Apply theme to DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.remove('dark', 'dim');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      clearCustomTheme();
    } else if (theme === 'dim') {
      document.documentElement.classList.add('dim');
      document.documentElement.setAttribute('data-theme', 'dim');
      clearCustomTheme();
    } else if (theme === 'custom') {
      applyCustomTheme(profile?.custom_theme || { bg: '#14151F', accent: '#2563EB', heroGlow: { enabled: true, color1: '#2563EB', color2: '#F5A623' } });
      document.documentElement.setAttribute('data-theme', 'custom');
    } else {
      clearCustomTheme();
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme, profile?.custom_theme]);

  // When account switches (login/logout), apply that account's theme
  useEffect(() => {
    if (isAuthenticated && profile?.theme) {
      setThemeState(profile.theme);
    }
  }, [isAuthenticated, profile?.id, profile?.theme]);

  const showSaveError = useCallback((previousTheme) => {
    setThemeSaveError(true);
    // Revert to the previously saved theme so UI matches DB
    setThemeState(previousTheme);
    // Auto-dismiss after 4s
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setThemeSaveError(false), 4000);
  }, []);

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);

    if (isMockMode) {
      const sessionId = store.getSession();
      if (sessionId) {
        store.updateAccount(sessionId, { theme: newTheme });
      } else {
        localStorage.setItem('digilab-guest-theme', newTheme);
      }
    } else if (isAuthenticated && profile?.id) {
      // Capture previous theme BEFORE writing, so we can revert on failure
      const prevTheme = profile.theme || 'dark';
      withTimeoutSafety(() =>
        supabase.from('profiles').update({ theme: newTheme }).eq('id', profile.id)
      ).then(({ error }) => {
        if (error) {
          console.warn('[ThemeContext] Failed to persist theme:', error.message);
          showSaveError(prevTheme);
        }
      }).catch(err => {
        console.warn('[ThemeContext] Failed to persist theme (timeout):', err.message);
        showSaveError(prevTheme);
      });
    } else {
      localStorage.setItem('digilab-guest-theme', newTheme);
    }
  }, [isMockMode, isAuthenticated, profile?.id, profile?.theme, showSaveError]);

  const toggleTheme = useCallback((explicitTheme) => {
    if (typeof explicitTheme === 'string') {
      setTheme(explicitTheme);
      return;
    }
    if (profile?.custom_theme) {
      setTheme(theme === 'light' ? 'dim' : theme === 'dim' ? 'dark' : theme === 'dark' ? 'custom' : 'light');
    } else {
      setTheme(theme === 'light' ? 'dim' : theme === 'dim' ? 'dark' : 'light');
    }
  }, [theme, setTheme, profile?.custom_theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
      {/* Theme save failure banner — rendered via portal so it always sits on top */}
      {themeSaveError && createPortal(
        <div
          role="alert"
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'var(--color-error, #ef4444)',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          ⚠️ Theme couldn't be saved — reverted to last saved theme.
        </div>,
        document.body
      )}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

export default ThemeContext;
