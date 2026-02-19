import React, { useEffect, useState } from 'react';
import { GlassCard } from './ui/GlassCard';
import { db } from '../services/mockDb';
import { Bill } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { TrendingUp, Users, Package, AlertCircle, Sparkles } from 'lucide-react';
import { AIAdvisor } from './AIAdvisor';

export const Dashboard: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [stats, setStats] = useState({
    todaySales: 0,
    monthSales: 0,
    todayProfit: 0,
    totalProfit: 0,
    pendingLoans: 0
  });

  useEffect(() => {
    const loadData = async () => {
      const allBills = await db.bills.getAll();
      const customers = await db.customers.getAll();
      setBills(allBills);

      const today = new Date().toISOString().split('T')[0];
      const todayBills = allBills.filter(b => b.date.startsWith(today));
      
      const totalPending = customers.reduce((sum, c) => sum + (c.balanceDue || 0), 0);

      setStats({
        todaySales: todayBills.reduce((sum, b) => sum + b.total, 0),
        monthSales: allBills.reduce((sum, b) => sum + b.total, 0), // Simplified for demo
        todayProfit: todayBills.reduce((sum, b) => sum + b.totalProfit, 0),
        totalProfit: allBills.reduce((sum, b) => sum + b.totalProfit, 0),
        pendingLoans: totalPending
      });
    };
    loadData();
  }, []);

  const chartData = bills.slice(0, 7).reverse().map(b => ({
    name: new Date(b.date).toLocaleDateString(undefined, { weekday: 'short' }),
    sales: b.total,
    profit: b.totalProfit
  }));

  // Context for AI Advisor
  const dashboardContext = `
    DASHBOARD METRICS:
    - Revenue Today: LKR ${stats.todaySales.toLocaleString()}
    - Total Life Profit: LKR ${stats.totalProfit.toLocaleString()}
    - Current Debtors Balance: LKR ${stats.pendingLoans.toLocaleString()}
    - Recent Transaction Volume: ${bills.length} bills total.
    - Today's Profit: LKR ${stats.todayProfit.toLocaleString()}
  `;

  return (
    <div className="space-y-6 animate-fade-in p-2">
      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={48} />
          </div>
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Today's Sales</p>
          <h3 className="text-2xl font-bold mt-1">LKR {stats.todaySales.toLocaleString()}</h3>
          <p className="text-green-400 text-[10px] font-black mt-2 flex items-center gap-1 uppercase tracking-wider">
            <TrendingUp size={12} /> Profit: {stats.todayProfit.toLocaleString()}
          </p>
        </GlassCard>

        <GlassCard className="relative overflow-hidden group border-purple-500/10">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-purple-400">
            <Package size={48} />
          </div>
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Total Profit</p>
          <h3 className="text-2xl font-bold mt-1 text-purple-400 font-mono tracking-tighter">LKR {stats.totalProfit.toLocaleString()}</h3>
          <p className="text-gray-500 text-[9px] font-bold mt-2 uppercase">Lifetime net income</p>
        </GlassCard>

        <GlassCard className="relative overflow-hidden group border-red-500/10">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-red-400">
            <AlertCircle size={48} />
          </div>
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Pending Loans</p>
          <h3 className="text-2xl font-bold mt-1 text-red-400 font-mono tracking-tighter">LKR {stats.pendingLoans.toLocaleString()}</h3>
          <p className="text-gray-500 text-[9px] font-bold mt-2 uppercase">Uncollected debt</p>
        </GlassCard>

        <GlassCard className="relative overflow-hidden group border-blue-500/10">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-blue-400">
            <Users size={48} />
          </div>
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Total Bills</p>
          <h3 className="text-2xl font-bold mt-1 text-blue-400 font-mono tracking-tighter">{bills.length}</h3>
          <p className="text-gray-500 text-[9px] font-bold mt-2 uppercase">Transactions processed</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Performance Chart */}
        <GlassCard className="flex flex-col min-h-[350px]">
          <h4 className="text-[10px] font-black mb-6 text-white uppercase tracking-[0.2em] flex items-center gap-2">
            <Activity size={14} className="text-blue-500" /> Weekly Performance
          </h4>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#334155" fontSize={10} fontWeight="900" tick={{fill: '#475569'}} />
                <YAxis stroke="#334155" fontSize={10} fontWeight="900" tick={{fill: '#475569'}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* AI EXECUTIVE ADVISOR */}
        <div className="h-full min-h-[350px]">
          <AIAdvisor 
            contextData={dashboardContext} 
            mode="EXECUTIVE"
          />
        </div>
      </div>

      {/* Recent Transactions Table */}
      <GlassCard className="overflow-hidden">
        <h4 className="text-[10px] font-black mb-6 text-white uppercase tracking-[0.2em] flex items-center gap-2 px-2">
          <Sparkles size={14} className="text-yellow-400" /> Recent Activity
        </h4>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-black uppercase tracking-widest bg-white/5 text-gray-400">
              <tr>
                <th className="px-6 py-4">Bill ID</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4 text-right">Net Value</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {bills.slice(0, 10).map(bill => (
                <tr key={bill.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4 font-mono text-[11px] text-blue-400">{bill.invoiceNumber}</td>
                  <td className="px-6 py-4 text-[11px] font-bold text-white uppercase tracking-tight">{bill.customerName}</td>
                  <td className="px-6 py-4 text-right font-black text-white text-[11px]">LKR {bill.total.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${bill.paymentType === 'LOAN' ? 'bg-red-500/20 text-red-400 border border-red-500/20' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'}`}>
                      {bill.paymentType}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};

// Internal Activity icon for charts
const Activity = ({ size, className }: { size: number, className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
