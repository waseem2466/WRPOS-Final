import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Edit2,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  Truck,
  Wrench,
  X
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { db, generateId } from '../services/mockDb';
import { Customer, Product, WarrantyChargeType, WarrantyClaim, WarrantyClaimStatus } from '../types';
import { GlassCard } from './ui/GlassCard';
import { GlassInput } from './ui/GlassInput';

const CLAIMS_KEY = 'wr_pos_warranty_claims_v1';

const statusLabels: Record<WarrantyClaimStatus, string> = {
  RECEIVED: 'Received',
  SENT_TO_SUPPLIER: 'Sent Supplier',
  REPAIRING: 'Repairing',
  READY: 'Ready',
  REJECTED: 'Rejected',
  HANDED_OVER: 'Handed Over'
};

const chargeLabels: Record<WarrantyChargeType, string> = {
  FREE_WARRANTY: 'Free Warranty',
  DELIVERY_ONLY: 'Delivery Only',
  REPAIR_CHARGE: 'Repair Charge',
  OUT_OF_WARRANTY: 'Out Warranty',
  REJECTED_CLAIM: 'Rejected Claim'
};

const toNum = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const emptyForm = {
  customerId: '',
  customerName: '',
  customerPhone: '',
  productId: '',
  productName: '',
  invoiceNumber: '',
  serialNumber: '',
  fault: '',
  status: 'RECEIVED' as WarrantyClaimStatus,
  chargeType: 'FREE_WARRANTY' as WarrantyChargeType,
  supplierName: '',
  repairCost: 0,
  deliveryCharge: 0,
  inspectionCharge: 0,
  paidAmount: 0,
  expectedDate: '',
  notes: ''
};

export const WarrantyManager: React.FC = () => {
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);

  useEffect(() => {
    loadClaims();
    Promise.all([db.customers.getAll(), db.products.getAll()])
      .then(([customerRows, productRows]) => {
        setCustomers(customerRows);
        setProducts(productRows);
      })
      .catch(() => {
        setCustomers([]);
        setProducts([]);
      });
  }, []);

  const loadClaims = () => {
    try {
      const saved = localStorage.getItem(CLAIMS_KEY);
      setClaims(saved ? JSON.parse(saved) : []);
    } catch {
      setClaims([]);
    }
  };

  const saveClaims = (next: WarrantyClaim[]) => {
    setClaims(next);
    localStorage.setItem(CLAIMS_KEY, JSON.stringify(next));
  };

  const customerCharge = useMemo(
    () => toNum(form.repairCost) + toNum(form.deliveryCharge) + toNum(form.inspectionCharge),
    [form.repairCost, form.deliveryCharge, form.inspectionCharge]
  );
  const balanceDue = Math.max(0, customerCharge - toNum(form.paidAmount));

  const filteredClaims = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return claims;
    return claims.filter(claim =>
      claim.claimNumber.toLowerCase().includes(term) ||
      claim.customerName.toLowerCase().includes(term) ||
      claim.customerPhone.toLowerCase().includes(term) ||
      claim.productName.toLowerCase().includes(term) ||
      claim.serialNumber?.toLowerCase().includes(term) ||
      claim.invoiceNumber?.toLowerCase().includes(term)
    );
  }, [claims, search]);

  const totals = useMemo(() => {
    return claims.reduce(
      (acc, claim) => {
        acc.open += claim.status !== 'HANDED_OVER' ? 1 : 0;
        acc.ready += claim.status === 'READY' ? 1 : 0;
        acc.balance += claim.balanceDue;
        return acc;
      },
      { open: 0, ready: 0, balance: 0 }
    );
  }, [claims]);

  const updateStatus = (id: string, status: WarrantyClaimStatus) => {
    const next = claims.map(claim => {
      if (claim.id !== id) return claim;
      if (status === 'HANDED_OVER' && claim.balanceDue > 0) {
        alert(`Cannot hand over ${claim.productName} until balance is cleared.`);
        return claim;
      }
      return { ...claim, status, updatedAt: new Date().toISOString() };
    });
    saveClaims(next);
  };

  const handleEditClaim = (claim: WarrantyClaim) => {
    setEditingClaimId(claim.id);
    setForm({
      customerId: claim.customerId || '',
      customerName: claim.customerName,
      customerPhone: claim.customerPhone,
      productId: claim.productId || '',
      productName: claim.productName,
      invoiceNumber: claim.invoiceNumber || '',
      serialNumber: claim.serialNumber || '',
      fault: claim.fault,
      status: claim.status,
      chargeType: claim.chargeType,
      supplierName: claim.supplierName || '',
      repairCost: toNum(claim.repairCost),
      deliveryCharge: toNum(claim.deliveryCharge),
      inspectionCharge: toNum(claim.inspectionCharge),
      paidAmount: toNum(claim.paidAmount),
      expectedDate: claim.expectedDate || '',
      notes: claim.notes || ''
    });
    setShowForm(true);
  };

  const collectFullBalance = (claim: WarrantyClaim) => {
    const next = claims.map(row => {
      if (row.id !== claim.id) return row;
      const paidAmount = row.customerCharge;
      return {
        ...row,
        paidAmount,
        balanceDue: 0,
        status: row.status === 'READY' ? 'HANDED_OVER' : row.status,
        updatedAt: new Date().toISOString()
      };
    });
    saveClaims(next);
  };

  const handleCustomerPick = (customerId: string) => {
    const customer = customers.find(c => String(c.id) === customerId);
    setForm(prev => ({
      ...prev,
      customerId,
      customerName: customer?.name || prev.customerName,
      customerPhone: customer?.phone || prev.customerPhone
    }));
  };

  const handleProductPick = (productId: string) => {
    const product = products.find(p => String(p.id) === productId);
    setForm(prev => ({
      ...prev,
      productId,
      productName: product?.name || prev.productName
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.customerName.trim() || !form.customerPhone.trim() || !form.productName.trim() || !form.fault.trim()) return;

    const claim: WarrantyClaim = {
      id: editingClaimId || generateId(),
      claimNumber: editingClaimId
        ? claims.find(row => row.id === editingClaimId)?.claimNumber || `WC-${Date.now().toString().slice(-6)}`
        : `WC-${Date.now().toString().slice(-6)}`,
      date: editingClaimId
        ? claims.find(row => row.id === editingClaimId)?.date || new Date().toISOString()
        : new Date().toISOString(),
      customerId: form.customerId || null,
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      productId: form.productId || null,
      productName: form.productName.trim(),
      invoiceNumber: form.invoiceNumber.trim(),
      serialNumber: form.serialNumber.trim(),
      fault: form.fault.trim(),
      status: form.status,
      chargeType: form.chargeType,
      supplierName: form.supplierName.trim(),
      repairCost: toNum(form.repairCost),
      deliveryCharge: toNum(form.deliveryCharge),
      inspectionCharge: toNum(form.inspectionCharge),
      customerCharge,
      paidAmount: toNum(form.paidAmount),
      balanceDue,
      expectedDate: form.expectedDate,
      notes: form.notes.trim(),
      updatedAt: new Date().toISOString()
    };

    const next = editingClaimId
      ? claims.map(row => row.id === editingClaimId ? claim : row)
      : [claim, ...claims];
    saveClaims(next);
    setForm(emptyForm);
    setEditingClaimId(null);
    setShowForm(false);
  };

  return (
    <div className="flex-1 h-full overflow-y-auto custom-scrollbar pr-1">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_25rem] gap-5 animate-in fade-in duration-500 min-h-full pb-4">
      <div className="flex flex-col min-h-0 gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <GlassCard className="p-4 border-blue-500/10">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Open Claims</p>
            <p className="text-2xl font-black text-white mt-1">{totals.open}</p>
          </GlassCard>
          <GlassCard className="p-4 border-emerald-500/10">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Ready Items</p>
            <p className="text-2xl font-black text-emerald-300 mt-1">{totals.ready}</p>
          </GlassCard>
          <GlassCard className="p-4 border-orange-500/10">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Claim Balance</p>
            <p className="text-2xl font-black text-orange-300 mt-1">LKR {totals.balance.toLocaleString()}</p>
          </GlassCard>
        </div>

        <GlassCard className="p-4 flex flex-col min-h-[32rem] xl:min-h-0 xl:flex-1">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.22em] text-white">Warranty Claims</h3>
              <p className="text-[10px] text-slate-500 mt-1">Track received items, supplier status, charges, payments, and handover.</p>
            </div>
            <button
              onClick={() => {
                setEditingClaimId(null);
                setForm(emptyForm);
                setShowForm(true);
              }}
              className="px-4 py-3 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.18em] flex items-center justify-center gap-2 shadow-xl"
            >
              <Plus size={14} /> New Claim
            </button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search claim, customer, serial, invoice..."
              className="w-full h-12 rounded-2xl bg-black/40 border border-white/10 pl-11 pr-4 text-sm text-white font-bold outline-none focus:border-blue-400"
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-3 pr-1">
            {filteredClaims.length === 0 ? (
              <div className="h-full min-h-[18rem] flex flex-col items-center justify-center text-slate-600">
                <ShieldCheck size={46} className="opacity-30 mb-4" />
                <p className="text-[10px] font-black uppercase tracking-[0.24em]">No warranty claims yet</p>
              </div>
            ) : (
              filteredClaims.map(claim => (
                <div key={claim.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex flex-col lg:flex-row gap-3 lg:items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-300 text-[9px] font-black uppercase">{claim.claimNumber}</span>
                        <span className="px-2 py-1 rounded-lg bg-white/5 text-slate-300 text-[9px] font-black uppercase">{statusLabels[claim.status]}</span>
                        <span className="px-2 py-1 rounded-lg bg-orange-500/10 text-orange-300 text-[9px] font-black uppercase">{chargeLabels[claim.chargeType]}</span>
                      </div>
                      <p className="text-sm font-black uppercase text-white leading-snug break-words">{claim.productName}</p>
                      <p className="text-[11px] text-slate-400 mt-1 break-words">{claim.customerName} | {claim.customerPhone}</p>
                      <p className="text-[11px] text-slate-500 mt-2 leading-relaxed break-words">{claim.fault}</p>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
                        <div className="rounded-xl bg-black/20 border border-white/5 px-3 py-2 text-slate-300">
                          Invoice: {claim.invoiceNumber || 'N/A'}
                        </div>
                        <div className="rounded-xl bg-black/20 border border-white/5 px-3 py-2 text-slate-300">
                          Serial: {claim.serialNumber || 'N/A'}
                        </div>
                        <div className="rounded-xl bg-black/20 border border-white/5 px-3 py-2 text-slate-300">
                          Supplier: {claim.supplierName || 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 lg:min-w-[16rem]">
                      <div className="rounded-xl bg-black/25 border border-white/5 p-2 text-center">
                        <p className="text-[8px] font-black uppercase text-slate-500">Charge</p>
                        <p className="text-[11px] font-black text-white">LKR {claim.customerCharge.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl bg-black/25 border border-white/5 p-2 text-center">
                        <p className="text-[8px] font-black uppercase text-slate-500">Paid</p>
                        <p className="text-[11px] font-black text-emerald-300">LKR {claim.paidAmount.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl bg-black/25 border border-white/5 p-2 text-center">
                        <p className="text-[8px] font-black uppercase text-slate-500">Balance</p>
                        <p className="text-[11px] font-black text-orange-300">LKR {claim.balanceDue.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditClaim(claim)}
                      className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[8px] font-black uppercase tracking-wide text-slate-300 hover:text-white flex items-center gap-2"
                    >
                      <Edit2 size={12} /> Edit Claim
                    </button>
                    {claim.balanceDue > 0 && (
                      <button
                        type="button"
                        onClick={() => collectFullBalance(claim)}
                        className="px-3 py-2 rounded-xl bg-emerald-600/15 border border-emerald-400/25 text-[8px] font-black uppercase tracking-wide text-emerald-300 hover:text-white"
                      >
                        Collect Full Balance
                      </button>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-2">
                    {(Object.keys(statusLabels) as WarrantyClaimStatus[]).map(status => (
                      <button
                        key={status}
                        onClick={() => updateStatus(claim.id, status)}
                        className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-wide border transition-all ${claim.status === status ? 'bg-blue-600 border-blue-400 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                      >
                        {statusLabels[status]}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-5 flex flex-col min-h-[20rem]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.24em] text-white">Claim Counter</h3>
            <p className="text-[10px] text-slate-500 mt-1">Money and status rules</p>
          </div>
          <PackageCheck className="text-blue-300" size={22} />
        </div>

        <div className="space-y-3 text-[11px] text-slate-300 leading-relaxed">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex gap-3">
            <Truck size={16} className="text-orange-300 shrink-0 mt-0.5" />
            <p>Use delivery charge when item goes to supplier or courier. Balance stays visible until handover.</p>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex gap-3">
            <Wrench size={16} className="text-violet-300 shrink-0 mt-0.5" />
            <p>Repair cost can be your supplier/service cost, or customer repair charge for out-of-warranty items.</p>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex gap-3">
            <Banknote size={16} className="text-emerald-300 shrink-0 mt-0.5" />
            <p>Collect the balance before changing status to Handed Over.</p>
          </div>
        </div>
      </GlassCard>

      {showForm && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-4xl max-h-[92vh] overflow-hidden p-0 flex flex-col">
            <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-6 sm:pt-6 sm:pb-5 border-b border-white/10 shrink-0">
              <div>
                <h2 className="text-lg font-black uppercase tracking-[0.18em] text-white">{editingClaimId ? 'Edit Warranty Claim' : 'New Warranty Claim'}</h2>
                <p className="text-[10px] text-slate-500 mt-1">Receive item, calculate charges, and track supplier/customer handover.</p>
              </div>
              <button onClick={() => { setShowForm(false); setEditingClaimId(null); setForm(emptyForm); }} className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 py-5 sm:px-6 sm:py-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-wide text-slate-500 ml-1">Pick Customer</label>
                  <select value={form.customerId} onChange={e => handleCustomerPick(e.target.value)} className="mt-1 w-full h-11 rounded-xl bg-black/50 border border-white/10 px-3 text-xs text-white font-bold outline-none">
                    <option value="">Manual customer</option>
                    {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name} - {customer.phone}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-wide text-slate-500 ml-1">Pick Product</label>
                  <select value={form.productId} onChange={e => handleProductPick(e.target.value)} className="mt-1 w-full h-11 rounded-xl bg-black/50 border border-white/10 px-3 text-xs text-white font-bold outline-none">
                    <option value="">Manual item</option>
                    {products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
                  </select>
                </div>
                <GlassInput label="Customer Name" value={form.customerName} onChange={e => setForm(prev => ({ ...prev, customerName: e.target.value }))} required />
                <GlassInput label="Customer Phone" value={form.customerPhone} onChange={e => setForm(prev => ({ ...prev, customerPhone: e.target.value }))} required />
                <GlassInput label="Product / Item" value={form.productName} onChange={e => setForm(prev => ({ ...prev, productName: e.target.value }))} required />
                <GlassInput label="Serial / IMEI" value={form.serialNumber} onChange={e => setForm(prev => ({ ...prev, serialNumber: e.target.value }))} />
                <GlassInput label="Invoice Number" value={form.invoiceNumber} onChange={e => setForm(prev => ({ ...prev, invoiceNumber: e.target.value }))} />
                <GlassInput label="Supplier / Service Center" value={form.supplierName} onChange={e => setForm(prev => ({ ...prev, supplierName: e.target.value }))} />
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-wide text-slate-500 ml-1">Customer Fault / Complaint</label>
                  <textarea value={form.fault} onChange={e => setForm(prev => ({ ...prev, fault: e.target.value }))} required className="mt-1 w-full min-h-[5rem] rounded-2xl bg-black/50 border border-white/10 p-4 text-sm text-white outline-none resize-none" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-wide text-slate-500 ml-1">Charge Type</label>
                    <select value={form.chargeType} onChange={e => setForm(prev => ({ ...prev, chargeType: e.target.value as WarrantyChargeType }))} className="mt-1 w-full h-11 rounded-xl bg-black/50 border border-white/10 px-3 text-xs text-white font-bold outline-none">
                      {(Object.keys(chargeLabels) as WarrantyChargeType[]).map(type => <option key={type} value={type}>{chargeLabels[type]}</option>)}
                    </select>
                  </div>
                  <GlassInput label="Repair Cost" type="number" value={form.repairCost} onChange={e => setForm(prev => ({ ...prev, repairCost: toNum(e.target.value) }))} />
                  <GlassInput label="Delivery Charge" type="number" value={form.deliveryCharge} onChange={e => setForm(prev => ({ ...prev, deliveryCharge: toNum(e.target.value) }))} />
                  <GlassInput label="Inspection Charge" type="number" value={form.inspectionCharge} onChange={e => setForm(prev => ({ ...prev, inspectionCharge: toNum(e.target.value) }))} />
                  <GlassInput label="Paid Amount" type="number" value={form.paidAmount} onChange={e => setForm(prev => ({ ...prev, paidAmount: toNum(e.target.value) }))} />
                  <GlassInput label="Expected Date" type="date" value={form.expectedDate} onChange={e => setForm(prev => ({ ...prev, expectedDate: e.target.value }))} />
                  <div className="rounded-2xl bg-blue-500/10 border border-blue-500/20 p-3">
                    <p className="text-[8px] font-black uppercase text-blue-300 tracking-wide flex items-center gap-1"><ClipboardList size={11} /> Customer Charge</p>
                    <p className="text-lg font-black text-white mt-1">LKR {customerCharge.toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl bg-orange-500/10 border border-orange-500/20 p-3">
                    <p className="text-[8px] font-black uppercase text-orange-300 tracking-wide flex items-center gap-1"><CalendarClock size={11} /> Balance</p>
                    <p className="text-lg font-black text-white mt-1">LKR {balanceDue.toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-wide text-slate-500 ml-1">Internal Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} className="mt-1 w-full min-h-[4rem] rounded-2xl bg-black/50 border border-white/10 p-4 text-sm text-white outline-none resize-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr] gap-3 p-5 pt-4 sm:px-6 sm:pb-6 border-t border-white/10 shrink-0 bg-[#0b1121]/95 backdrop-blur">
                <button type="button" onClick={() => { setShowForm(false); setEditingClaimId(null); setForm(emptyForm); }} className="py-4 rounded-2xl bg-white/5 border border-white/10 text-slate-300 text-[10px] font-black uppercase tracking-[0.2em]">Cancel</button>
                <button type="submit" className="py-4 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} /> {editingClaimId ? 'Update Warranty Claim' : 'Save Warranty Claim'}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
      </div>
    </div>
  );
};
