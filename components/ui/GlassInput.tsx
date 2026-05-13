import React, { forwardRef } from 'react';

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  className?: string;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2 w-full">
        {label && (
          <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] ml-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`glass-input rounded-[1.25rem] px-5 py-3.5 text-sm font-bold placeholder-slate-600 w-full ${className}`}
          {...props}
        />
      </div>
    );
  }
);

GlassInput.displayName = 'GlassInput';
