
import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '' }) => {
  return (
    <div className={`glass-card glass-card-hover rounded-[2rem] p-6 ${className}`}>
      {children}
    </div>
  );
};
