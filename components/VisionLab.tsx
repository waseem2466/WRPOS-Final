import React from 'react';
import { Eye, Sparkles } from 'lucide-react';

export const VisionLab: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 text-center">
      <div className="w-20 h-20 rounded-[1.5rem] bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center shadow-xl">
        <Eye size={36} className="text-purple-400" />
      </div>
      <div>
        <p className="text-[10px] font-black text-purple-400 uppercase tracking-[0.3em] mb-2">
          <Sparkles className="inline-block mr-1" size={10} /> Vision Lab
        </p>
        <h2 className="text-2xl font-black text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          Coming Soon
        </h2>
        <p className="text-sm text-slate-400 max-w-sm">
          AI-powered image recognition and visual intelligence features are under development.
        </p>
      </div>
    </div>
  );
};

export default VisionLab;
