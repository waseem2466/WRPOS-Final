import React from 'react';
import { AccountView, NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react/ui';
import { authClient } from '../lib/auth';

export const AccountPage = () => {
  return (
    <div className="min-h-screen bg-[#020617] p-8">
      <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
        <h1 className="text-3xl font-black text-white mb-8">Account Settings</h1>
        <NeonAuthUIProvider authClient={authClient}>
          <AccountView />
        </NeonAuthUIProvider>
      </div>
    </div>
  );
};
