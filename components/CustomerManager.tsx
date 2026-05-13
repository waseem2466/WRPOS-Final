
import {
  ArrowLeft, Edit, Edit2, Loader2, Search, Trash2, X,
  ArrowUpRight, ArrowDownWideNarrow, RotateCcw, UserPlus, History,
  Banknote, Receipt, Check, Calendar, TrendingDown, TrendingUp,
  BrainCircuit, Send, AlertCircle
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { db, generateId } from '../services/mockDb';
import { cleanPhone } from '../services/utils';
import { Bill, Customer, Payment, ReturnRecord } from '../types';
import { GlassCard } from './ui/GlassCard';
import { GlassInput } from './ui/GlassInput';
import { AIAdvisor } from './AIAdvisor';
import { autoSendWhatsAppBill } from '../services/whatsappAutoSend';
import { whatsappService } from '../services/whatsapp';

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
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showLoanCorrectionModal, setShowLoanCorrectionModal] = useState(false);
  const [isWASending, setIsWASending] = useState(false);
  const [loanItems, setLoanItems] = useState<Bill[]>([]);

  const [paymentFormData, setPaymentFormData] = useState({ amount: 0, note: '' });
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [oldPaymentAmount, setOldPaymentAmount] = useState<number>(0);
  const [loanCorrectionForm, setLoanCorrectionForm] = useState({ totalLoan: 0, totalPaid: 0, balanceDue: 0 });

  const [customerForm, setCustomerForm] = useState<Partial<Customer>>({ name: '', phone: '', address: '', nic: '', language: 'en' });

  useEffect(() => { loadCustomers(); }, []);

  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerHistory(selectedCustomer.id);
    }
  }, [selectedCustomer]);

  const loadCustomers = async () => setCustomers(await db.customers.getAll());

  const refreshSelectedCustomer = async (customerId: string) => {
    const all = await db.customers.getAll();
    setCustomers(all);
    const updated = all.find((c: Customer) => String(c.id) === String(customerId));
    if (updated) {
      setSelectedCustomer(updated);
      await loadCustomerHistory(updated.id);
      if (showLoanModal) await showLoanItems(updated);
    }
    return updated;
  };

  const loadCustomerHistory = async (customerId: string) => {
    const [customerBills, allPayments, allReturns] = await Promise.all([
      db.bills.getAllForCustomer(customerId),
      db.payments.getByCustomerId(customerId),
      db.returns.getAll()
    ]);

    const customerReturns = (allReturns as ReturnRecord[]).filter((r: ReturnRecord) => String(r.customerId) === String(customerId));

    const combined: TimelineEntry[] = [
      ...customerBills.map((b: Bill) => ({ ...b, type: 'BILL' as const })),
      ...allPayments.map((p: Payment) => ({ ...p, type: 'PAYMENT' as const })),
      ...customerReturns.map((r: ReturnRecord) => ({ ...r, type: 'RETURN' as const }))
    ];

    combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTransactions(combined);
  };

  const getCustomerContext = () => {
    const totalDebt = (customers as Customer[]).reduce((sum: number, c: Customer) => sum + c.balanceDue, 0);
    const riskyCount = customers.filter(c => c.balanceDue > 10000).length;
    return `Clients: ${customers.length}. Total Debt: LKR ${totalDebt}. High Risk: ${riskyCount}`;
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
        const updated = all.find((c: Customer) => String(c.id) === String(selectedCustomer.id));
        if (updated) setSelectedCustomer(updated);
      }

      setIsCustomerModalOpen(false);
      setCustomerForm({ name: '', phone: '', address: '', nic: '', language: 'en' });
      setIsEditing(false);
    } catch (err: any) {
      alert(`System error: ${err.message}`);
    } finally {
      setIsSaving(false);
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

      const updated = await refreshSelectedCustomer(selectedCustomer.id);
      if (updated) {
        
        // Auto-send WhatsApp text on loan completion
        if (selectedCustomer.balanceDue > 0 && updated.balanceDue <= 0 && updated.phone) {
          try {
            const settings = await db.settings.get();
            const msg = `🎉 *LOAN COMPLETELY SETTLED!* 🎉\n\nDear ${updated.name},\nThank you for your payment of LKR ${paymentFormData.amount.toLocaleString()}. Your outstanding loan balance is now *LKR 0*.\n\nWe appreciate your business!\n- ${settings.businessName || 'WR POS'}`;
            await whatsappService.sendDirect(settings, updated.phone, msg);
          } catch (waErr) {
            console.error('Failed to send complete message via WA:', waErr);
          }
        }
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const showLoanItems = async (customer: Customer) => {
    const customerBills = await db.bills.getAllForCustomer(customer.id);
    const loans = customerBills.filter((b: Bill) => b.paymentType === 'LOAN');
    setLoanItems(loans);
    setShowLoanModal(true);
  };

  const sendLoanReminder = async () => {
    if (!selectedCustomer || loanItems.length === 0) return;
    setIsWASending(true);
    try {
      const settings = await db.settings.get();
      const billedTotal = loanItems.reduce((sum: number, bill: Bill) => sum + bill.total, 0);
      const outstandingBalance = Math.max(0, Number(selectedCustomer.balanceDue || 0));
      const totalLoan = Math.max(billedTotal, outstandingBalance);
      const paidAmount = Math.max(0, totalLoan - outstandingBalance);

      const reminderMessage: Bill = {
        id: 'REMINDER-' + Date.now().toString(),
        invoiceNumber: 'REMINDER-' + Date.now().toString().slice(-6),
        date: new Date().toISOString(),
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        items: [],
        subtotal: totalLoan,
        totalCost: 0,
        totalProfit: 0,
        discount: 0,
        total: totalLoan,
        cashReceived: paidAmount,
        changeReturned: 0,
        paymentType: 'LOAN'
      };

      await autoSendWhatsAppBill(reminderMessage, selectedCustomer, settings);
      alert(`Loan reminder sent to ${selectedCustomer.name}!`);
      setShowLoanModal(false);
    } catch (e: any) {
      alert('Failed to send reminder: ' + e.message);
    } finally {
      setIsWASending(false);
    }
  };

  const getBillAdvancePaid = (bill: Bill) => Math.max(0, Number(bill.cashReceived || 0));
  const getBillOutstanding = (bill: Bill) => Math.max(0, Number(bill.total || 0) - getBillAdvancePaid(bill));

  const openLoanCorrection = () => {
    if (!selectedCustomer) return;
    setLoanCorrectionForm({
      totalLoan: Math.max(0, Number(selectedCustomer.totalLoan || 0)),
      totalPaid: Math.max(0, Number(selectedCustomer.totalPaid || 0)),
      balanceDue: Math.max(0, Number(selectedCustomer.balanceDue || 0))
    });
    setShowLoanCorrectionModal(true);
  };

  const handleSaveLoanCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setIsSaving(true);
    try {
      const correctedCustomer: Customer = {
        ...selectedCustomer,
        totalLoan: Math.round(Math.max(0, Number(loanCorrectionForm.totalLoan || 0))),
        totalPaid: Math.round(Math.max(0, Number(loanCorrectionForm.totalPaid || 0))),
        balanceDue: Math.round(Math.max(0, Number(loanCorrectionForm.balanceDue || 0)))
      };
      await db.customers.update(correctedCustomer);
      await refreshSelectedCustomer(correctedCustomer.id);
      setShowLoanCorrectionModal(false);
    } catch (err: any) {
      alert('Failed to correct loan: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedCustomer.name}? This will remove them from the registry.`)) return;
    
    try {
      await db.customers.delete(selectedCustomer.id);
      await loadCustomers();
      setSelectedCustomer(null);
    } catch (err: any) {
      alert("Failed to delete: " + err.message);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm)
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 flex-1 relative p-2">
      {/* Desktop & Mobile List View */}
      {!selectedCustomer ? (
        <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 px-2">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <h3 className="text-[11px] font-black text-white uppercase tracking-widest">Client Hub</h3>
              <button onClick={() => { setIsEditing(false); setCustomerForm({ name: '', phone: '' }); setIsCustomerModalOpen(true); }} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-blue-900/40 active:scale-95 transition-all">
                <UserPlus size={16} /> Register Client
              </button>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700" size={16} />
                <GlassInput placeholder="SEARCH CUSTOMERS..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 text-xs" />
              </div>
              <button onClick={() => setShowAiModal(true)} className="p-3 bg-purple-600/10 text-purple-500 border border-purple-500/20 rounded-2xl hover:bg-purple-600 hover:text-white transition-all shadow-lg active:scale-95">
                <BrainCircuit size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-10">
              {filteredCustomers.map(customer => (
                <div key={customer.id} onClick={() => setSelectedCustomer(customer)} className="p-5 rounded-[2rem] bg-black/40 border border-white/5 hover:border-blue-500/30 transition-all group flex flex-col relative overflow-hidden active:bg-blue-600/5">
                  <div className="flex gap-4 items-center mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center font-black text-blue-500 text-sm uppercase border border-white/5 shadow-inner shrink-0">{customer.name.charAt(0)}</div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-black text-white text-[13px] uppercase truncate tracking-tight">{customer.name}</h4>
                      <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">{customer.phone}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-t border-white/5 pt-3 mt-auto">
                    <span className="text-[9px] text-gray-700 font-black uppercase tracking-widest">Balance</span>
                    <span className={`font-black font-mono text-[12px] ${customer.balanceDue > 0 ? 'text-red-400' : 'text-emerald-400'}`}>LKR {customer.balanceDue.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Mobile & Desktop Detailed View */
        <div className="flex flex-col h-full space-y-4 animate-in slide-in-from-right duration-300">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
            <button onClick={() => setSelectedCustomer(null)} className="flex items-center gap-2 text-gray-500 hover:text-white transition-all font-black uppercase text-[10px] tracking-widest">
              <ArrowLeft size={16} /> Back to Hub
            </button>

            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={() => { setCustomerForm({ ...selectedCustomer }); setIsEditing(true); setIsCustomerModalOpen(true); }} className="flex-1 py-3 bg-white/5 border border-white/10 text-white rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 active:scale-95 transition-all"><Edit size={14} /> Profile</button>
              <button onClick={() => showLoanItems(selectedCustomer)} className="flex-1 py-3 bg-orange-600/10 text-orange-400 border border-orange-500/20 rounded-2xl text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"><AlertCircle size={14} /> View Loans</button>
              <button onClick={openLoanCorrection} className="flex-1 py-3 bg-yellow-600/10 text-yellow-300 border border-yellow-500/20 rounded-2xl text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"><Edit2 size={14} /> Correct Loan</button>
              <button onClick={() => { setEditingPaymentId(null); setPaymentFormData({ amount: 0, note: '' }); setIsPaymentModalOpen(true); }} className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all">Collect Cash</button>
              <button onClick={handleDeleteCustomer} className="p-3 bg-red-600/10 text-red-500 border border-red-500/20 rounded-2xl hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-lg flex items-center justify-center">
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
            {/* Desktop Left Sidebar / Mobile Top Card */}
            <div className="lg:col-span-4 lg:overflow-y-auto custom-scrollbar">
              <GlassCard className="bg-[#0b1121]/90 p-6 rounded-[2rem] flex flex-col shadow-2xl">
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl mx-auto mb-4 flex items-center justify-center text-2xl font-black text-white shadow-3xl shadow-blue-900/40">{selectedCustomer.name.charAt(0)}</div>
                  <h2 className="text-sm font-black text-white uppercase tracking-tighter">{selectedCustomer.name}</h2>
                  <p className="text-[10px] text-gray-500 font-bold font-mono tracking-widest mt-1">{selectedCustomer.phone}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="p-4 bg-black/40 rounded-2xl border border-red-500/10 text-center">
                    <span className="text-[8px] uppercase font-black text-gray-700 block mb-1">Unpaid</span>
                    <span className="text-xs font-black font-mono text-red-400">LKR {selectedCustomer.balanceDue.toLocaleString()}</span>
                  </div>
                  <div className="p-4 bg-black/40 rounded-2xl border border-emerald-500/10 text-center">
                    <span className="text-[8px] uppercase font-black text-gray-700 block mb-1">Settled</span>
                    <span className="text-xs font-black font-mono text-emerald-400">LKR {selectedCustomer.totalPaid.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedCustomer.nic && <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between"><span className="text-[8px] font-black text-gray-700 uppercase">NIC</span><span className="text-[10px] text-white font-bold">{selectedCustomer.nic}</span></div>}
                  {selectedCustomer.address && <div className="p-3 bg-white/5 rounded-2xl border border-white/5"><p className="text-[8px] font-black text-gray-700 uppercase mb-1">Address</p><p className="text-[10px] text-gray-400 font-bold leading-relaxed">{selectedCustomer.address}</p></div>}
                </div>
              </GlassCard>
            </div>

            {/* Desktop Right Panel / Mobile Bottom Panel */}
            <div className="lg:col-span-8 flex flex-col min-h-0 overflow-hidden">
              <GlassCard className="bg-[#0b1121]/40 flex-1 flex flex-col overflow-hidden p-6 rounded-[2.5rem] border-white/5 shadow-xl">
                <div className="flex items-center gap-3 mb-6 shrink-0">
                  <History size={18} className="text-blue-500" />
                  <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Transaction Manifest</h3>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
                  {transactions.map((t, idx) => (
                    <div key={idx} className="p-4 rounded-[2rem] bg-black/40 border border-white/5 flex items-center justify-between shadow-lg">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner shrink-0 ${t.type === 'BILL' ? 'bg-red-500/10 text-red-400 border-red-500/10' : t.type === 'PAYMENT' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10' : 'bg-orange-500/10 text-orange-400'}`}>
                          {t.type === 'BILL' ? <Receipt size={18} /> : t.type === 'PAYMENT' ? <Banknote size={18} /> : <RotateCcw size={18} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black text-white uppercase truncate">{t.type === 'BILL' ? `Invoice #${t.invoiceNumber}` : t.type === 'PAYMENT' ? 'Settlement' : 'Reversal'}</p>
                          <span className="text-[8px] text-gray-700 font-bold uppercase tracking-widest">{new Date(t.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="text-right flex items-center justify-end gap-2">
                        {t.type === 'PAYMENT' && (
                          <button
                            onClick={() => {
                              setEditingPaymentId(t.id);
                              setOldPaymentAmount(t.amount);
                              setPaymentFormData({ amount: t.amount, note: t.note || '' });
                              setIsPaymentModalOpen(true);
                            }}
                            className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-blue-600 transition-all"
                            title="Edit settlement"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        <p className={`text-sm font-black font-mono tracking-tighter ${t.type === 'BILL' ? 'text-red-400' : 'text-emerald-400'}`}>
                          {t.type === 'BILL' ? '+' : '-'} LKR {(t.type === 'BILL' ? t.total : t.type === 'PAYMENT' ? t.amount : t.refundValue).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALS (Optimized for Mobile Center) --- */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-3 sm:p-4">
          <GlassCard className="w-full max-w-lg bg-[#0b1121] border-2 border-white/10 p-6 sm:p-8 rounded-[2rem] animate-in zoom-in-95 max-h-[92vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center gap-3 mb-6">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">{isEditing ? 'Modify Profile' : 'New Client'}</h3>
              <button onClick={() => { setIsCustomerModalOpen(false); setIsEditing(false); }} className="p-3 bg-white/5 text-gray-500 rounded-2xl active:scale-90 transition-all"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveCustomer} className="space-y-6">
              <GlassInput label="Full Name" value={customerForm.name || ''} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })} required />
              <GlassInput label="Phone Number" value={customerForm.phone || ''} placeholder="077XXXXXXX" onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} required />
              <div className="flex flex-col gap-2">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Home Address</label>
                <textarea className="glass-input rounded-2xl px-5 py-4 text-xs outline-none min-h-[80px]" value={customerForm.address || ''} onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr] gap-3">
                <button type="button" onClick={() => { setIsCustomerModalOpen(false); setIsEditing(false); }} className="py-5 bg-white/5 border border-white/10 text-slate-300 rounded-[1.6rem] font-black uppercase text-xs tracking-[0.25em] shadow-2xl active:scale-95 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="py-5 bg-blue-600 text-white rounded-[1.6rem] font-black uppercase text-xs tracking-[0.25em] shadow-2xl active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Authorize Profile'}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-3 sm:p-4">
          <GlassCard className="w-full max-w-md bg-[#0b1121] border-2 border-white/10 p-6 sm:p-8 rounded-[2rem] animate-in zoom-in-95 max-h-[92vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center gap-3 mb-6">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">{editingPaymentId ? 'Edit Settlement' : 'Collect Cash'}</h3>
              <button onClick={() => { setIsPaymentModalOpen(false); setEditingPaymentId(null); setPaymentFormData({ amount: 0, note: '' }); }} className="p-3 bg-white/5 text-gray-500 rounded-2xl active:scale-90 transition-all"><X size={20} /></button>
            </div>
            <form onSubmit={handleCollectPayment} className="space-y-6">
              <div className="p-5 bg-red-600/5 border border-red-500/10 rounded-3xl flex justify-between items-center mb-2 shadow-inner">
                <span className="text-[9px] font-black text-gray-700 uppercase">Current Debt</span>
                <span className="text-lg font-black font-mono text-red-400">LKR {selectedCustomer?.balanceDue.toLocaleString()}</span>
              </div>
              <GlassInput label="Cash Amount (LKR)" type="number" value={paymentFormData.amount || ''} onChange={e => setPaymentFormData({ ...paymentFormData, amount: Number(e.target.value) })} required />
              <div className="flex flex-col gap-2">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Note</label>
                <textarea
                  value={paymentFormData.note}
                  onChange={e => setPaymentFormData({ ...paymentFormData, note: e.target.value })}
                  className="glass-input rounded-2xl px-5 py-4 text-xs outline-none min-h-[80px]"
                  placeholder={editingPaymentId ? 'Reason for correction' : 'Optional payment note'}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr] gap-3">
                <button type="button" onClick={() => { setIsPaymentModalOpen(false); setEditingPaymentId(null); setPaymentFormData({ amount: 0, note: '' }); }} className="py-5 bg-white/5 border border-white/10 text-slate-300 rounded-[1.6rem] font-black uppercase text-xs tracking-[0.25em] shadow-2xl active:scale-95 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="py-5 bg-emerald-600 text-white rounded-[1.6rem] font-black uppercase text-xs tracking-[0.25em] shadow-2xl active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin mx-auto" size={20} /> : editingPaymentId ? 'Save Correction' : 'Finalize Settlement'}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {showAiModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-4">
          <div className="w-full max-w-2xl animate-in zoom-in-95 duration-300">
            <AIAdvisor mode="CUSTOMER" contextData={getCustomerContext()} onClose={() => setShowAiModal(false)} />
          </div>
        </div>
      )}

      {showLoanCorrectionModal && selectedCustomer && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-3 sm:p-4">
          <GlassCard className="w-full max-w-md bg-[#0b1121] border-2 border-white/10 p-6 sm:p-8 rounded-[2rem] animate-in zoom-in-95 max-h-[92vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center gap-3 mb-6">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Correct Loan</h3>
                <p className="text-[10px] text-gray-500 font-bold mt-1">{selectedCustomer.name}</p>
              </div>
              <button onClick={() => setShowLoanCorrectionModal(false)} className="p-3 bg-white/5 text-gray-500 rounded-2xl active:scale-90 transition-all"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveLoanCorrection} className="space-y-5">
              <GlassInput
                label="Total Loan Given (LKR)"
                type="number"
                value={loanCorrectionForm.totalLoan || ''}
                onChange={e => setLoanCorrectionForm({ ...loanCorrectionForm, totalLoan: Number(e.target.value) })}
                required
              />
              <GlassInput
                label="Total Paid / Settled (LKR)"
                type="number"
                value={loanCorrectionForm.totalPaid || ''}
                onChange={e => setLoanCorrectionForm({ ...loanCorrectionForm, totalPaid: Number(e.target.value) })}
                required
              />
              <GlassInput
                label="Current Balance Due (LKR)"
                type="number"
                value={loanCorrectionForm.balanceDue || ''}
                onChange={e => setLoanCorrectionForm({ ...loanCorrectionForm, balanceDue: Number(e.target.value) })}
                required
              />
              <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-[10px] text-yellow-200 font-bold leading-relaxed">
                  Use this only when a wrong loan or payment was marked. This corrects the customer summary totals.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr] gap-3">
                <button type="button" onClick={() => setShowLoanCorrectionModal(false)} className="py-5 bg-white/5 border border-white/10 text-slate-300 rounded-[1.6rem] font-black uppercase text-xs tracking-[0.25em] shadow-2xl active:scale-95 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="py-5 bg-yellow-600 text-white rounded-[1.6rem] font-black uppercase text-xs tracking-[0.25em] shadow-2xl active:scale-95 transition-all">
                  {isSaving ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Save Loan Fix'}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {showLoanModal && selectedCustomer && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-3 sm:p-4">
          <GlassCard className="w-full max-w-3xl bg-[#0b1121] border-2 border-white/10 p-0 rounded-[2rem] sm:rounded-[2.5rem] animate-in zoom-in-95 max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
            <div className="shrink-0 flex justify-between items-center gap-3 px-5 py-4 sm:px-8 sm:py-5 border-b border-white/10 bg-[#0b1121]">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-widest">Loan Portfolio</h3>
                <p className="text-[10px] text-gray-500 font-bold mt-1">{selectedCustomer.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { showLoanItems(selectedCustomer); }} className="px-3 py-2 bg-yellow-600/10 text-yellow-400 rounded-xl text-[9px] font-black uppercase active:scale-90 transition-all">Reset</button>
                <button onClick={() => setShowLoanModal(false)} className="p-3 bg-white/5 text-gray-500 rounded-2xl active:scale-90 transition-all"><X size={20} /></button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 py-4 sm:px-8 sm:py-6">
              {loanItems.length > 0 ? (
                <div className="space-y-4 pb-4">
                <div className="p-5 bg-red-600/10 border border-red-500/20 rounded-3xl">
                  <span className="text-[9px] text-gray-700 font-black uppercase block mb-2">Total Outstanding Loan</span>
                  <span className="text-2xl font-black font-mono text-red-400">
                    LKR {Math.max(0, Number(selectedCustomer.balanceDue || 0)).toLocaleString()}
                  </span>
                </div>

                <div className="space-y-3">
                  {loanItems.map((bill: Bill) => (
                    <div key={bill.id} className="p-4 rounded-2xl bg-black/40 border border-white/5">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-[11px] font-black text-white uppercase">Invoice {bill.invoiceNumber}</p>
                          <p className="text-[9px] text-gray-600 font-bold mt-1">{new Date(bill.date).toLocaleDateString()}</p>
                          {bill.dueDate && <p className="text-[9px] text-orange-400 font-bold mt-1">Due: {new Date(bill.dueDate).toLocaleDateString()}</p>}
                        </div>
                        <span className="text-lg font-black font-mono text-red-400">LKR {getBillOutstanding(bill).toLocaleString()}</span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] text-gray-600 font-bold">{bill.items.length} items</p>
                        <p className="text-[9px] text-gray-500 font-bold">Bill Total: LKR {bill.total.toLocaleString()}</p>
                        {getBillAdvancePaid(bill) > 0 && (
                          <p className="text-[9px] text-emerald-400 font-bold">Advance Paid: LKR {getBillAdvancePaid(bill).toLocaleString()}</p>
                        )}
                        <p className="text-[9px] text-red-400 font-bold">Remaining: LKR {getBillOutstanding(bill).toLocaleString()}</p>
                      </div>
                      <div className="mt-3 pt-3 border-t border-white/10 space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                        <p className="text-[8px] font-black uppercase tracking-[0.18em] text-blue-300">Purchased Items</p>
                        {bill.items.map((item, itemIndex) => (
                          <div key={`${bill.id}-${item.lineId || item.productId}-${itemIndex}`} className="grid grid-cols-[minmax(0,1fr)_3.5rem_6rem] gap-2 items-start rounded-xl bg-white/[0.04] border border-white/5 p-2.5">
                            <div className="min-w-0">
                              <p className="text-[10px] font-black text-white uppercase leading-snug break-words">{item.name}</p>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {item.sku && <span className="text-[8px] text-slate-500 font-bold">SKU: {item.sku}</span>}
                                {item.warranty && (
                                  <span className="text-[8px] text-emerald-300 font-black uppercase">
                                    Warranty {item.serialNumber ? `| ${item.serialNumber}` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-[10px] font-black text-center text-slate-300">x{item.quantity}</p>
                            <p className="text-[10px] font-black font-mono text-right text-white">LKR {(Number(item.price || 0) * Number(item.quantity || 0)).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-[10px] font-black uppercase tracking-widest">No Loans Found</p>
                <p className="text-[9px] mt-2 text-gray-600">This customer has no outstanding loans</p>
              </div>
            )}
            </div>
            {loanItems.length > 0 && (
              <div className="shrink-0 border-t border-white/10 bg-[#0b1121] px-4 py-3 sm:px-8 sm:py-4">
                <button
                  onClick={sendLoanReminder}
                  disabled={isWASending}
                  className="w-full py-4 bg-green-600/20 text-green-400 border border-green-500/30 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-green-600 hover:text-white transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  {isWASending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                  {isWASending ? 'Sending...' : 'Send WhatsApp Reminder'}
                </button>
              </div>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
};
