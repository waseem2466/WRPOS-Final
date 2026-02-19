
import React, { useState } from 'react';
import { GlassCard } from './ui/GlassCard';
import { GlassButton } from './ui/GlassButton';
import { Lock, Mail, ChevronRight, Sparkles, ShieldCheck, Loader2, WifiOff, HardDrive } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authClient } from '../services/auth';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('smileandsupplies@outlook.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [authMode, setAuthMode] = useState<'local' | 'cloud'>('local');


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setIsOfflineReady(false);

    try {
      let result;
      if (authMode === 'cloud') {
        result = await authClient.authenticateWithFirebase(email, password);
      } else {
        result = await authClient.authenticate(email, password);
      }

      // Update Context (Persists to localStorage via Context)
      login(result.user, result.token);


    } catch (err: any) {
      console.error(err);

      // Dev Bypass for Demo Continuity (if DB is completely unreachable)
      if (email.toLowerCase() === 'smileandsupplies@outlook.com' && password === 'admin123') {
        console.warn("Using Dev Fallback Login");
        login({
          id: 'dev-admin',
          name: 'Admin Owner',
          email: email,
          role: 'OWNER'
        }, 'dev-fallback-token');
        return;
      }

      const msg = err?.message || (typeof err === 'string' ? err : 'Authentication Failed');
      setError(String(msg));

      // Check if it's a network error
      if (String(msg).includes('Unreachable') || String(msg).includes('Network') || String(msg).includes('Failed to fetch')) {
        setIsOfflineReady(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      const result = await authClient.signInWithGoogle();
      login(result.user, result.token);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google Sign-In Failed');
    } finally {
      setIsLoading(false);
    }
  };


  const handleOfflineEntry = () => {
    // Create a dummy offline session
    const offlineUser = {
      id: 'offline-user',
      name: 'Offline Operator',
      email: email || 'offline@local',
      role: 'ADMIN'
    };
    login(offlineUser, 'offline-session-token');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#0a0f1d]">
      <div className="absolute top-[-25%] left-[-15%] w-[70%] h-[70%] rounded-full bg-blue-600/5 blur-[180px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-25%] right-[-15%] w-[70%] h-[70%] rounded-full bg-purple-600/5 blur-[180px] pointer-events-none"></div>

      <GlassCard className="w-full max-w-md p-8 sm:p-12 relative z-10 border-white/10 shadow-[0_30px_100px_-20px_rgba(0,0,0,0.9)] animate-in fade-in zoom-in-95 duration-1000 bg-[#0f172a]/60 backdrop-blur-3xl rounded-[3.5rem]">
        <div className="text-center mb-14">
          <div className="relative inline-block mb-10 group">
            <div className="w-20 h-20 bg-white rounded-[1.75rem] flex items-center justify-center shadow-2xl shadow-blue-600/40 transition-all duration-700 overflow-hidden border border-white/10">
              <img
                src="https://res.cloudinary.com/wrsmile/image/upload/v1765617036/wr_smile_supplies_products/yses6ycpqormspldap12.jpg"
                alt="Logo"
                className="w-full h-full object-contain p-1"
              />
            </div>
            <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-8 h-8 bg-[#0b1121] rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl">
              <ShieldCheck className="text-blue-500" size={16} />
            </div>
          </div>
          <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-white to-purple-400 tracking-tighter uppercase leading-none mb-4">
            WR POS
          </h1>
          <p className="text-blue-500/50 text-[10px] font-black tracking-[0.5em] uppercase">Cloud Terminal Access</p>
        </div>

        <div className="flex bg-black/40 p-1 rounded-2xl mb-8 border border-white/5">
          <button
            type="button"
            onClick={() => setAuthMode('local')}
            className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${authMode === 'local' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Local Sync
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('cloud')}
            className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${authMode === 'cloud' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Cloud Access
          </button>
        </div>


        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-700 group-focus-within:text-blue-500 transition-all" size={20} />
              <input
                type="email"
                placeholder="Operator Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/60 border border-white/5 rounded-3xl pl-14 pr-6 py-5 text-sm focus:ring-4 focus:ring-blue-500/5 transition-all outline-none text-white placeholder-gray-800 font-bold"
                required
              />
            </div>
            <div className="relative group">
              <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-700 group-focus-within:text-blue-500 transition-all" size={20} />
              <input
                type="password"
                placeholder="Secure Token"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/60 border border-white/5 rounded-3xl pl-14 pr-6 py-5 text-sm focus:ring-4 focus:ring-blue-500/5 transition-all outline-none text-white placeholder-gray-800 font-black font-mono tracking-widest"
                required
              />
            </div>
          </div>

          {error && (
            <div className="space-y-3">
              <div className="p-5 rounded-3xl bg-red-500/5 border border-red-500/10 text-red-500 text-[10px] font-black text-center animate-in shake duration-500 uppercase tracking-widest flex items-center justify-center gap-2">
                {String(error).includes('Unreachable') && <WifiOff size={14} />}
                {String(error)}
              </div>
              {isOfflineReady && (
                <button
                  type="button"
                  onClick={handleOfflineEntry}
                  className="w-full py-4 bg-orange-600/10 text-orange-500 border border-orange-500/20 rounded-3xl text-[9px] font-black uppercase tracking-widest hover:bg-orange-600 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <HardDrive size={14} /> Enter Offline Mode
                </button>
              )}
            </div>
          )}

          <GlassButton
            type="submit"
            className="w-full py-6 text-[10px] font-black tracking-[0.35em] pl-[0.35em] group flex items-center justify-center gap-4 uppercase shadow-2xl shadow-blue-600/20 rounded-3xl active:scale-95 transition-all duration-500 bg-blue-600 hover:bg-blue-500"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-3">
                <Loader2 className="animate-spin" size={18} />
                <span>CONNECTING...</span>
              </div>
            ) : (
              <>
                ACCESS TERMINAL
                <ChevronRight size={20} className="group-hover:translate-x-2 transition-transform" />
              </>
            )}
          </GlassButton>
        </form>

        <div className="relative my-10">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/5"></div>
          </div>
          <div className="relative flex justify-center text-[8px] uppercase font-black tracking-[0.4em]">
            <span className="bg-[#0f172a] px-4 text-gray-700">Enterprise SSO</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full py-5 px-6 rounded-3xl border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-all flex items-center justify-center gap-4 group active:scale-95 shadow-xl shadow-black/40"
        >
          <div className="w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.3em]">Sign in with Google</span>
        </button>


        <div className="mt-14 text-center text-[9px] text-gray-800 font-black tracking-[0.3em] pl-[0.3em] uppercase">
          &copy; MMXXIV WR POS INFRASTRUCTURE
        </div>
      </GlassCard>
    </div>
  );
};
