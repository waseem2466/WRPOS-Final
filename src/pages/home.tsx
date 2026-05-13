import React from 'react';
import { Link } from 'react-router-dom';

export const HomePage = () => {
  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-5xl font-black text-white mb-4 tracking-tighter">
        Welcome to <span className="text-blue-500 text-glow">WR POS</span>
      </h1>
      <p className="text-slate-400 max-w-md mb-12 text-lg">
        The most powerful cloud-based billing and management intelligence for your business.
      </p>
      
      <div className="flex gap-4">
        <Link 
          to="/auth" 
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20"
        >
          Sign In
        </Link>
        <Link 
          to="/account" 
          className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-bold transition-all"
        >
          Manage Account
        </Link>
      </div>
    </div>
  );
};
