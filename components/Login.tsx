import React, { useState } from 'react';
import { GlassCard } from './ui/GlassCard';
import { GlassButton } from './ui/GlassButton';
import { Lock, Mail, ChevronRight, Sparkles, ShieldCheck, WifiOff, HardDrive, Cloud, Database, Bot, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authClient } from '../services/auth';
import { isFirebaseConfigured } from '../services/firebase';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('smileandsupplies@outlook.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'local' | 'cloud'>('local');
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const isDesktop = typeof window !== 'undefined' && !!(window as any).electronAPI;
  const canUseCloudAuth = isFirebaseConfigured;
  const BUILD_DATE = "2026-03-03 20:50"; // Internal build marker for user verification
  const brandBullets = [
    { icon: Cloud, label: 'Cloud Billing Core' },
    { icon: Database, label: 'Offline Ledger Ready' },
    { icon: Bot, label: 'AI Operations Layer' }
  ];

  React.useEffect(() => {
    const preferredMode = localStorage.getItem('wr-auth-mode');
    if (preferredMode === 'local') {
      setAuthMode(preferredMode);
      return;
    }

    if (preferredMode === 'cloud' && canUseCloudAuth) {
      setAuthMode('cloud');
      return;
    }

    if (!!(window as any).Capacitor?.isNativePlatform?.() && canUseCloudAuth) {
      setAuthMode('cloud');
    }
  }, [canUseCloudAuth]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setIsOfflineReady(false);

    try {
      let result;
      if (authMode === 'cloud') {
        result = await authClient.authenticateWithFirebase(email.trim(), password.trim());
      } else {
        result = await authClient.authenticate(email.trim(), password.trim());
      }

      localStorage.setItem('wr-auth-mode', authMode);
      // Update Context (Persists to localStorage via Context)
      login(result.user, result.token);

    } catch (err: any) {
      console.error(err);
      const msg = err?.message || (typeof err === 'string' ? err : 'Authentication Failed');
      const messageText = String(msg || 'Authentication Failed');
      const isDatabaseBridgeMissing = String(messageText || '').toLowerCase().includes('no response from database process');
      setError(isDatabaseBridgeMissing
        ? 'Desktop database is not connected in this browser. Open the WR POS desktop app, or enter Offline Mode for testing.'
        : messageText
      );

      // Check if it's a network error
      if (
        isDatabaseBridgeMissing ||
        String(messageText || '').includes('Unreachable') ||
        String(messageText || '').includes('Network') ||
        String(messageText || '').includes('Failed to fetch')
      ) {
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
      const msg = err?.message || '';
      setError(msg || 'Google Sign-In Failed');
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
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-[#0a0f1d]">
      <div className="absolute top-[-25%] left-[-15%] w-[70%] h-[70%] rounded-full bg-blue-600/5 blur-[180px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-25%] right-[-15%] w-[70%] h-[70%] rounded-full bg-purple-600/5 blur-[180px] pointer-events-none"></div>

      <div className="w-full max-w-6xl relative z-10 grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6 items-stretch animate-in fade-in zoom-in-95 duration-1000">
        <GlassCard className="hidden xl:flex flex-col justify-between rounded-[3rem] p-8 border-white/10 bg-[#0f172a]/60 backdrop-blur-3xl shadow-[0_30px_100px_-20px_rgba(0,0,0,0.9)] overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.12),transparent_40%)] pointer-events-none"></div>
          <div className="relative z-10">
            <div className="relative inline-flex items-center gap-5 mb-10">
              <div className="w-24 h-24 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-xl rounded-[1.75rem] flex items-center justify-center shadow-2xl shadow-blue-600/20 overflow-hidden border border-white/20">
                <img
                  src="https://res.cloudinary.com/wrsmile/image/upload/v1776608268/ChatGPT_Image_Apr_19_2026_07_38_26_PM_rn2v9r.png"
                  alt="Logo"
                  className="w-full h-full object-contain p-2"
                />
              </div>
              <div className="absolute bottom-0 left-[4.8rem] translate-y-1/2 w-10 h-10 bg-[#0b1121] rounded-[1rem] flex items-center justify-center border border-white/10 shadow-2xl">
                <ShieldCheck className="text-blue-500" size={18} />
              </div>
            </div>

            <p className="text-[10px] font-black tracking-[0.48em] uppercase text-blue-300/80 mb-5">Premium Edition v6.0</p>
            <h1 className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-300 via-white to-purple-300 tracking-tight leading-[0.95] mb-6">
              Retail intelligence built for fast operators.
            </h1>
            <p className="text-base text-slate-300/85 leading-relaxed max-w-xl">
              WR POS combines billing, stock control, customer debt tracking, and WhatsApp automation inside one liquid desktop terminal.
            </p>
          </div>

          <div className="relative z-10 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {brandBullets.map(({ icon: Icon, label }) => (
                <div key={label} className="liquid-section-shell p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[1rem] bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-blue-300" />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-200">{label}</span>
                </div>
              ))}
            </div>

            <div className="liquid-section-shell p-5">
              <div className="flex items-center justify-between gap-4 mb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Operational Signature</p>
                <Sparkles size={16} className="text-blue-300" />
              </div>
              <p className="text-lg font-black text-white tracking-tight mb-2">Fast checkout. Clean debt control. AI-ready workflows.</p>
              <p className="text-sm text-slate-400 leading-relaxed">Designed to stay elegant on desktop while still working under pressure at the counter.</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="w-full p-7 sm:p-9 lg:p-10 relative z-10 border-white/10 shadow-[0_30px_100px_-20px_rgba(0,0,0,0.9)] bg-[#0f172a]/60 backdrop-blur-3xl rounded-[3rem]">
        <div className="text-center mb-10">
          <div className="relative inline-block mb-8 group xl:hidden">
            <div className="w-24 h-24 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-xl rounded-[1.75rem] flex items-center justify-center shadow-2xl shadow-blue-600/20 transition-all duration-700 overflow-hidden border border-white/20">
              <img
                src="https://res.cloudinary.com/wrsmile/image/upload/v1776608268/ChatGPT_Image_Apr_19_2026_07_38_26_PM_rn2v9r.png"
                alt="Logo"
                className="w-full h-full object-contain p-2"
              />
            </div>
            <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-8 h-8 bg-[#0b1121] rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl">
              <ShieldCheck className="text-blue-500" size={16} />
            </div>
          </div>
          <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-white to-purple-400 tracking-tighter uppercase leading-none mb-3">
            WR POS
          </h1>
          <p className="text-blue-500/50 text-[10px] font-black tracking-[0.5em] uppercase">Cloud Terminal Access</p>
        </div>

        <div className="flex bg-black/40 p-1.5 rounded-[1.5rem] mb-7 border border-white/5">
          <button
            type="button"
            onClick={() => setAuthMode('local')}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.22em] rounded-[1rem] transition-all ${authMode === 'local' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
            title="Uses direct Neon Database connection"
          >
            Local Sync
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('cloud')}
            disabled={!canUseCloudAuth}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.22em] rounded-[1rem] transition-all ${authMode === 'cloud' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'} ${!canUseCloudAuth ? 'opacity-40 cursor-not-allowed hover:text-gray-500' : ''}`}
            title={canUseCloudAuth ? 'Uses Firebase Cloud Identity' : 'Cloud sign-in is not configured'}
          >
            Cloud Access
          </button>
        </div>

        <div className="mb-7 rounded-[1.4rem] border border-white/5 bg-black/30 px-4 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">
            {isDesktop ? 'Desktop mode uses your local encrypted database connection for daily billing and CRM.' : 'Cloud mode is optional and depends on your Firebase project credentials.'}
          </p>
        </div>


        <form onSubmit={handleSubmit} className="space-y-7">
          <div className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-700 group-focus-within:text-blue-500 transition-all" size={20} />
              <input
                type="email"
                placeholder="Operator Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/60 border border-white/5 rounded-[1.7rem] pl-14 pr-6 py-5 text-sm focus:ring-4 focus:ring-blue-500/5 transition-all outline-none text-white placeholder-gray-700 font-bold"
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
                className="w-full bg-black/60 border border-white/5 rounded-[1.7rem] pl-14 pr-6 py-5 text-sm focus:ring-4 focus:ring-blue-500/5 transition-all outline-none text-white placeholder-gray-700 font-black font-mono tracking-widest"
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
                  className="w-full py-4 bg-orange-600/10 text-orange-500 border border-orange-500/20 rounded-[1.7rem] text-[10px] font-black uppercase tracking-[0.22em] hover:bg-orange-600 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <HardDrive size={14} /> Enter Offline Mode
                </button>
              )}
            </div>
          )}

          <GlassButton
            type="submit"
            className="w-full py-6 text-[10px] font-black tracking-[0.35em] pl-[0.35em] group flex items-center justify-center gap-4 uppercase shadow-2xl shadow-blue-600/20 rounded-[1.8rem] active:scale-95 transition-all duration-500 bg-blue-600 hover:bg-blue-500"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-3">
                <Loader2 size={20} className="animate-spin" />
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

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/5"></div>
          </div>
          <div className="relative flex justify-center text-[8px] uppercase font-black tracking-[0.4em]">
            <span className="bg-[#0f172a] px-4 text-gray-700">Enterprise SSO</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={isLoading || !canUseCloudAuth}
          className={`w-full py-5 px-6 rounded-[1.8rem] border border-white/10 bg-white/5 text-white transition-all flex items-center justify-center gap-4 group active:scale-95 shadow-xl shadow-black/40 ${canUseCloudAuth ? 'hover:bg-white/10' : 'opacity-40 cursor-not-allowed'}`}
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


        <div className="mt-10 text-center">
          <div className="text-[9px] text-gray-800 font-black tracking-[0.3em] uppercase mb-2">
            &copy; MMXXIV WR POS INFRASTRUCTURE
          </div>
          <div className="text-[7px] text-gray-700 font-mono opacity-50">
            V4.3.9 - BUILD: {BUILD_DATE}
          </div>
        </div>
      </GlassCard>
      </div>
    </div>
  );
};
