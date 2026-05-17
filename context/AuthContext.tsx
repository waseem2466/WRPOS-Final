import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth as firebaseAuth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { errorHandler } from '../services/errorHandler';


interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Session {
  user: User;
  token: string;
  loginAt: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_KEY = 'pos_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 Hours

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check local storage session (DB auth or offline)
    const storedSession = localStorage.getItem('pos_session');
    if (storedSession) {
      try {
        const session = JSON.parse(storedSession);
        if (Date.now() - session.loginAt < SESSION_DURATION) {
          setUser(session.user);
          setToken(session.token);
        } else {
          localStorage.removeItem('pos_session');
        }
      } catch (e) {
        console.error("Session parse error", e);
      }
    }

    // 2. Also listen for Firebase Auth State (Google / Firebase Email)
    if (!firebaseAuth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'Google User',
          email: firebaseUser.email || '',
          role: 'ADMIN' // Default role
        });
        firebaseUser.getIdToken()
          .then(setToken)
          .catch((err) => {
            errorHandler.log('Auth-Firebase', err, { operation: 'refreshIdToken' }, 'low');
          });
      }
      setLoading(false);
    }, (err) => {
      errorHandler.log('Auth-Firebase', err, { operation: 'authStateChanged' }, 'low');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = (userData: User, tokenValue: string) => {
    setUser(userData);
    setToken(tokenValue);
    localStorage.setItem('pos_session', JSON.stringify({
      user: userData,
      token: tokenValue,
      loginAt: Date.now()
    }));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('pos_session');
    // We don't import signOut directly at top if we don't want to change imports right now,
    // but the system will eventually sign out via authClient
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
