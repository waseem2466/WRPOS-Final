import React, { forwardRef } from 'react';

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  className?: string;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, className = '', ...props }, ref) => {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {label && (
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className="glass-input rounded-2xl px-5 py-3 text-sm font-semibold placeholder-slate-700 w-full"
          {...props}
        />
      </div>
    );
  }
);

GlassInput.displayName = 'GlassInput';
