import { BrainCircuit, Zap, TrendingDown, AlertCircle } from 'lucide-react';
import React, { useState } from 'react';
import { GlassCard } from '../../../components/ui/GlassCard';

interface QuickAIInsightsProps {
  contextData: string;
  mode: 'EXECUTIVE' | 'INVENTORY' | 'CUSTOMER' | 'SUPPLIER';
}

const QUICK_QUERIES = {
  SUPPLIER: [
    { label: 'Payment Priorities', query: 'Which vendor payments should I prioritize this week?', icon: AlertCircle },
    { label: 'Cost Reduction', query: 'How can I reduce procurement costs?', icon: TrendingDown },
    { label: 'Vendor Analysis', query: 'Who are my most reliable suppliers?', icon: Zap }
  ],
  INVENTORY: [
    { label: 'Restock Alert', query: 'Which items need immediate restocking?', icon: AlertCircle },
    { label: 'Dead Stock', query: 'Identify slow-moving inventory', icon: TrendingDown },
    { label: 'Value Analysis', query: 'What is my highest value inventory?', icon: Zap }
  ],
  CUSTOMER: [
    { label: 'Credit Risk', query: 'Which customers have high credit risk?', icon: AlertCircle },
    { label: 'Top Customers', query: 'Who are my most valuable customers?', icon: Zap },
    { label: 'Debt Recovery', query: 'Best strategy for debt recovery?', icon: TrendingDown }
  ],
  EXECUTIVE: [
    { label: 'Cash Flow', query: 'Analyze current cash flow health', icon: Zap },
    { label: 'Profit Margins', query: 'How can I improve profit margins?', icon: TrendingDown },
    { label: 'Growth Strategy', query: 'What are my growth opportunities?', icon: AlertCircle }
  ]
};

export const QuickAIInsights: React.FC<QuickAIInsightsProps> = ({ contextData, mode }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const queries = QUICK_QUERIES[mode];

  if (!isExpanded) {
    return (
      <GlassCard className="p-3 border-purple-500/10 bg-gradient-to-r from-purple-600/5 to-blue-600/5">
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <BrainCircuit size={16} />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black text-white uppercase tracking-widest">
                AI Quick Insights
              </p>
              <p className="text-[8px] text-gray-600 font-bold uppercase">
                Get instant analysis
              </p>
            </div>
          </div>
          <div className="text-[8px] font-black text-purple-400 uppercase tracking-widest px-3 py-1 bg-purple-600/10 rounded-lg border border-purple-500/20">
            Expand
          </div>
        </button>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4 border-purple-500/20 bg-gradient-to-r from-purple-600/5 to-blue-600/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center text-purple-400">
            <BrainCircuit size={16} />
          </div>
          <p className="text-[10px] font-black text-white uppercase tracking-widest">
            AI Quick Insights
          </p>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-[8px] font-black text-gray-500 hover:text-white uppercase tracking-widest px-3 py-1 bg-white/5 rounded-lg transition-all"
        >
          Collapse
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {queries.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              className="p-3 bg-black/40 border border-white/5 rounded-xl hover:border-purple-500/30 transition-all group text-left"
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon size={12} className="text-purple-400 group-hover:text-purple-300" />
                <span className="text-[9px] font-black text-white uppercase tracking-widest">
                  {item.label}
                </span>
              </div>
              <p className="text-[8px] text-gray-600 font-medium line-clamp-1">
                {item.query}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-white/5">
        <p className="text-[7px] text-gray-700 uppercase tracking-widest text-center">
          Click floating AI button for detailed analysis
        </p>
      </div>
    </GlassCard>
  );
};
