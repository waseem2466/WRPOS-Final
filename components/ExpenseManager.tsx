import React, { useState, useEffect, useMemo } from 'react';
import { db, generateId } from '../services/mockDb';
import { Expense } from '../types';
import { GlassCard } from './ui/GlassCard';
import { GlassInput } from './ui/GlassInput';
import { FloatingAIButton } from '../src/components/ui/FloatingAIButton';
import { 
  Plus, Trash2, Wallet, Home, Heart, Zap, Coffee, ShoppingBag, 
  Edit2, History, Receipt, TrendingDown, AlertCircle
} from 'lucide-react';

const CATEGORIES = [
  { id: 'Home', icon: Home, color: 'text-blue-400' },
  { id: 'Medicine', icon: Heart, color: 'text-red-400' },
  { id: 'Utility', icon: Zap, color: 'text-yellow-400' },
  { id: 'Food', icon: Coffee, color: 'text-orange-400' },
  { id: 'Personal', icon: ShoppingBag, color: 'text-purple-400' },
  { id: 'General', icon: Wallet, color: 'text-gray-400' }
];

export const ExpenseManager: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Expense>>({
    category: 'Home', 
    amount: 0, 
    note: '', 
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => { loadExpenses(); }, []);
  
  const loadExpenses = async () => { 
    setExpenses(await db.expenses.getAll()); 
  };

  // Calculate expense analytics
  const analytics = useMemo(() => {
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    
    const byCategory = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);
    
    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    
    const today = new Date().toISOString().split('T')[0];
    const todayExpenses = expenses.filter(e => e.date === today);
    const todayTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthExpenses = expenses.filter(e => e.date.startsWith(thisMonth));
    const monthTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    return {
      total,
      byCategory,
      topCategory: topCategory ? topCategory[0] : 'None',
      topCategoryAmount: topCategory ? topCategory[1] : 0,
      todayTotal,
      monthTotal,
      averageExpense: expenses.length > 0 ? total / expenses.length : 0,
      transactionCount: expenses.length
    };
  }, [expenses]);

  // AI Context Data
  const aiContextData = useMemo(() => `
Total Expenses: LKR ${analytics.total.toLocaleString()}
Expenses Today: LKR ${analytics.todayTotal.toLocaleString()}
Expenses This Month: LKR ${analytics.monthTotal.toLocaleString()}
Average Transaction: LKR ${Math.round(analytics.averageExpense).toLocaleString()}
Total Transactions: ${analytics.transactionCount}
Highest Category: ${analytics.topCategory} (LKR ${analytics.topCategoryAmount.toLocaleString()})

Category Breakdown:
${Object.entries(analytics.byCategory).map(([cat, amt]) => 
  `${cat}: LKR ${amt.toLocaleString()}`
).join('\n')}
  `.trim(), [analytics]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || formData.amount <= 0) return;
    
    const expense: Expense = { 
      id: editingExpenseId || generateId(), 
      category: formData.category || 'General', 
      amount: Number(formData.amount), 
      note: formData.note || '', 
      date: formData.date || new Date().toISOString().split('T')[0] 
    };
    
    if (editingExpenseId) {
      await db.expenses.update(expense);
    } else {
      await db.expenses.add(expense);
    }
    
    setFormData({ 
      category: 'Home', 
      amount: 0, 
      note: '', 
      date: new Date().toISOString().split('T')[0] 
    });
    setEditingExpenseId(null);
    loadExpenses();
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to permanently remove this expense entry?")) return;
    try {
      await db.expenses.delete(id);
      loadExpenses();
    } catch (err) {
      alert("Failed to delete expense. System access error.");
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setFormData(expense);
    // Scroll to form on mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingExpenseId(null);
    setFormData({ 
      category: 'Home', 
      amount: 0, 
      note: '', 
      date: new Date().toISOString().split('T')[0] 
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in h-full lg:overflow-hidden overflow-y-auto custom-scrollbar pr-1 relative">
      {/* Left Column - Form */}
      <div className="lg:col-span-4 lg:h-full lg:overflow-y-auto custom-scrollbar pb-4 lg:pb-0">
        <GlassCard className="bg-[#0b1121]/90 p-8 rounded-[3rem] border-white/5 h-fit shadow-2xl">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xs font-black text-white uppercase tracking-[0.3em] flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-500 flex items-center justify-center border border-blue-500/10">
                <Plus size={20}/>
              </div>
              {editingExpenseId ? 'Edit Entry' : 'New Expenditure'}
            </h3>
            {editingExpenseId && (
              <button
                onClick={handleCancelEdit}
                className="text-[8px] font-black text-gray-500 hover:text-white uppercase tracking-widest px-3 py-1.5 bg-white/5 rounded-lg transition-all"
              >
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-6">
            {/* Category Selection */}
            <div className="grid grid-cols-3 gap-3">
              {CATEGORIES.map(cat => (
                <button 
                  key={cat.id} 
                  type="button" 
                  onClick={() => setFormData({...formData, category: cat.id})} 
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                    formData.category === cat.id 
                      ? 'bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-600/20 scale-105' 
                      : 'bg-black/40 border-white/5 text-gray-700 hover:text-gray-400 hover:border-white/10'
                  }`}
                >
                  <cat.icon size={18} />
                  <span className="text-[7px] font-black uppercase mt-2 tracking-widest">{cat.id}</span>
                </button>
              ))}
            </div>

            {/* Amount Input */}
            <GlassInput 
              label="Cash Outlay (LKR)" 
              type="number" 
              value={formData.amount || ''} 
              onChange={e => setFormData({...formData, amount: Number(e.target.value)})} 
              required 
            />

            {/* Date Input */}
            <GlassInput 
              label="Transaction Date" 
              type="date" 
              value={formData.date} 
              onChange={e => setFormData({...formData, date: e.target.value})} 
              required 
            />

            {/* Note Textarea */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                Memo/Reference
              </label>
              <textarea 
                className="glass-input rounded-2xl px-5 py-4 text-xs outline-none min-h-[100px] resize-none focus:border-blue-500 transition-all" 
                value={formData.note} 
                onChange={e => setFormData({...formData, note: e.target.value})} 
                placeholder="Describe use of funds..." 
              />
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              className="w-full py-5 bg-blue-600 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.4em] shadow-3xl hover:bg-blue-500 active:scale-95 transition-all"
            >
              {editingExpenseId ? 'UPDATE RECORD' : 'AUTHORIZE PAYMENT'}
            </button>
          </form>
        </GlassCard>
      </div>
      
      {/* Right Column - Expense List */}
      <div className="lg:col-span-8 flex flex-col lg:h-full min-h-[500px]">
        <GlassCard className="bg-[#0b1121]/40 flex-1 flex flex-col overflow-hidden p-6 rounded-[3rem] border-white/5 h-full">
          {/* Header with Analytics */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 shrink-0 px-4 gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500 border border-white/10">
                <Receipt size={24}/>
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tighter">Expenditure Ledger</h3>
                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider">
                  {analytics.transactionCount} Transactions
                </p>
              </div>
            </div>

            {/* Total Burn Display */}
            <div className="grid grid-cols-2 gap-3">
              <div className="px-4 py-2.5 bg-red-600/10 rounded-xl border border-red-500/20">
                <span className="text-[7px] font-black text-red-400 uppercase tracking-widest block mb-0.5">
                  Total Burn
                </span>
                <p className="text-base font-black text-red-400 font-mono tracking-tighter">
                  LKR {analytics.total.toLocaleString()}
                </p>
              </div>
              <div className="px-4 py-2.5 bg-orange-600/10 rounded-xl border border-orange-500/20">
                <span className="text-[7px] font-black text-orange-400 uppercase tracking-widest block mb-0.5">
                  This Month
                </span>
                <p className="text-base font-black text-orange-400 font-mono tracking-tighter">
                  LKR {analytics.monthTotal.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Category Breakdown Bar (Optional) */}
          {expenses.length > 0 && (
            <div className="mb-6 px-4 shrink-0">
              <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-3">
                  Category Distribution
                </p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(analytics.byCategory).map(([cat, amount]) => {
                    const percentage = ((amount / analytics.total) * 100).toFixed(1);
                    const categoryInfo = CATEGORIES.find(c => c.id === cat);
                    return (
                      <div 
                        key={cat}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/5"
                      >
                        {categoryInfo && <categoryInfo.icon size={12} className={categoryInfo.color} />}
                        <span className="text-[9px] font-bold text-gray-400">
                          {cat}
                        </span>
                        <span className="text-[9px] font-black text-white">
                          {percentage}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          
          {/* Expense List */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {expenses.map(expense => {
              const categoryInfo = CATEGORIES.find(c => c.id === expense.category);
              return (
                <div 
                  key={expense.id} 
                  className={`p-6 rounded-[2rem] bg-black/40 border flex items-center justify-between group hover:bg-white/5 transition-all shadow-xl ${
                    editingExpenseId === expense.id 
                      ? 'border-blue-500/50 bg-blue-600/5' 
                      : 'border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-5 min-w-0 flex-1">
                    <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-sm font-black border border-white/5 shadow-inner ${categoryInfo?.color || 'text-gray-400'}`}>
                      {categoryInfo ? <categoryInfo.icon size={24} /> : <Wallet size={24} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[14px] font-black text-white uppercase tracking-tight truncate">
                        {expense.note || expense.category}
                      </h4>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-[9px] font-black text-gray-700 uppercase tracking-widest">
                          {expense.category}
                        </span>
                        <span className="text-[9px] text-gray-700 font-bold uppercase">
                          {new Date(expense.date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 shrink-0">
                    <p className="text-xl font-black text-red-500 font-mono tracking-tighter">
                      -LKR {expense.amount.toLocaleString()}
                    </p>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => handleEditExpense(expense)} 
                        className="p-3 bg-white/5 text-blue-400 rounded-xl hover:text-white hover:bg-blue-600/20 transition-all"
                        aria-label="Edit expense"
                      >
                        <Edit2 size={18}/>
                      </button>
                      <button 
                        onClick={() => handleDeleteExpense(expense.id)} 
                        className="p-3 bg-white/5 text-red-500/20 rounded-xl hover:text-red-500 hover:bg-red-600/20 transition-all"
                        aria-label="Delete expense"
                      >
                        <Trash2 size={18}/>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Empty State */}
            {expenses.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-10 py-40">
                <History size={80} />
                <p className="text-sm font-black uppercase tracking-[0.5em] mt-6">
                  Awaiting Transactions
                </p>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Floating AI Assistant */}
      <FloatingAIButton
        contextData={aiContextData}
        mode="EXECUTIVE"
        position="bottom-right"
      />
    </div>
  );
};
