
import {
  ArrowLeft, Edit, Edit2, Loader2, Search, Trash2, X,
  ArrowUpRight, ArrowDownWideNarrow, RotateCcw, UserPlus, History,
  Banknote, Receipt, Check, Calendar, TrendingDown, TrendingUp,
  BrainCircuit
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { db, generateId } from '../services/mockDb';
import { cleanPhone } from '../services/utils';
import { Bill, Customer, Payment, ReturnRecord } from '../types';
import { GlassCard } from './ui/GlassCard';
import { GlassInput } from './ui/GlassInput';
import { AIAdvisor } from './AIAdvisor';

type TimelineEntry =
  | (Bill & { type: 'BILL' })
  | (Payment & { type: 'PAYMENT' })
  | (ReturnRecord & { type: 'RETURN' });

export const CustomerManager: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<TimelineEntry[]>([]);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  const [paymentFormData, setPaymentFormData] = useState({ amount: 0, note: '' });
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [oldPaymentAmount, setOldPaymentAmount] = useState<number>(0);

  const [customerForm, setCustomerForm] = useState<Partial<Customer>>({ name: '', phone: '', address: '', nic: '', language: 'en' });

  useEffect(() => { loadCustomers(); }, []);

  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerHistory(selectedCustomer.id);
    }
  }, [selectedCustomer]);

  const loadCustomers = async () => setCustomers(await db.customers.getAll());

  const loadCustomerHistory = async (customerId: string) => {
    const [customerBills, allPayments, allReturns] = await Promise.all([
      db.bills.getAllForCustomer(customerId),
      db.payments.getByCustomerId(customerId),
      db.returns.getAll()
    ]);

    const customerReturns = allReturns.filter(r => String(r.customerId) === String(customerId));

    const combined: TimelineEntry[] = [
      ...customerBills.map(b => ({ ...b, type: 'BILL' as const })),
      ...allPayments.map(p => ({ ...p, type: 'PAYMENT' as const })),
      ...customerReturns.map(r => ({ ...r, type: 'RETURN' as const }))
    ];

    combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTransactions(combined);
  };

  const getCustomerContext = () => {
    const totalDebt = customers.reduce((sum, c) => sum + c.balanceDue, 0);
    const riskyCount = customers.filter(c => c.balanceDue > 10000).length;
    return `
      Total Registered Clients: ${customers.length}
      Total Outstanding Debt: LKR ${totalDebt}
      High Risk Clients (>10k Debt): ${riskyCount}
      Total Collected: LKR ${customers.reduce((sum, c) => sum + c.totalPaid, 0)}
    `;
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForm.name || !customerForm.phone) return;
    setIsSaving(true);

    const cleanedPhone = cleanPhone(customerForm.phone || '');
    const data: Customer = {
      ...customerForm as Customer,
      phone: cleanedPhone,
      balanceDue: customerForm.balanceDue || 0,
      totalLoan: customerForm.totalLoan || 0,
      totalPaid: customerForm.totalPaid || 0
    };

    try {
      if (isEditing && customerForm.id) {
        await db.customers.update(data);
      } else {
        await db.customers.add(data);
      }

      const all = await db.customers.getAll();
      setCustomers(all);

      if (selectedCustomer && isEditing) {
        const updated = all.find(c => String(c.id) === String(selectedCustomer.id));
        if (updated) setSelectedCustomer(updated);
      }

      setIsCustomerModalOpen(false);
      setCustomerForm({ name: '', phone: '', address: '', nic: '', language: 'en' });
      setIsEditing(false);
    } catch (err: any) {
      alert(`System failed to save customer profile: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustomerProfile = async () => {
    if (!selectedCustomer) return;

    if (selectedCustomer.balanceDue > 0) {
      if (!confirm(`WARNING: Customer has outstanding debt of LKR ${selectedCustomer.balanceDue.toLocaleString()}.\n\nDeleting will leave this debt unrecoverable in the system. Proceed?`)) return;
    } else {
      if (!confirm("Permanently remove this customer record?")) return;
    }

    try {
      await db.customers.delete(selectedCustomer.id);
      setSelectedCustomer(null);
      await loadCustomers();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || paymentFormData.amount < 0) return;
    setIsSaving(true);
    try {
      if (editingPaymentId) {
        await db.payments.update(editingPaymentId, selectedCustomer.id, oldPaymentAmount, paymentFormData.amount, paymentFormData.note);
      } else {
        await db.payments.add({
          customerId: selectedCustomer.id,
          amount: paymentFormData.amount,
          note: paymentFormData.note
        });
      }

      setIsPaymentModalOpen(false);
      setPaymentFormData({ amount: 0, note: '' });
      setEditingPaymentId(null);

      const all = await db.customers.getAll();
      setCustomers(all);
      const updated = all.find(c => String(c.id) === String(selectedCustomer.id));
      if (updated) setSelectedCustomer(updated);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePayment = async (id: string, amount: number) => {
    if (!selectedCustomer) return;
    if (!confirm(`Permanently revoke this settlement record? LKR ${amount.toLocaleString()} will be added back to customer debt.`)) return;

    setIsSaving(true);
    try {
      await db.payments.delete(id, selectedCustomer.id, amount);
      const all = await db.customers.getAll();
      setCustomers(all);
      const updated = all.find(c => String(c.id) === String(selectedCustomer.id));
      if (updated) setSelectedCustomer(updated);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openEditPayment = (p: Payment) => {
    setEditingPaymentId(p.id);
    setOldPaymentAmount(p.amount);
    setPaymentFormData({ amount: p.amount, note: p.note });
    setIsPaymentModalOpen(true);
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm)
  );

  if (selectedCustomer) {
    return (
      <div className="animate-in fade-in duration-500 space-y-4 flex flex-col">
        <div className="flex justify-between items-center shrink-0">
          <button onClick={() => setSelectedCustomer(null)} className="flex items-center gap-2 text-gray-500 hover:text-white transition-all">
            <ArrowLeft size={14} />
            <span className="font-black uppercase text-[9px]">Back to Ledger</span>
          </button>
          <div className="flex gap-2">
            <button onClick={handleDeleteCustomerProfile} className="px-4 py-2 bg-red-600/10 border border-red-500/20 text-red-500 rounded-xl text-[9px] font-black uppercase hover:bg-red-600 hover:text-white transition-all flex items-center gap-2" title="Delete Profile">
              <Trash2 size={14} />
            </button>
            <button onClick={() => { setCustomerForm({ ...selectedCustomer }); setIsEditing(true); setIsCustomerModalOpen(true); }} className="px-5 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-[9px] font-black uppercase hover:bg-white/10 transition-all flex items-center gap-2"><Edit size={14} /> Edit Profile</button>
            <button onClick={() => { setEditingPaymentId(null); setPaymentFormData({ amount: 0, note: '' }); setIsPaymentModalOpen(true); }} className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg hover:bg-emerald-500 transition-all">Collect Payment</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
          <div className="lg:col-span-4">
            <GlassCard className="h-full bg-[#0b1121]/90 p-6 rounded-[2rem] flex flex-col">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-3 flex items-center justify-center text-xl font-black text-white shadow-xl shadow-blue-600/20">{selectedCustomer.name.charAt(0)}</div>
                <h2 className="text-[12px] font-black text-white uppercase tracking-tight">{selectedCustomer.name}</h2>
                <p className="text-[9px] text-gray-500 font-bold font-mono tracking-widest mt-0.5">{selectedCustomer.phone}</p>
              </div>
              <div className="space-y-3 mb-5 flex-1 overflow-y-auto custom-scrollbar pr-1">
                <div className="p-4 bg-black/40 rounded-xl border border-red-500/10 flex justify-between items-center group">
                  <div>
                    <span className="text-[8px] uppercase font-black text-gray-600 block">Total Unpaid</span>
                    <span className="text-sm font-black font-mono text-red-400">LKR {selectedCustomer.balanceDue.toLocaleString()}</span>
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm("Recalculate this customer's balance based on full transaction history?")) {
                        try {
                          await db.customers.recalculateBalance(selectedCustomer.id);
                          await loadCustomers();
                          const all = await db.customers.getAll();
                          const updated = all.find(c => String(c.id) === String(selectedCustomer.id));
                          if (updated) setSelectedCustomer(updated);
                          alert("Balance Recalculated & Synced.");
                        } catch (e: any) { alert(e.message); }
                      }
                    }}
                    className="p-2 bg-white/5 text-gray-500 hover:text-white rounded-lg border border-white/5 hover:border-white/20 opacity-0 group-hover:opacity-100 transition-all"
                    title="Recalculate Balance (Audit)"
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>
                <div className="p-4 bg-black/40 rounded-xl border border-emerald-500/10 flex justify-between items-center">
                  <span className="text-[8px] uppercase font-black text-gray-600">Total Settled</span>
                  <span className="text-sm font-black font-mono text-emerald-400">LKR {selectedCustomer.totalPaid.toLocaleString()}</span>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[7px] font-black text-gray-700 uppercase mb-1">NIC Identification</p>
                  <p className="text-[10px] text-gray-300 font-bold uppercase">{selectedCustomer.nic || 'Not Verified'}</p>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[7px] font-black text-gray-700 uppercase mb-1">Permanent Address</p>
                  <p className="text-[10px] text-gray-300 font-bold uppercase leading-tight">{selectedCustomer.address || 'No Address Data'}</p>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[7px] font-black text-gray-700 uppercase mb-1">Preferred Language</p>
                  <p className="text-[10px] text-blue-400 font-bold uppercase">{selectedCustomer.language === 'ta' ? 'Tamil' : (selectedCustomer.language === 'si' ? 'Sinhala' : 'English')}</p>
                </div>
              </div>
            </GlassCard>
          </div>

          <div className="lg:col-span-8 flex flex-col">
            <GlassCard className="bg-[#0b1121]/40 flex flex-col p-6 rounded-[2rem] border-white/5">
              <div className="flex items-center gap-3 mb-6 shrink-0">
                <History size={18} className="text-blue-500" />
                <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Transaction Manifest</h3>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {transactions.map((t, idx) => (
                  <div key={idx} className="p-5 rounded-3xl bg-black/40 border border-white/5 flex items-center justify-between group hover:border-white/20 transition-all">
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner ${t.type === 'BILL' ? 'bg-red-500/10 text-red-400 border-red-500/10' :
                        t.type === 'PAYMENT' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10' :
                          'bg-orange-500/10 text-orange-400 border-orange-500/10'
                        }`}>
                        {t.type === 'BILL' ? <Receipt size={20} /> : t.type === 'PAYMENT' ? <Banknote size={20} /> : <RotateCcw size={20} />}
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-white uppercase">
                          {t.type === 'BILL' ? `Invoice #${t.invoiceNumber}` : t.type === 'PAYMENT' ? 'Credit Settlement' : 'Stock Reversal'}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[8px] text-gray-700 font-black uppercase tracking-widest flex items-center gap-1">
                            <Calendar size={10} /> {new Date(t.date).toLocaleDateString()}
                          </span>
                          {t.type === 'PAYMENT' && t.note && <span className="text-[8px] text-blue-500 font-bold italic truncate max-w-[150px]">{t.note}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className={`text-sm font-black font-mono ${t.type === 'BILL' ? 'text-red-400' :
                          t.type === 'PAYMENT' ? 'text-emerald-400' : 'text-orange-400'
                          }`}>
                          {t.type === 'BILL' ? '+' : '-'} LKR {(t.type === 'BILL' ? t.total : t.type === 'PAYMENT' ? t.amount : t.refundValue).toLocaleString()}
                        </p>
                        <span className="text-[8px] font-black text-gray-700 uppercase tracking-tighter">
                          {t.type === 'BILL' ? 'Pending Balance' : 'Treasury Credit'}
                        </span>
                      </div>

                      {t.type === 'PAYMENT' && (
                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => openEditPayment(t)} className="p-2 bg-white/5 text-blue-400 rounded-lg border border-white/10 hover:bg-blue-600 hover:text-white"><Edit2 size={14} /></button>
                          <button onClick={() => handleDeletePayment(t.id, t.amount)} className="p-2 bg-white/5 text-red-500/40 rounded-lg border border-white/10 hover:text-red-500"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {transactions.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center opacity-10 py-40">
                    <History size={60} />
                    <p className="text-[9px] font-black uppercase tracking-[0.4em] mt-4">Zero Activity Data</p>
                  </div>
                )}
              </div>
            </GlassCard>
          </div>
        </div>

        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4">
            <GlassCard className="w-full max-w-md bg-[#0b1121] p-10 rounded-[3rem] border-2 border-white/10 shadow-3xl animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
                  <Banknote className="text-emerald-500" /> {editingPaymentId ? 'Revise Settlement' : 'Collect Payment'}
                </h3>
                <button onClick={() => { setIsPaymentModalOpen(false); setEditingPaymentId(null); }} className="p-3 text-gray-500 hover:text-white"><X size={20} /></button>
              </div>
              <form onSubmit={handleCollectPayment} className="space-y-6">
                {!editingPaymentId && (
                  <div className="p-4 bg-red-600/5 border border-red-500/10 rounded-2xl flex justify-between items-center mb-4">
                    <span className="text-[9px] font-black text-gray-600 uppercase">Max Collection</span>
                    <span className="text-sm font-black text-red-400 font-mono">LKR {selectedCustomer.balanceDue.toLocaleString()}</span>
                  </div>
                )}
                <GlassInput label="Amount to Settle (LKR)" type="number" value={paymentFormData.amount || ''} onChange={e => setPaymentFormData({ ...paymentFormData, amount: Number(e.target.value) })} required />
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Settlement Note</label>
                  <textarea className="glass-input rounded-2xl px-5 py-4 text-xs outline-none min-h-[100px]" value={paymentFormData.note} onChange={e => setPaymentFormData({ ...paymentFormData, note: e.target.value })} placeholder="E.g. Cash payment received in shop..." />
                </div>
                <button type="submit" disabled={isSaving} className={`w-full py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] shadow-xl ${editingPaymentId ? 'bg-blue-600' : 'bg-emerald-600'} text-white`}>
                  {isSaving ? <Loader2 className="animate-spin mx-auto" /> : editingPaymentId ? 'COMMIT CORRECTION' : 'AUTHORIZE SETTLEMENT'}
                </button>
              </form>
            </GlassCard>
          </div>
        )}

        {isCustomerModalOpen && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
            <GlassCard className="w-full max-w-sm bg-[#0b1121] border border-white/10 p-6 rounded-[2rem] animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-black text-white uppercase tracking-widest">{isEditing ? 'Modify Profile' : 'Register Client'}</h3>
                <button onClick={() => { setIsCustomerModalOpen(false); setIsEditing(false); }} className="p-2 text-gray-500 hover:text-white bg-white/5 rounded-full"><X size={14} /></button>
              </div>
              <form onSubmit={handleSaveCustomer} className="space-y-4">
                <GlassInput label="Full Name" className="text-xs" value={customerForm.name || ''} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })} required />
                <GlassInput label="Phone" className="text-xs" value={customerForm.phone || ''} placeholder="077..." onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} required />
                <GlassInput label="NIC (Opt)" className="text-xs" value={customerForm.nic || ''} onChange={e => setCustomerForm({ ...customerForm, nic: e.target.value })} />
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Address</label>
                  <textarea className="glass-input rounded-xl px-3 py-2 text-xs outline-none min-h-[60px]" value={customerForm.address || ''} onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Preferred Language</label>
                  <select
                    className="glass-input rounded-xl px-3 py-2 text-xs outline-none bg-slate-900 border border-white/10 text-white"
                    value={customerForm.language || 'en'}
                    onChange={e => setCustomerForm({ ...customerForm, language: e.target.value as any })}
                  >
                    <option value="en">English (default)</option>
                    <option value="ta">Tamil (தமிழ்)</option>
                    <option value="si">Sinhala (සිංහල)</option>
                  </select>
                </div>
                <button type="submit" disabled={isSaving} className="w-full py-3 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-500 transition-all mt-2">
                  {isSaving ? <Loader2 className="animate-spin mx-auto" size={14} /> : isEditing ? 'Update Profile' : 'Confirm'}
                </button>
              </form>
            </GlassCard>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 flex flex-col relative">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 px-2">
        <div className="flex items-center gap-4">
          <h3 className="text-[11px] font-black text-white tracking-widest uppercase">Client Ledger</h3>
          <button onClick={() => { setIsEditing(false); setCustomerForm({ name: '', phone: '', address: '', nic: '' }); setIsCustomerModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-lg text-[9px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all">
            <UserPlus size={14} /> Register Client
          </button>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700" size={14} />
            <input placeholder="SEARCH LEDGER..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-[9px] font-black text-white outline-none focus:border-blue-500 transition-all uppercase tracking-widest" />
          </div>
          <button onClick={() => setShowAiModal(true)} className="p-2 bg-purple-600/10 text-purple-500 border border-purple-500/20 rounded-xl hover:bg-purple-600 hover:text-white transition-all shadow-lg">
            <BrainCircuit size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar h-full pr-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pb-8">
          {filteredCustomers.map(customer => (
            <div key={customer.id} className="p-5 rounded-[2rem] bg-white/5 border border-white/5 hover:border-blue-500/40 transition-all group flex flex-col relative overflow-hidden">
              <div className="flex gap-4 items-center mb-4 cursor-pointer" onClick={() => setSelectedCustomer(customer)}>
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center font-black text-blue-500 text-sm uppercase border border-white/5 shadow-inner">{customer.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-white text-[12px] uppercase truncate tracking-tight">{customer.name}</h4>
                  <p className="text-[8px] text-gray-600 font-bold uppercase">{customer.phone}</p>
                </div>
              </div>
              <div className="flex justify-between items-center border-t border-white/5 pt-3 mt-auto cursor-pointer" onClick={() => setSelectedCustomer(customer)}>
                <span className="text-[9px] text-gray-700 font-black uppercase">Unpaid</span>
                <span className={`font-black font-mono text-[11px] ${customer.balanceDue > 0 ? 'text-red-400' : 'text-emerald-400'}`}>LKR {(customer.balanceDue).toLocaleString()}</span>
              </div>
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); setCustomerForm({ ...customer }); setIsEditing(true); setIsCustomerModalOpen(true); }} className="p-2 bg-white/5 text-gray-500 hover:text-blue-400 rounded-xl border border-white/5"><Edit2 size={12} /></button>
                <button onClick={(e) => { e.stopPropagation(); if (confirm("Delete customer profile?")) db.customers.delete(customer.id).then(loadCustomers); }} className="p-2 bg-white/5 text-gray-500 hover:text-red-500 rounded-xl border border-white/5"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
        {filteredCustomers.length === 0 && (
          <div className="py-40 text-center opacity-10">
            <Search size={80} className="mx-auto" />
            <p className="text-sm font-black uppercase tracking-[0.5em] mt-4">Zero Matches Found</p>
          </div>
        )}
      </div>

      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
          <GlassCard className="w-full max-w-sm bg-[#0b1121] border border-white/10 p-6 rounded-[2rem] animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-black text-white uppercase tracking-widest">{isEditing ? 'Modify Profile' : 'Register Client'}</h3>
              <button onClick={() => { setIsCustomerModalOpen(false); setIsEditing(false); }} className="p-2 text-gray-500 hover:text-white bg-white/5 rounded-full"><X size={14} /></button>
            </div>
            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <GlassInput label="Full Name" className="text-xs" value={customerForm.name || ''} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })} required />
              <GlassInput label="Phone" className="text-xs" value={customerForm.phone || ''} placeholder="077..." onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} required />
              <GlassInput label="NIC (Opt)" className="text-xs" value={customerForm.nic || ''} onChange={e => setCustomerForm({ ...customerForm, nic: e.target.value })} />
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Address</label>
                <textarea className="glass-input rounded-xl px-3 py-2 text-xs outline-none min-h-[60px]" value={customerForm.address || ''} onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })} />
              </div>
              <button type="submit" disabled={isSaving} className="w-full py-3 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-500 transition-all mt-2">
                {isSaving ? <Loader2 className="animate-spin mx-auto" size={14} /> : isEditing ? 'Update Profile' : 'Confirm'}
              </button>
            </form>
          </GlassCard>
        </div>
      )}

      {showAiModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-4">
          <div className="w-full max-w-2xl animate-in zoom-in-95 duration-300">
            <AIAdvisor mode="CUSTOMER" contextData={getCustomerContext()} onClose={() => setShowAiModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
};
