import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, X, Bot, User, BrainCircuit, Zap, Sparkles } from 'lucide-react';
import { generateAiContent, parseUserIntent, getAIEngine } from '../services/ai';
import { useAction } from '../context/ActionContext';
import { db } from '../services/mockDb';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isAction?: boolean;
  actionType?: string;
}

const QUICK_COMMANDS = [
  { label: 'Go to Billing', command: 'go to billing' },
  { label: 'Low Stock', command: 'show low stock items' },
  { label: 'Debt Report', command: 'who owes me debt?' },
  { label: 'Today Sales', command: 'how much did I sell today?' }
];

export const GlobalCommander: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const { dispatch } = useAction();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize with welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: "Hello! I'm your AI business assistant. I can help you navigate, analyze data, and answer questions about your business. What would you like to do?",
        timestamp: Date.now()
      }]);
    }
  }, [isOpen, messages.length]);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  // Get business context for AI
  const getBusinessContext = async () => {
    try {
      const stats = await db.getTableStats();
      const products = await db.products.getAll();
      const customers = await db.customers.getAll();
      const bills = await db.bills.getAll();

      const lowStock = products.filter(p => p.stock < 5);
      const debtCustomers = customers.filter(c => (c.balanceDue || 0) > 0);
      const todayBills = bills.filter(b =>
        b.date.startsWith(new Date().toISOString().split('T')[0])
      );

      return {
        stats,
        lowStockCount: lowStock.length,
        totalDebt: debtCustomers.reduce((sum, c) => sum + (c.balanceDue || 0), 0),
        todaySales: todayBills.reduce((sum, b) => sum + (b.total || 0), 0),
        totalCustomers: customers.length,
        totalProducts: products.length
      };
    } catch (error) {
      console.error('Failed to load business context:', error);
      return null;
    }
  };

  const handleSubmit = async (e?: React.FormEvent, quickCommand?: string) => {
    if (e) e.preventDefault();

    const userText = (quickCommand || input).trim();
    if (!userText || isThinking) return;

    setInput('');

    // Add user message
    const userMsg: ChatMessage = {
      role: 'user',
      content: userText,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      // 1. Try to parse as action command
      const action = await parseUserIntent(userText);

      if (action && action.type && action.type !== 'UNKNOWN') {
        // Action command detected
        dispatch({ ...action, rawInput: userText } as any);

        const actionMsg: ChatMessage = {
          role: 'assistant',
          content: `✓ Executing: ${action.type.replace(/_/g, ' ')}`,
          timestamp: Date.now(),
          isAction: true,
          actionType: action.type
        };

        setMessages(prev => [...prev, actionMsg]);

        // Close after short delay
        setTimeout(() => setIsOpen(false), 1000);
        setIsThinking(false);
        return;
      }

      // 2. Handle as general business question
      const context = await getBusinessContext();

      if (!context) {
        throw new Error('Unable to load business data');
      }

      const prompt = `
You are an AI business assistant for "WR SMILE SUPPLIES" POS system.

CURRENT BUSINESS SNAPSHOT:
- Total Products: ${context.totalProducts}
- Low Stock Items: ${context.lowStockCount}
- Total Customers: ${context.totalCustomers}
- Outstanding Debt: LKR ${context.totalDebt.toLocaleString()}
- Today's Sales: LKR ${context.todaySales.toLocaleString()}

USER QUESTION: "${userText}"

INSTRUCTIONS:
- Provide a helpful, concise response (2-3 sentences max)
- If they ask about navigation, mention you can help them go there
- Be professional but friendly
- Use the data above to give specific answers when relevant
- If you don't have enough info, say so clearly

Response:
      `.trim();

      const response = await generateAiContent(prompt);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.trim(),
        timestamp: Date.now()
      }]);

    } catch (error: any) {
      console.error('AI error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I encountered an error processing your request. Please try again or rephrase your question.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[9999] w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:scale-110 transition-all active:scale-95 group border-2 border-white/20"
        aria-label="Open AI Commander"
      >
        <div className="relative">
          <BrainCircuit className="text-white group-hover:rotate-12 transition-transform" size={28} />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0f172a] animate-pulse" />
        </div>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0b1121] border-2 border-white/10 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-300 flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border-b border-white/5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center border border-blue-500/20 shadow-lg">
              <Bot className="text-blue-400" size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">
                AI Commander
              </h3>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                  Ollama Cloud Active
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-3 bg-white/5 rounded-2xl text-gray-500 hover:text-white hover:bg-red-500/20 transition-all"
            aria-label="Close AI Commander"
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick Commands (only show at start) */}
        {messages.length <= 1 && !isThinking && (
          <div className="p-4 border-b border-white/5 bg-black/20 shrink-0">
            <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-3">
              Quick Commands
            </p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_COMMANDS.map((cmd, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSubmit(undefined, cmd.command)}
                  className="p-3 bg-white/5 border border-white/5 rounded-xl text-left hover:bg-blue-600/20 hover:border-blue-500/30 transition-all group"
                >
                  <p className="text-[10px] font-black text-white uppercase tracking-wide group-hover:text-blue-400 transition-colors">
                    {cmd.label}
                  </p>
                  <p className="text-[8px] text-gray-600 font-medium mt-0.5">
                    "{cmd.command}"
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar min-h-0" ref={scrollRef}>
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in slide-in-from-bottom-2 fade-in`}
            >
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center border shadow-lg ${msg.role === 'user'
                ? 'bg-indigo-600/20 border-indigo-500/20'
                : 'bg-blue-600/20 border-blue-500/20'
                }`}>
                {msg.role === 'user' ? (
                  <User className="text-indigo-400" size={18} />
                ) : (
                  <Bot className="text-blue-400" size={18} />
                )}
              </div>

              {/* Message Bubble */}
              <div className={`max-w-[80%] p-4 rounded-3xl text-sm font-medium leading-relaxed ${msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg'
                : msg.isAction
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-tl-none'
                  : 'bg-white/5 text-gray-300 border border-white/5 rounded-tl-none'
                }`}>
                {msg.content}
              </div>
            </div>
          ))}

          {/* Thinking Indicator */}
          {isThinking && (
            <div className="flex gap-4 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/20 flex items-center justify-center shadow-lg">
                <Sparkles className="text-blue-400 animate-spin" size={18} />
              </div>
              <div className="bg-white/5 border border-white/5 p-4 rounded-3xl rounded-tl-none text-gray-500 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <Zap size={14} className="animate-bounce" />
                Processing...
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 bg-black/20 border-t border-white/5 shrink-0">
          <form onSubmit={handleSubmit} className="relative">
            <input
              ref={inputRef}
              className="w-full bg-black/40 border-2 border-white/10 rounded-[1.5rem] py-5 pl-6 pr-16 text-sm font-bold text-white placeholder-gray-700 outline-none focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Type a command or ask a question..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={isThinking}
            />
            <button
              type="submit"
              disabled={isThinking || !input.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg hover:bg-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-90"
              aria-label="Send message"
            >
              <Send size={20} />
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest">
              Powered by Ollama Cloud
            </p>
            <p className="text-[8px] font-medium text-gray-700">
              {messages.length - 1} messages
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
