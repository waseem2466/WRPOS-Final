import { BrainCircuit, ChevronDown, ChevronUp } from 'lucide-react';
import React, { useState } from 'react';
import { AIAdvisor } from '../../../components/AIAdvisor';

interface CollapsibleAIPanelProps {
  contextData: string;
  mode: 'EXECUTIVE' | 'INVENTORY' | 'CUSTOMER' | 'SUPPLIER';
  className?: string;
}

export const CollapsibleAIPanel: React.FC<CollapsibleAIPanelProps> = ({
  contextData,
  mode,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`${className}`}>
      {/* Collapsed State - Button Bar */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full p-4 bg-gradient-to-r from-purple-600/10 to-blue-600/10 border border-purple-500/20 rounded-2xl hover:border-purple-500/40 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                <BrainCircuit size={20} />
              </div>
              <div className="text-left">
                <p className="text-xs font-black text-white uppercase tracking-widest">
                  AI Business Insights
                </p>
                <p className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">
                  Click to analyze {mode.toLowerCase()} data
                </p>
              </div>
            </div>
            <ChevronDown size={18} className="text-gray-500 group-hover:text-white transition-colors" />
          </div>
        </button>
      )}

      {/* Expanded State - Full AI Advisor */}
      {isExpanded && (
        <div className="animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="mb-2 flex justify-end">
            <button
              onClick={() => setIsExpanded(false)}
              className="flex items-center gap-2 text-[9px] font-black text-gray-500 hover:text-white uppercase tracking-widest transition-all px-3 py-1.5 bg-white/5 rounded-lg"
            >
              <ChevronUp size={12} /> Collapse
            </button>
          </div>
          <div className="h-[500px]">
            <AIAdvisor
              contextData={contextData}
              mode={mode}
            />
          </div>
        </div>
      )}
    </div>
  );
};
