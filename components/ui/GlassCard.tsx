
import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', style, onClick }) => {
  return (
    <div 
      className={`glass-card glass-card-hover rounded-[2.25rem] p-6 ${className}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
