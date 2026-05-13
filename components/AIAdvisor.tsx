
import { Activity, BrainCircuit, RefreshCw, ShieldCheck, Zap, X, Send } from 'lucide-react';
import React, { useState } from 'react';
import { GlassCard } from './ui/GlassCard';
import { generateAiContent, getAIEngine } from '../services/ai';
import { audioService } from '../services/audio';

interface AIAdvisorProps {
  contextData: string;
  mode?: 'EXECUTIVE' | 'INVENTORY' | 'CUSTOMER' | 'SUPPLIER';
  onClose?: () => void;
  compact?: boolean;
  stats?: any; // Legacy support
}

export const AIAdvisor: React.FC<AIAdvisorProps> = ({ contextData, mode = 'EXECUTIVE', onClose, compact = false, stats }) => {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [userQuery, setUserQuery] = useState<string>('');

  // Construct context if stats object is passed (legacy support for Dashboard)
  const actualContext = contextData || (stats ? `
    Revenue Today: LKR ${stats.todaySales}
    Total Net Profit: LKR ${stats.totalProfit}
    Pending Loans: LKR ${stats.pendingLoans}
    Inventory Value: LKR ${stats.inventoryValue}
    Top Category: ${stats.topCategory}
  ` : "No data provided.");

  const getAdvice = async () => {
    setLoading(true);
    setAdvice(null);
    try {
      const modePrompt = {
        EXECUTIVE: "Focus on overall financial health, profit margins, and debt reduction.",
        INVENTORY: "Focus on stock turnover, dead stock identification, and inventory valuation risks. Highlight low stock items if any.",
        CUSTOMER: "Focus on credit risk analysis, customer retention, and debt recovery strategies.",
        SUPPLIER: "Focus on procurement efficiency, vendor reliance, and cash flow management regarding payables."
      }[mode];

      const userSpecificPrompt = userQuery ? `
User Question: \"${userQuery}\". Please prioritize answering this question based on the provided metadata.` : "";

      const prompt = `
        System: Quantum Business Intelligence Analyst (SaaS Treasury Grade).
        Mode: ${mode} ANALYSIS
        
        Live Metadata:
        ${actualContext}

        Task Objectives:
        1. ${modePrompt}
        2. Calculate a "Health Score" (0-100) based on the data provided.
        3. Provide 3-4 high-impact, specific actionable directives/strategies.
        4. Include one practical business idea that can increase sales, reduce cost, or improve cash flow this week.
        ${userSpecificPrompt}
        
        Formatting:
        - Start with "SCORE: [number]"
        - Use professional, concise business language.
        - Bullet points for advice.
      `;

      const text = await generateAiContent(prompt);
      audioService.playNotification();

      // Parse Score
      const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
      if (scoreMatch) {
        setHealthScore(parseInt(scoreMatch[1]));
        setAdvice(text.split(/SCORE:\s*\d+/i)[1]?.trim() || text);
      } else {
        setAdvice(text);
      }
    } catch (error: any) {
      console.error("AI Advisor Error:", error);
      const message = String(error?.message || '');
      if (message.includes('RESOURCE_EXHAUSTED') || message.toLowerCase().includes('quota')) {
        setAdvice("Gemini is connected, but the Google project has no available quota right now. Enable billing or wait for quota reset, then try again. If local AI is available, the app will use fallback AI for business advice.");
      } else {
        setAdvice(`AI connection interrupted. ${message || 'Please check system credentials.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard className={`flex flex-col h-full min-h-0 border-blue-500/20 bg-gradient-to-br from-blue-600/5 to-purple-600/5 overflow-hidden relative ${compact ? 'p-4' : 'p-6'}`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-400 shadow-xl border border-blue-500/10">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">{mode} INTELLIGENCE</h3>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em] flex items-center gap-2">
              <ShieldCheck size={10} className="text-emerald-500" /> Neural Link Active
            </p>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          {healthScore !== null && (
            <div className="flex items-center gap-4 bg-white/5 px-4 py-2 h-[52px] rounded-xl border border-white/5">
              <div>
                <p className="text-[8px] font-black text-gray-600 uppercase mb-0.5">Score</p>
                <p className={`text-lg font-black font-mono tracking-tighter ${healthScore > 70 ? 'text-emerald-400' : healthScore > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {healthScore}%
                </p>
              </div>
              <Activity size={18} className={healthScore > 70 ? 'text-emerald-400' : 'text-red-400'} />
            </div>
          )}
          {onClose && (
            <button onClick={onClose} className="p-3 bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-500 rounded-xl transition-all h-[52px] w-[52px] flex items-center justify-center">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="relative group z-[3500] mb-5">
        <input
          type="text"
          placeholder="Ask specific question (e.g., 'Which items need restocking?')"
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          className="w-full bg-black/50 border-2 border-white/10 rounded-[2rem] py-5 px-6 pr-20 text-[13px] text-white placeholder-gray-500 outline-none focus:border-blue-500/50 transition-all font-medium shadow-2xl"
          onKeyDown={(e) => e.key === 'Enter' && getAdvice()}
        />
        <button
          onClick={getAdvice}
          disabled={loading}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-blue-600/20 text-blue-400 rounded-2xl hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50 h-12 w-12 flex items-center justify-center"
        >
          {loading ? <RefreshCw size={20} className="animate-spin" /> : <Send size={20} />}
        </button>
      </div>

      {loading && (
        <div className="space-y-4 py-4 animate-in fade-in duration-500">
          <div className="h-2 bg-white/5 rounded-full w-1/4 animate-pulse"></div>
          <div className="h-2 bg-white/5 rounded-full w-3/4 animate-pulse"></div>
          <div className="h-2 bg-white/5 rounded-full w-2/3 animate-pulse delay-75"></div>
        </div>
      )}

      {advice && !loading && (
        <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="p-8 bg-black/50 rounded-[2.5rem] border border-white/10 shadow-inner flex-1 min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto custom-scrollbar">
              <div className="prose prose-invert prose-sm max-w-none text-gray-200 text-sm font-medium leading-loose whitespace-pre-line tracking-wide">
                {advice}
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <div className="flex items-center gap-2 text-[8px] font-black text-gray-700 uppercase tracking-widest">
              <Zap size={10} /> Powered by {getAIEngine().toUpperCase()}
            </div>
          </div>
        </div>
      )}

      {!loading && !advice && (
        <div className="flex-1 min-h-0 rounded-[2rem] border border-dashed border-white/10 bg-black/20 px-6 py-8 text-center flex items-center justify-center">
          <div className="max-w-md space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">
              Ask The Advisor
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">
              Get a quick operational summary, profit signal, and next-step recommendations from your live business data.
            </p>
          </div>
        </div>
      )}
    </GlassCard>
  );
};
