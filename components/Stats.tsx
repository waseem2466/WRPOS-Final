
import React, { useEffect, useState } from 'react';
import { GlassCard } from './ui/GlassCard';
import { db, generateId } from '../services/mockDb';
import { Bill, Product, Expense, MonthlySummary, ReturnRecord, BusinessSettings } from '../types';
import { AIAdvisor } from './AIAdvisor';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid
} from 'recharts';
import {
  Target, Activity, Clock, Printer, RefreshCw, Loader2, RotateCcw,
  Archive, FileBarChart, ListFilter, TrendingUp, DollarSign,
  LineChart, Wallet, BadgePercent, Layers3
} from 'lucide-react';
import { audioService } from '../services/audio';

const SHOP_LOGO = "https://res.cloudinary.com/wrsmile/image/upload/v1775821341/ChatGPT_Image_Apr_4_2026_03_28_27_PM_r3qaqz.png";

export const Stats: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'profit' | 'history' | 'archive' | 'statement' | 'returns'>('overview');
  const [bills, setBills] = useState<Bill[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summaries, setSummaries] = useState<MonthlySummary[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isClosing, setIsClosing] = useState(false);

  const [stats, setStats] = useState({
    todaySales: 0,
    todayProfit: 0,
    todayExpenses: 0,
    cashRevenue: 0,
    loanRevenue: 0,
    totalCogs: 0,
    totalProfit: 0,
    pendingLoans: 0,
    avgMargin: 0,
    inventoryAsset: 0,
    totalExpenses: 0,
    netTrueProfit: 0,
    totalReturnedValue: 0,
    totalReturnedProfit: 0,
    topCategory: 'N/A'
  });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const loadData = async () => {
    const [allBills, customers, allProducts, allExpenses, allSummaries, allReturns, businessSettings] = await Promise.all([
      db.bills.getAll(false),
      db.customers.getAll(),
      db.products.getAll(),
      db.expenses.getAll(),
      db.summaries.getAll(),
      db.returns.getAll(),
      db.settings.get()
    ]);

    setBills(allBills);
    setProducts(allProducts);
    setExpenses(allExpenses);
    setSummaries(allSummaries);
    setReturns(allReturns);
    setSettings(businessSettings);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Helper to safely parse numbers
    const safeNum = (val: any) => {
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    };

    // Filter Today's Data
    const todayBills = (allBills as Bill[]).filter((b: Bill) => {
      const bDate = new Date(b.date);
      return bDate >= startOfToday && bDate <= endOfToday;
    });

    const todayExpenses = (allExpenses as Expense[]).filter((e: Expense) => {
      const eDate = new Date(e.date);
      return eDate >= startOfToday && eDate <= endOfToday;
    }).reduce((sum: number, e: Expense) => sum + safeNum(e.amount), 0);

    const todayReturns = (allReturns as ReturnRecord[]).filter((r: ReturnRecord) => {
      const rDate = new Date(r.date);
      return rDate >= startOfToday && rDate <= endOfToday;
    });

    const todayReturnProfit = todayReturns.reduce((sum: number, r: ReturnRecord) => sum + safeNum(r.refundProfit), 0);
    const todayReturnValue = todayReturns.reduce((sum: number, r: ReturnRecord) => sum + safeNum(r.refundValue), 0);

    // Aggregates
    const totalPending = (customers as any[]).reduce((sum: number, c) => sum + safeNum(c.balanceDue), 0);
    const cashRev = (allBills as Bill[]).filter(b => b.paymentType === 'CASH').reduce((sum: number, b) => sum + safeNum(b.total), 0);
    const loanRev = (allBills as Bill[]).filter(b => b.paymentType === 'LOAN').reduce((sum: number, b) => sum + safeNum(b.total), 0);

    const totalCogs = (allBills as Bill[]).reduce((sum: number, b) => sum + safeNum(b.totalCost), 0);
    const grossProfit = (allBills as Bill[]).reduce((sum: number, b) => sum + safeNum(b.totalProfit), 0);
    const totalExpenses = (allExpenses as Expense[]).reduce((sum: number, e) => sum + safeNum(e.amount), 0);

    const totalReturnedVal = (allReturns as ReturnRecord[]).reduce((sum: number, r) => sum + safeNum(r.refundValue), 0);
    const totalReturnedProfit = (allReturns as ReturnRecord[]).reduce((sum: number, r) => sum + safeNum(r.refundProfit), 0);

    // Adjusted Financials (Subtracting Returns)
    const activeProfit = grossProfit - totalReturnedProfit;
    const netTrueProfit = activeProfit - totalExpenses;

    const totalRevenue = (cashRev + loanRev) || 1;
    const inventoryAsset = (allProducts as Product[]).reduce((sum: number, p) => sum + (safeNum(p.totalCost) * safeNum(p.stock)), 0);

    const catCounts: Record<string, number> = {};
    (allProducts as Product[]).forEach(p => { if (p.category) catCounts[p.category] = (catCounts[p.category] || 0) + 1; });
    const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    setStats({
      todaySales: (todayBills as Bill[]).reduce((sum: number, b) => sum + safeNum(b.total), 0) - todayReturnValue,
      todayProfit: (todayBills as Bill[]).reduce((sum: number, b) => sum + safeNum(b.totalProfit), 0) - todayReturnProfit,
      todayExpenses,
      cashRevenue: cashRev,
      loanRevenue: loanRev,
      totalCogs: totalCogs,
      totalProfit: activeProfit,
      totalExpenses: totalExpenses,
      netTrueProfit: netTrueProfit,
      pendingLoans: totalPending,
      avgMargin: (activeProfit / (totalRevenue - totalReturnedVal || 1)) * 100,
      inventoryAsset,
      totalReturnedValue: totalReturnedVal,
      totalReturnedProfit: totalReturnedProfit,
      topCategory: topCat
    });
    setLastUpdated(new Date().toLocaleTimeString());
  };

  const handlePrintDailyClose = () => {
    const printContainer = document.getElementById('print-container');
    if (!printContainer || !settings) return;

    const todayDate = new Date().toLocaleDateString();
    const todayTime = new Date().toLocaleTimeString();

    printContainer.innerHTML = `
      <div class="thermal-receipt" style="font-family: 'Inter', sans-serif; color: black; background: white;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${SHOP_LOGO}" style="width: 80px; height: 80px; border-radius: 12px; margin-bottom: 10px;">
          <h1 style="margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase;">DAILY X-REPORT</h1>
          <div style="font-size: 10px; margin-top: 4px; font-weight: 800;">${settings.businessName}</div>
          <div style="font-size: 9px; color: #555;">Filing Date: ${todayDate}</div>
          <div style="font-size: 9px; color: #555;">Batch Close: ${todayTime}</div>
        </div>

        <div style="border-top: 1.5px dashed black; padding-top: 10px; margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 5px;">
            <span>NET SALES (TODAY):</span>
            <span style="font-weight: 800;">LKR ${stats.todaySales.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 5px;">
            <span>OPERATING EXPENSES:</span>
            <span style="font-weight: 800; color: #e11d48;">- LKR ${stats.todayExpenses.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 900; margin-top: 8px; border-top: 1px solid black; padding-top: 8px;">
            <span>NET DAY POSITION:</span>
            <span>LKR ${(stats.todaySales - stats.todayExpenses).toLocaleString()}</span>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <p style="font-size: 9px; font-weight: 900; text-transform: uppercase; margin-bottom: 5px; border-bottom: 0.5px solid black; width: fit-content;">Performance Metrics</p>
          <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 3px;">
            <span>Estimated Profit (Net):</span>
            <span>LKR ${stats.todayProfit.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 10px;">
             <span>Outstanding Credit:</span>
             <span>LKR ${stats.pendingLoans.toLocaleString()}</span>
          </div>
        </div>

        <div style="text-align: center; font-size: 8px; border-top: 1px dashed black; padding-top: 15px; color: #666;">
          <p>This is a system-generated operational summary.</p>
          <p style="font-weight: 800; margin-top: 5px;">INTERNAL AUDIT USE ONLY</p>
          <p style="margin-top: 15px; letter-spacing: 2px;">WR POS INFRASTRUCTURE</p>
        </div>
      </div>
    `;

    setTimeout(() => {
      window.print();
      printContainer.innerHTML = '';
    }, 500);
  };

  const handleCloseMonth = async () => {
    if (!confirm("Close the current month?\n\nThis will archive all current bills and expenses to a Monthly Summary report and reset the active ledger for the new month.")) return;
    setIsClosing(true);
    try {
      const summary: MonthlySummary = {
        id: generateId(),
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        totalSales: activeRevenue,
        totalProfit: stats.totalProfit,
        totalExpenses: stats.totalExpenses,
        netProfit: stats.netTrueProfit,
        dateClosed: new Date().toISOString()
      };
      await db.summaries.add(summary);
      alert("Month Closed Successfully. Data archived.");
      loadData();
    } catch (e: unknown) {
      const error = e as Error;
      alert("Error closing month: " + error.message);
    } finally {
      setIsClosing(false);
    }
  };

  const activeRevenue = (stats.cashRevenue + stats.loanRevenue) - stats.totalReturnedValue;
  const netMarginPerc = activeRevenue > 0 ? (stats.netTrueProfit / activeRevenue) * 100 : 0;

  const chartData = bills.slice(0, 7).reverse().map(b => ({
    name: new Date(b.date).toLocaleDateString(undefined, { weekday: 'short' }),
    revenue: Number(b.total || 0),
    profit: Number(b.totalProfit || 0)
  }));

  const executiveCards = [
    {
      label: "Today's Sales (Net)",
      value: `LKR ${stats.todaySales.toLocaleString()}`,
      tone: 'text-blue-300',
      icon: Wallet,
      frame: 'border-blue-500/15'
    },
    {
      label: "Today's Profit",
      value: `LKR ${stats.todayProfit.toLocaleString()}`,
      tone: 'text-emerald-300',
      icon: TrendingUp,
      frame: 'border-emerald-500/15'
    },
    {
      label: "True Net Profit",
      value: `LKR ${stats.netTrueProfit.toLocaleString()}`,
      tone: 'text-indigo-200',
      icon: BadgePercent,
      frame: 'border-indigo-500/15'
    },
    {
      label: "Pending Loans",
      value: `LKR ${stats.pendingLoans.toLocaleString()}`,
      tone: 'text-yellow-300',
      icon: Layers3,
      frame: 'border-yellow-500/15'
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in relative print:p-0 h-full overflow-y-auto custom-scrollbar pr-2 pb-20">
      {/* Header Pulser */}
      <div className="p-1.5 liquid-shell bg-animate-gradient rounded-[2.6rem] overflow-hidden relative print:hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-emerald-500/10 animate-pulse pointer-events-none"></div>
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between px-6 md:px-8 xl:px-10 py-7 md:py-8 gap-6 relative z-10">
          <div className="flex items-center gap-5 min-w-0">
            <div className="w-14 h-14 rounded-[1.4rem] nav-liquid-active flex items-center justify-center text-white shrink-0">
              <Activity size={28} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.4em] mb-1">Fiscal Performance</p>
              <h2 className="text-2xl md:text-[2rem] font-black text-white uppercase tracking-tighter" style={{ fontFamily: 'var(--font-display)' }}>Treasury Terminal</h2>
              <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-2 mt-0.5">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live Sync: {lastUpdated}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 xl:flex gap-4 md:gap-6 w-full xl:w-auto">
            <div className="liquid-stat-chip text-center xl:text-right">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">Today's Revenue</p>
              <p className="text-2xl md:text-3xl font-black text-white font-mono tracking-tighter text-glow-premium">
                LKR {stats.todaySales.toLocaleString()}
              </p>
            </div>
            <div className="liquid-stat-chip text-center xl:text-right">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">True Net Margin</p>
              <p className={`text-2xl md:text-3xl font-black font-mono tracking-tighter text-glow-premium ${netMarginPerc > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {netMarginPerc.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Selection */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5 print:hidden">
        <div className="w-full xl:w-auto overflow-x-auto no-scrollbar">
        <div className="flex gap-2.5 liquid-shell p-2 rounded-[2rem] w-max">
          <button onClick={() => { audioService.playBeep(); setActiveTab('overview'); }} className={`flex items-center gap-3 px-6 md:px-8 py-3.5 premium-chip tap-lift text-[10px] font-black uppercase tracking-[0.24em] transition-all ${activeTab === 'overview' ? 'nav-liquid-active' : 'nav-liquid-idle'}`}><Target size={14} /> Executive</button>
          <button onClick={() => { audioService.playBeep(); setActiveTab('statement'); }} className={`flex items-center gap-3 px-6 md:px-8 py-3.5 premium-chip tap-lift text-[10px] font-black uppercase tracking-[0.24em] transition-all ${activeTab === 'statement' ? 'nav-liquid-active' : 'nav-liquid-idle'}`}><FileBarChart size={14} /> Statement</button>
          <button onClick={() => { audioService.playBeep(); setActiveTab('history'); }} className={`flex items-center gap-3 px-6 md:px-8 py-3.5 premium-chip tap-lift text-[10px] font-black uppercase tracking-[0.24em] transition-all ${activeTab === 'history' ? 'nav-liquid-active' : 'nav-liquid-idle'}`}><ListFilter size={14} /> Audit</button>
          <button onClick={() => { audioService.playBeep(); setActiveTab('returns'); }} className={`flex items-center gap-3 px-6 md:px-8 py-3.5 premium-chip tap-lift text-[10px] font-black uppercase tracking-[0.24em] transition-all ${activeTab === 'returns' ? 'nav-liquid-active' : 'nav-liquid-idle'}`}><RotateCcw size={14} /> Returns</button>
          <button onClick={() => { audioService.playBeep(); setActiveTab('archive'); }} className={`flex items-center gap-3 px-6 md:px-8 py-3.5 premium-chip tap-lift text-[10px] font-black uppercase tracking-[0.24em] transition-all ${activeTab === 'archive' ? 'nav-liquid-active' : 'nav-liquid-idle'}`}><Archive size={14} /> Vault</button>
        </div>
        </div>

        <div className="flex flex-wrap gap-3 w-full xl:w-auto">
          <button onClick={handlePrintDailyClose} className="flex items-center gap-3 px-6 md:px-8 py-3.5 premium-button tap-lift liquid-shell text-[10px] font-black text-blue-300 uppercase tracking-[0.24em] hover:text-white transition-all">
            <Printer size={16} /> X-Report
          </button>
          <button
            onClick={handleCloseMonth}
            disabled={isClosing}
            className="flex items-center gap-4 px-6 md:px-8 py-3.5 premium-button tap-lift bg-red-600/10 border border-red-500/20 text-[10px] font-black text-red-500 uppercase tracking-[0.24em] hover:bg-red-600 hover:text-white transition-all shadow-xl shadow-red-600/10"
          >
            {isClosing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Finalize Month
          </button>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-fade-in print:hidden">

          <AIAdvisor
            mode="EXECUTIVE"
            contextData={`
              Revenue Today: LKR ${stats.todaySales}
              Total Net Profit (True): LKR ${stats.netTrueProfit}
              Pending Credit (Loans): LKR ${stats.pendingLoans}
              Inventory Valuation: LKR ${stats.inventoryAsset}
              Top Performing Category: ${stats.topCategory}
              Total OpEx: LKR ${stats.totalExpenses}
              Expense Ratio: ${((stats.totalExpenses / (stats.cashRevenue + stats.loanRevenue || 1)) * 100).toFixed(1)}%
            `}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-5">
            {executiveCards.map(({ label, value, tone, icon: Icon, frame }) => (
              <GlassCard key={label} className={`group border ${frame} overflow-hidden tap-lift`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-2">{label}</p>
                    <h3 className={`text-xl xl:text-2xl font-black font-mono ${tone}`}>{value}</h3>
                  </div>
                    <div className="w-12 h-12 rounded-[1.1rem] border border-white/10 bg-white/5 flex items-center justify-center shrink-0 shadow-[0_16px_28px_rgba(2,6,23,0.16)]">
                    <Icon size={18} className={tone} />
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.8fr)] gap-5">
            <div className="space-y-5">
              <GlassCard className="h-96 liquid-section-shell">
                <h4 className="text-xs font-black text-white uppercase tracking-widest mb-6">Recent Sales Trajectory</h4>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `LKR ${v / 1000}k`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '12px', fontSize: '10px' }}
                        itemStyle={{ color: '#fff', fontWeight: '900' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" animationDuration={1500} />
                      <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={0} animationDuration={2000} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            </div>

            <div className="space-y-5">
              <GlassCard className="border-emerald-500/10 liquid-section-shell">
                <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-6">Top Product Yields</h4>
                <div className="space-y-4">
                  {products.sort((a, b) => (b.marginValue) - (a.marginValue)).slice(0, 4).map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 tap-lift">
                      <div>
                        <p className="text-[10px] font-black text-white uppercase truncate max-w-[120px]">{p.name}</p>
                        <p className="text-[8px] text-gray-500 font-bold uppercase">{p.category}</p>
                      </div>
                      <p className="text-xs font-black text-emerald-400 font-mono">+{p.marginValue}%</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'returns' && (
        <div className="animate-fade-in space-y-6 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <GlassCard className="border-orange-500/10">
              <p className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-1">Total Refund Value</p>
              <h3 className="text-xl font-black text-orange-400 font-mono">LKR {stats.totalReturnedValue.toLocaleString()}</h3>
            </GlassCard>
            <GlassCard className="border-orange-500/10">
              <p className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-1">Total Returns Count</p>
              <h3 className="text-xl font-black text-white font-mono">{returns.length} Instances</h3>
            </GlassCard>
            <GlassCard className="border-orange-500/10">
              <p className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-1">Total Refund Profit (Loss)</p>
              <h3 className="text-xl font-black text-red-400 font-mono">LKR {stats.totalReturnedProfit.toLocaleString()}</h3>
            </GlassCard>
          </div>

          <GlassCard className="bg-[#0b1121]/40 border-white/5">
            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6">Reversal Audit Ledger</h3>
            <div className="overflow-y-auto max-h-[600px] pr-2 custom-scrollbar space-y-2">
              {returns.map(r => (
                <div key={r.id} className="p-5 rounded-3xl border border-white/5 bg-black/20 flex flex-col md:flex-row justify-between items-center gap-4 group hover:bg-white/5 transition-all">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-orange-600/10 text-orange-500 rounded-2xl flex items-center justify-center border border-orange-500/10">
                      <RotateCcw size={20} />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-white uppercase">{r.productName || 'Line Item'}</p>
                      <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">Qty: {r.quantity} - Inv: #{r.billId.slice(-6)} - {new Date(r.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-[8px] font-black text-gray-700 uppercase">Customer</p>
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-tight">{r.customerName || 'Cash Sale'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-gray-700 uppercase">Refund Value</p>
                      <p className="text-sm font-black text-orange-400 font-mono">LKR {Number(r.refundValue || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
              {returns.length === 0 && (
                <div className="py-20 text-center opacity-20 flex flex-col items-center">
                  <RotateCcw size={48} className="mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em]">No Reversals Recorded</p>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};
