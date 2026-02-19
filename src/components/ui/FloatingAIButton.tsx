import { BrainCircuit, X } from 'lucide-react';
import React, { useState } from 'react';
import { AIAdvisor } from '../../../components/AIAdvisor';
import { GlassCard } from '../../../components/ui/GlassCard';

interface FloatingAIButtonProps {
  contextData: string;
  mode: 'EXECUTIVE' | 'INVENTORY' | 'CUSTOMER' | 'SUPPLIER';
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export const FloatingAIButton: React.FC<FloatingAIButtonProps> = ({
  contextData,
  mode,
  position = 'bottom-right'
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6'
  };

  const panelPositionClasses = {
    'bottom-right': 'bottom-24 right-6',
    'bottom-left': 'bottom-24 left-6',
    'top-right': 'top-24 right-6',
    'top-left': 'top-24 left-6'
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed ${positionClasses[position]} z-[100] w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-2xl shadow-purple-600/40 hover:scale-110 active:scale-95 transition-all flex items-center justify-center group`}
        aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
      >
        {isOpen ? (
          <X size={24} className="group-hover:rotate-90 transition-transform" />
        ) : (
          <BrainCircuit size={24} className="group-hover:rotate-12 transition-transform" />
        )}
        
        {/* Pulse indicator when closed */}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#0b1121] animate-pulse" />
        )}
      </button>

      {/* AI Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className={`fixed ${panelPositionClasses[position]} z-[95] w-full max-w-[500px] h-[600px] animate-in slide-in-from-bottom-4 fade-in duration-300`}>
            <GlassCard className="h-full bg-[#0b1121] border-purple-500/20 shadow-2xl">
              <AIAdvisor
                contextData={contextData}
                mode={mode}
                onClose={() => setIsOpen(false)}
              />
            </GlassCard>
          </div>
        </>
      )}
    </>
  );
};
