import React from 'react';
import { AuthView, NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react/ui';
import { authClient } from '../lib/auth';

export const AuthPage = () => {
  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
        <NeonAuthUIProvider authClient={authClient}>
          <AuthView />
        </NeonAuthUIProvider>
      </div>
    </div>
  );
};
