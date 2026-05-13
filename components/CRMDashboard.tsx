import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, Users, TrendingUp, AlertCircle, MessageCircle, Target,
  Phone, Mail, MapPin, DollarSign, Zap, BarChart, Filter, Plus,
  Heart, TrendingDown, Send, Clock, Star, Award, Truck, Settings, Loader2, RotateCw
} from 'lucide-react';
import { GlassCard } from './ui/GlassCard';
import { GlassInput } from './ui/GlassInput';
import { db } from '../services/mockDb';
import { Customer, Supplier } from '../types';

interface CRMDashboardProps {
  customers?: Customer[];
  suppliers?: Supplier[];
}

export const CRMDashboard: React.FC<CRMDashboardProps> = ({
  customers: propCustomers = [],
  suppliers: propSuppliers = []
}) => {
  const [internalCustomers, setInternalCustomers] = useState<Customer[]>([]);
  const [internalSuppliers, setInternalSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'customers' | 'suppliers'>('customers');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [c, s] = await Promise.all([
          db.customers.getAll(),
          db.suppliers.getAll()
        ]);
        
        const enrichedC = (c || []).map((cust: Customer) => {
          const total = (cust.totalPaid || 0) + (cust.balanceDue || 0);
          return {
            ...cust,
            totalPurchases: total,
            balance: cust.balanceDue || 0,
            segment: (cust.balanceDue || 0) > 50000 ? 'at-risk' : (cust.totalPaid || 0) > 100000 ? 'vip' : 'regular',
            healthScore: Math.max(0, Math.min(100, Math.round(((cust.totalPaid || 0) / (total || 1)) * 100))),
            customerScore: Math.min(100, Math.round(((cust.totalPaid || 0) / 5000))),
            riskLevel: (cust.balanceDue || 0) > 50000 ? 'high' : 'low'
          } as any;
        });

        const enrichedS = (s || []).map((sup: Supplier) => ({
          ...sup,
          status: 'active',
          overallRating: 4.5,
          totalOrders: 0
        }) as any);

        setInternalCustomers(enrichedC);
        setInternalSuppliers(enrichedS);
      } catch (err) {
        console.error("CRM Load failed:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const customers = internalCustomers.length > 0 ? internalCustomers : propCustomers;
  const suppliers = internalSuppliers.length > 0 ? internalSuppliers : propSuppliers;

  const filteredCustomers = useMemo(() => {
    return (customers as any[]).filter(c => {
      const name = (c.name || '').toLowerCase();
      const phone = c.phone || '';
      const matchesSearch = name.includes(searchTerm.toLowerCase()) || phone.includes(searchTerm);
      const matchesSegment = !selectedSegment || c.segment === selectedSegment;
      return matchesSearch && matchesSegment;
    }).sort((a, b) => (b.customerScore || 0) - (a.customerScore || 0));
  }, [customers, searchTerm, selectedSegment]);

  const filteredSuppliers = useMemo(() => {
    return (suppliers as any[]).filter(s => {
      const name = (s.name || '').toLowerCase();
      const phone = s.phone || '';
      return name.includes(searchTerm.toLowerCase()) || phone.includes(searchTerm);
    }).sort((a, b) => (b.overallRating || 0) - (a.overallRating || 0));
  }, [suppliers, searchTerm]);

  const analytics = useMemo(() => {
    const totalRev = (customers || []).reduce((sum: number, c: any) => sum + (c.totalPurchases || 0), 0);
    const avgVal = (customers || []).length > 0 ? totalRev / customers.length : 0;
    const vCount = (customers || []).filter((c: any) => c.segment === 'vip').length;
    const rCount = (customers || []).filter((c: any) => c.segment === 'at-risk').length;
    return { totalRevenue: totalRev, avgCustomerValue: avgVal, vipCount: vCount, atRiskCount: rCount };
  }, [customers]);

  const getSegmentColor = (segment: string) => {
    const colors: Record<string, string> = {
      vip: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
      premium: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
      regular: 'bg-green-500/20 border-green-500/30 text-green-400',
      'at-risk': 'bg-red-500/20 border-red-500/30 text-red-400'
    };
    return colors[segment] || colors.regular;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 size={48} className="text-blue-500 animate-spin" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading Hub...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-6 text-center">
            <Users className="text-blue-500/30 mx-auto mb-2" size={32} />
            <p className="text-gray-400 text-[9px] font-bold uppercase">Total Clients</p>
            <p className="text-2xl font-black text-white">{customers.length}</p>
        </GlassCard>
        <GlassCard className="p-6 text-center">
            <TrendingUp className="text-green-500/30 mx-auto mb-2" size={32} />
            <p className="text-gray-400 text-[9px] font-bold uppercase">Total Revenue</p>
            <p className="text-2xl font-black text-white">LKR {(analytics.totalRevenue / 1000).toFixed(0)}K</p>
        </GlassCard>
        <GlassCard className="p-6 text-center">
            <Award className="text-purple-500/30 mx-auto mb-2" size={32} />
            <p className="text-gray-400 text-[9px] font-bold uppercase">VIP Segment</p>
            <p className="text-2xl font-black text-white">{analytics.vipCount}</p>
        </GlassCard>
        <GlassCard className="p-6 text-center">
            <AlertCircle className="text-red-500/30 mx-auto mb-2" size={32} />
            <p className="text-gray-400 text-[9px] font-bold uppercase">At-Risk</p>
            <p className="text-2xl font-black text-white">{analytics.atRiskCount}</p>
        </GlassCard>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-sm font-black text-white uppercase tracking-[0.4em]">Business Intelligence Hub</h2>
        <div className="flex gap-2">
            <button 
                onClick={() => window.location.reload()} 
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border border-white/10 transition-all"
            >
                <RotateCw size={14} /> Full Refresh
            </button>
            <button onClick={() => setView('customers')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'customers' ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400 border border-white/5'}`}>Clients</button>
            <button onClick={() => setView('suppliers')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'suppliers' ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400 border border-white/5'}`}>Vendors</button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
        <GlassInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search manifest..."
            className="pl-12 w-full"
        />
      </div>

      {view === 'customers' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
            {filteredCustomers.map(customer => (
              <GlassCard
                key={customer.id || Math.random()}
                onClick={() => setSelectedCustomer(customer)}
                className={`p-4 cursor-pointer border transition-all ${selectedCustomer?.id === customer.id ? 'bg-blue-500/10 border-blue-500/30' : 'border-white/5 hover:bg-white/5'}`}
              >
                <p className="font-black text-white uppercase text-xs">{customer.name || 'Anonymous'}</p>
                <p className="text-[9px] text-gray-500 font-mono mt-1">{customer.phone}</p>
              </GlassCard>
            ))}
          </div>
          <div className="lg:col-span-2">
            {selectedCustomer ? (
              <GlassCard className="p-8 h-full bg-blue-500/5">
                <h2 className="text-2xl font-black text-white uppercase mb-4">{selectedCustomer.name}</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl">
                    <p className="text-[8px] font-black text-gray-500 uppercase">Balance Due</p>
                    <p className="text-xl font-black text-red-400">LKR {(selectedCustomer.balance || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl">
                    <p className="text-[8px] font-black text-gray-500 uppercase">Total Spent</p>
                    <p className="text-xl font-black text-emerald-400">LKR {(selectedCustomer.totalPaid || 0).toLocaleString()}</p>
                  </div>
                </div>
              </GlassCard>
            ) : (
                <div className="h-48 flex items-center justify-center border border-dashed border-white/10 rounded-2xl text-slate-500 font-bold uppercase text-[10px]">Select a client to view profile</div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSuppliers.map((supplier: any) => (
            <GlassCard key={supplier.id} className="p-4 border-white/5">
              <p className="font-black text-white uppercase text-xs">{supplier.name}</p>
              <p className="text-[9px] text-slate-500 mt-1 uppercase font-bold">Rating: {supplier.overallRating}/5</p>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
};

export default CRMDashboard;
