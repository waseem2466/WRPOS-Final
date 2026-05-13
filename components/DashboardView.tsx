import React, { useEffect, useState, useMemo } from 'react';
import { GlassCard } from './ui/GlassCard';
import { FloatingAIButton } from '../src/components/ui/FloatingAIButton';
import { db } from '../services/mockDb';
import { Bill } from '../types';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { TrendingUp, Users, Package, AlertCircle, Cloud, Database, MessageSquare } from 'lucide-react';


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
      const todayBills = (allBills as Bill[]).filter((b: Bill) => b.date.startsWith(today));

      const totalPending = (customers as any[]).reduce((sum: number, c: any) => sum + (c.balanceDue || 0), 0);

      setStats({
        todaySales: (todayBills as Bill[]).reduce((sum: number, b: Bill) => sum + (b.total || 0), 0),
        monthSales: (allBills as Bill[]).reduce((sum: number, b: Bill) => sum + (b.total || 0), 0),
        todayProfit: (todayBills as Bill[]).reduce((sum: number, b: Bill) => sum + (b.totalProfit || 0), 0),
        totalProfit: (allBills as Bill[]).reduce((sum: number, b: Bill) => sum + (b.totalProfit || 0), 0),
        pendingLoans: totalPending
      });
    };
    loadData();
  }, []);

  // Memoize AI context data
  const aiContextData = useMemo(() => `
Revenue Today: LKR ${stats.todaySales.toLocaleString()}
Total Sales (Month): LKR ${stats.monthSales.toLocaleString()}
Profit Today: LKR ${stats.todayProfit.toLocaleString()}
Total Net Profit: LKR ${stats.totalProfit.toLocaleString()}
Pending Customer Loans: LKR ${stats.pendingLoans.toLocaleString()}
Total Transactions: ${bills.length}
Average Transaction Value: LKR ${bills.length > 0 ? Math.round(stats.monthSales / bills.length).toLocaleString() : 0}
Profit Margin: ${stats.monthSales > 0 ? ((stats.totalProfit / stats.monthSales) * 100).toFixed(2) : 0}%
  `.trim(), [stats, bills.length]);

  const chartData = bills.slice(0, 7).reverse().map(b => ({
    name: new Date(b.date).toLocaleDateString(undefined, { weekday: 'short' }),
    sales: b.total ?? 0,
    profit: b.totalProfit ?? 0
  }));

  return (
    <div className="space-y-6 animate-fade-in relative p-2">
      {/* Cloud Connectivity Status Badges */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-[9px] font-black uppercase tracking-widest text-blue-400">
          <Cloud size={12} />
          <span>Firebase: Active</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-purple-600/10 border border-purple-500/20 text-[9px] font-black uppercase tracking-widest text-purple-400">
          <Database size={12} />
          <span>Neon Cloud: Syncing</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest text-emerald-400">
          <MessageSquare size={12} />
          <span>WhatsApp: Connected</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="relative overflow-hidden group hover:border-emerald-500/20 transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={48} />
          </div>
          <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">Today's Sales</p>
          <h3 className="text-2xl font-bold mt-1 text-white">LKR {stats.todaySales.toLocaleString()}</h3>
          <p className="text-emerald-400 text-xs mt-2 flex items-center gap-1 font-semibold">
            <TrendingUp size={12} /> Profit: LKR {stats.todayProfit.toLocaleString()}
          </p>
        </GlassCard>

        <GlassCard className="relative overflow-hidden group hover:border-purple-500/20 transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Package size={48} />
          </div>
          <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">Total Profit</p>
          <h3 className="text-2xl font-bold mt-1 text-purple-400">LKR {stats.totalProfit.toLocaleString()}</h3>
          <p className="text-gray-500 text-xs mt-2">Lifetime net income</p>
        </GlassCard>

        <GlassCard className="relative overflow-hidden group hover:border-red-500/20 transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertCircle size={48} />
          </div>
          <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">Pending Loans</p>
          <h3 className="text-2xl font-bold mt-1 text-red-400">LKR {stats.pendingLoans.toLocaleString()}</h3>
          <p className="text-gray-500 text-xs mt-2">Uncollected debt</p>
        </GlassCard>

        <GlassCard className="relative overflow-hidden group hover:border-blue-500/20 transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users size={48} />
          </div>
          <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">Total Bills</p>
          <h3 className="text-2xl font-bold mt-1 text-white">{bills.length}</h3>
          <p className="text-gray-500 text-xs mt-2">Transactions processed</p>
        </GlassCard>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="hover:border-blue-500/20 transition-all">
          <h4 className="text-lg font-semibold mb-4 text-white/90 uppercase tracking-wide">Recent Performance</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#666" fontSize={12} />
                <YAxis stroke="#666" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#8884d8" fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="profit" stroke="#82ca9d" fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="hover:border-blue-500/20 transition-all">
          <h4 className="text-lg font-semibold mb-4 text-white/90 uppercase tracking-wide">Recent Transactions</h4>
          <div className="overflow-y-auto max-h-64 custom-scrollbar">
            <table className="w-full text-sm text-left text-gray-400">
              <thead className="text-xs uppercase bg-white/5 text-gray-300 sticky top-0">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">Bill #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 rounded-r-lg">Type</th>
                </tr>
              </thead>
              <tbody>
                {bills.slice(0, 5).map(bill => (
                  <tr key={bill.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{bill.invoiceNumber}</td>
                    <td className="px-4 py-3 truncate max-w-[150px] font-bold uppercase">{bill.customerName}</td>
                    <td className="px-4 py-3 text-right font-black text-white">LKR {(bill.total ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${bill.paymentType === 'LOAN'
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
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

      {/* Floating AI Assistant */}
      <FloatingAIButton
        contextData={aiContextData}
        mode="EXECUTIVE"
        position="bottom-right"
      />
    </div>
  );
};
