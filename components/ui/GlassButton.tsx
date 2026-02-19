
import React from 'react';

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
}

export const GlassButton: React.FC<GlassButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
  const baseStyles = "px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all duration-200 transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";

  const variants = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-500/20 border border-blue-400/20",
    success: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 border border-emerald-400/20",
    secondary: "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 backdrop-blur-md",
    danger: "bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-500/20 border border-red-400/20"
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};
