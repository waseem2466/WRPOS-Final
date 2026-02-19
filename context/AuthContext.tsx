import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth as firebaseAuth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';


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
    const initSession = () => {
      try {
        const stored = localStorage.getItem(SESSION_KEY);
        if (stored) {
          const session: Session = JSON.parse(stored);
          const now = Date.now();

          if (now - session.loginAt < SESSION_DURATION) {
            setUser(session.user);
            setToken(session.token);
          } else {
            // Session expired
            localStorage.removeItem(SESSION_KEY);
          }
        }
      } catch (e) {
        console.error("Session Parse Error", e);
        localStorage.removeItem(SESSION_KEY);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    // Firebase Auth State Listener
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'Firebase User',
          email: firebaseUser.email || '',
          role: 'ADMIN_GUEST' // You can map real roles from Firestore here
        });
        firebaseUser.getIdToken().then(setToken);
      } else {
        // Only clear if not in a legacy session? 
        // For simplicity, let's let Firebase take precedence or keep them separate.
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);


  const login = (userData: User, tokenValue: string) => {
    setUser(userData);
    setToken(tokenValue);

    const session: Session = {
      user: userData,
      token: tokenValue,
      loginAt: Date.now()
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(SESSION_KEY);
    // Cleanup legacy keys if they exist
    localStorage.removeItem('auth');
    localStorage.removeItem('wr_pos_session');
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
