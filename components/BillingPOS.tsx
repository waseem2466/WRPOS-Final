
import {
  Check, Loader2, Printer, ShoppingCart, Trash, UserCheck, X,
  Barcode, Smartphone, Search, Plus, RotateCcw,
  Wand2, PenTool, CreditCard, Banknote, UserPlus, Info, Receipt,
  Minus, PlusCircle, AlertCircle, FileDown
} from 'lucide-react';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { db, generateId } from '../services/mockDb';
import { whatsappService } from '../services/whatsapp';
import { autoSendWhatsAppBill } from '../services/whatsappAutoSend';
import { pdfService } from '../services/pdfService';
import { Bill, BillItem, BusinessSettings, Customer, Product } from '../types';
import { GlassCard } from './ui/GlassCard';
import { GlassInput } from './ui/GlassInput';
import { useAuth } from '../context/AuthContext';

const toNum = (val: any) => { const n = Number(val); return isNaN(n) ? 0 : n; };
const round2 = (n: number) => Math.round(n * 100) / 100;

const CartItemMemo = React.memo(({ item, idx, onUpdateQty, onRemove, onUpdateDiscount, isReturnMode }: any) => {
  const price = toNum(item.price);
  const discountVal = toNum(item.discountValue);
  const qty = toNum(item.quantity);
  const lineTotal = Math.max(0, (price - discountVal) * qty);

  return (
    <div className={`p-4 rounded-3xl border transition-all ${isReturnMode ? 'bg-orange-500/10 border-orange-500/20' : 'bg-black/20 border-white/5 hover:bg-white/10'}`}>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-white uppercase truncate">{item.name}</p>
            <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">{item.sku}</p>
          </div>
          <div className="flex items-center bg-black/60 rounded-xl px-1 py-1 border border-white/10 shrink-0">
            <button onClick={() => onUpdateQty(idx, -1)} className="text-gray-500 px-2 text-sm hover:text-white transition-colors">
              <Minus size={12} />
            </button>
            <input
              type="number"
              value={item.quantity}
              onChange={(e) => onUpdateQty(idx, parseInt(e.target.value) || 1, true)}
              className="w-12 bg-transparent border border-white/10 rounded-lg px-2 py-1 text-[10px] text-current text-center focus:border-blue-500 outline-none"
              min="1"
              step="1"
            />
            <button onClick={() => onUpdateQty(idx, 1)} className="text-gray-500 px-2 text-sm hover:text-white transition-colors">
              <Plus size={12} />
            </button>
          </div>
          <button onClick={() => onRemove(idx)} className="ml-3 text-red-500/30 hover:text-red-500 transition-colors">
            <Trash size={14} />
          </button>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-white/5">
          {!isReturnMode ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={item.discountValue || ''}
                onChange={e => onUpdateDiscount(idx, toNum(e.target.value))}
                className="w-14 bg-transparent border border-white/10 rounded-lg px-2 py-1 text-[9px] text-orange-400 focus:border-orange-500 outline-none"
                placeholder="0"
              />
              <span className="text-[7px] font-black text-gray-700 uppercase">LKR Disc</span>
            </div>
          ) : (
            <span className="text-[8px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-1">
              <RotateCcw size={10} /> Returning Items
            </span>
          )}
          <p className="text-[11px] font-black text-white font-mono">
            {isReturnMode ? '-' : ''} LKR {lineTotal.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
});

export const BillingPOS: React.FC = () => {
  const { user } = useAuth();
  const [posMode, setPosMode] = useState<'SALE' | 'RETURN'>('SALE');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | any>(null);

  const [search, setSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [cart, setCart] = useState<BillItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [cashReceived, setCashReceived] = useState<number | ''>('');
  const [successBill, setSuccessBill] = useState<Bill | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  const [showQuickCust, setShowQuickCust] = useState(false);
  const [quickCustForm, setQuickCustForm] = useState({ name: '', phone: '' });
  const [showManualService, setShowManualService] = useState(false);
  const [serviceForm, setServiceForm] = useState({ name: '', price: '' });
  const [dueDate, setDueDate] = useState<string>('');

  const [autoSendWA, setAutoSendWA] = useState(() => localStorage.getItem('pos_auto_wa') !== 'false');
  const [waSending, setWASending] = useState(false);

  const customerSearchRef = useRef<HTMLDivElement>(null);
  const productSearchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const newSaleBtnRef = useRef<HTMLButtonElement>(null);
  const handleCheckoutRef = useRef<() => void>(() => { });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (successBill && newSaleBtnRef.current) {
      newSaleBtnRef.current.focus();
    }
  }, [successBill]);

  useEffect(() => {
    handleCheckoutRef.current = handleCheckout;
  });

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); setSuccessBill(null); }
      if (e.key === 'F4') { e.preventDefault(); handleCheckoutRef.current(); }
      if (e.key === 'Escape') {
        setShowQuickCust(false); setShowManualService(false);
        setShowProductDropdown(false); setShowCustomerDropdown(false);
      }
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) setShowCustomerDropdown(false);
      if (productSearchRef.current && !productSearchRef.current.contains(e.target as Node)) setShowProductDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    const [p, c, s] = await Promise.all([db.products.getAll(), db.customers.getAll(), db.settings.get()]);
    setProducts(p); setCustomers(c); setSettings(s);
  };

  const totals = useMemo(() => {
    const totalDiscount = cart.reduce((sum, i) => sum + (toNum(i.discountValue) * toNum(i.quantity)), 0);
    const subtotal = cart.reduce((sum, i) => {
      const disc = toNum(i.discountValue);
      return sum + ((toNum(i.price) - disc) * toNum(i.quantity));
    }, 0);
    const totalProfit = cart.reduce((sum, i) => {
      const disc = toNum(i.discountValue);
      return sum + ((toNum(i.price) - disc - toNum(i.cost)) * toNum(i.quantity));
    }, 0);
    const received = cashReceived === '' ? subtotal : toNum(cashReceived);
    return {
      subtotal: round2(subtotal),
      total: round2(subtotal),
      totalDiscount: round2(totalDiscount),
      totalProfit: round2(totalProfit),
      change: round2(Math.max(0, received - subtotal))
    };
  }, [cart, cashReceived]);

  const handleDownloadInvoice = async () => {
    if (!successBill || !settings) return;
    setIsPdfGenerating(true);
    try {
      const customer = customers.find(c => String(c.id) === String(successBill.customerId));
      await pdfService.generateInvoice(successBill, settings, customer);
    } catch (e) {
      console.error("PDF Generation Error", e);
      alert("Failed to generate PDF invoice.");
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || isSaving) return;

    if (posMode === 'RETURN') {
      if (!confirm(`Confirm Return/Refund of LKR ${totals.total.toLocaleString()}? Inventory will be restored.`)) return;
      setIsSaving(true);
      try {
        for (const item of cart) {
          if (item.billId && item.lineId) {
            await db.bills.returnItem(item.billId, item.lineId, item.quantity);
          }
        }
        setSuccessBill({ id: 'return-ok', invoiceNumber: 'RETURN-OK' } as any);
        setCart([]); setSelectedCustomerId(''); setCashReceived(''); setCustomerSearch(''); setDueDate('');
        await loadData();
      } catch (e: any) {
        alert("Return Error: " + e.message);
      } finally { setIsSaving(false); }
      return;
    }

    const actualPaid = cashReceived === '' ? totals.total : toNum(cashReceived);
    if (totals.total - actualPaid > 0.01 && !selectedCustomerId) {
      alert("A customer must be assigned to process a credit/loan sale."); return;
    }

    if (posMode === 'SALE') {
      for (const item of cart) {
        const product = products.find(p => String(p.id) === String(item.productId));
        if (product && !item.productId.startsWith('SERVICE-') && toNum(product.stock) < toNum(item.quantity)) {
          alert(`CRITICAL STOCK ALERT: Only ${product.stock} units of "${item.name}" available. Cannot oversell in Enterprise mode.`);
          return;
        }
      }
    }

    if (!confirm(`Authorize sale for LKR ${totals.total.toLocaleString()}?`)) return;

    setIsSaving(true);
    try {
      const customer = customers.find(c => String(c.id) === String(selectedCustomerId));

      const invId = Date.now().toString().slice(-6) + Math.random().toString(36).slice(-3).toUpperCase();
      const isLoan = totals.total - actualPaid > 0.01;

      const bill: Bill = {
        id: generateId(),
        invoiceNumber: `INV-${invId}`,
        date: new Date().toISOString(),
        customerId: selectedCustomerId || null,
        customerName: customer ? customer.name : 'CASH SALE',
        items: cart.map(i => ({ ...i, lineId: generateId(), warrantyPrice: toNum(i.warrantyPrice), warrantyCost: toNum(i.warrantyCost) })),
        subtotal: totals.total,
        totalCost: round2(cart.reduce((sum, i) => sum + (toNum(i.cost) * toNum(i.quantity)), 0)),
        totalProfit: totals.totalProfit,
        discount: totals.totalDiscount,
        total: totals.total,
        cashReceived: actualPaid,
        changeReturned: totals.change,
        paymentType: isLoan ? 'LOAN' : 'CASH',
        dueDate: isLoan ? dueDate || undefined : undefined
      };

      await db.bills.create(bill);

      try {
        if (autoSendWA && customer) {
          setWASending(true);
          await autoSendWhatsAppBill(bill, customer, settings);
          setWASending(false);
        }
      } catch (waErr) {
        console.warn("WhatsApp relay failed, but sale was recorded:", waErr);
        setWASending(false);
      }

      setSuccessBill(bill);
      setCart([]); setCashReceived(''); setSelectedCustomerId(''); setCustomerSearch(''); setDueDate('');
      await loadData();
    } catch (e: any) {
      console.error("Critical POS Failure:", e);
      alert("System Error: Could not complete sale. " + (e.message || "Database connection error."));
    } finally { setIsSaving(false); }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === String(product.id));
      if (existing) return prev.map(i => i.productId === String(product.id) ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, {
        productId: String(product.id),
        name: product.name,
        sku: product.sku || 'N/A',
        quantity: 1,
        cost: toNum(product.cost),
        price: toNum(product.price),
        profit: toNum(product.price) - toNum(product.cost),
        warranty: !!product.warrantyYears, warrantyYears: product.warrantyYears || 0, warrantyUnit: product.warrantyUnit || 'YEARS', warrantyPrice: product.warrantyPrice || 0, warrantyCost: product.warrantyCost || 0,
        discountValue: 0,
        discountType: 'FIXED'
      } as BillItem];
    });
    setSearch('');
    setShowProductDropdown(false);
  };

  const handleAddServiceItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceForm.name || !serviceForm.price) return;
    const price = toNum(serviceForm.price);
    const serviceItem: BillItem = { productId: 'SERVICE-' + generateId().slice(-6), name: serviceForm.name.toUpperCase(), sku: 'SERVICE-LINE', quantity: 1, cost: 0, price: price, profit: price, warranty: false, discountValue: 0, discountType: 'FIXED' };
    setCart(prev => [...prev, serviceItem]);
    setServiceForm({ name: '', price: '' });
    setShowManualService(false);
  };

  const handleInvoiceSearch = async () => {
    if (!search.trim()) return;
    const bill = await db.bills.getByInvoiceNumber(search.trim().toUpperCase());
    if (!bill) { alert("Could not find invoice matching that number."); return; }

    const items = bill.items.map((i: any) => ({ ...i, billId: bill.id, quantity: i.quantity - toNum(i.returnedQty) })).filter((i: any) => i.quantity > 0);

    if (items.length === 0) {
      alert("All items on this invoice have already been returned.");
      return;
    }
    setCart(items);
    setSelectedCustomerId(bill.customerId || '');
    setCustomerSearch(bill.customerName || '');
    setSearch('');
  };

  const handleQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustForm.name) return;
    try {
      const newCustomerId = await db.customers.create(quickCustForm);
      const newCustomer: Customer = { id: newCustomerId, ...quickCustForm, totalLoan: 0, totalPaid: 0, balanceDue: 0 };
      setCustomers(prev => [...prev, newCustomer]);
      setSelectedCustomerId(newCustomerId);
      setCustomerSearch(newCustomer.name);
      setShowQuickCust(false);
      setQuickCustForm({ name: '', phone: '' });
    } catch (err) {
      alert("Failed to create customer.");
    }
  };

  const updateCartQty = (idx: number, value: number, isAbsolute = false) => {
    setCart(prev => prev.map((item, i) => i === idx ? { ...item, quantity: isAbsolute ? Math.max(1, value) : Math.max(1, item.quantity + value) } : item));
  };

  const updateCartDiscount = (idx: number, value: number) => {
    setCart(prev => prev.map((item, i) => i === idx ? { ...item, discountValue: value } : item));
  };

  const removeFromCart = (idx: number) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
  };

  const filteredProducts = useMemo(() => {
    if (!search) return [];
    return products
      .filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(search.toLowerCase())
      )
      .slice(0, 10);
  }, [search, products]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return [];
    return customers
      .filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone?.toLowerCase().includes(customerSearch.toLowerCase())
      )
      .slice(0, 10);
  }, [customerSearch, customers]);

  const selectedCustomer = customers.find(c => String(c.id) === String(selectedCustomerId));

  if (successBill) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <GlassCard className="max-w-xl text-center p-12 animate-in fade-in zoom-in-90 duration-700">
          <div className="relative inline-block">
            <div className="p-6 bg-emerald-500/10 rounded-full mb-6">
              <Check size={48} className="text-emerald-400" />
            </div>
          </div>
          <h2 className="text-3xl font-black uppercase text-white tracking-tight mb-3">Transaction Complete</h2>
          <p className="text-sm text-slate-400 mb-8">Invoice <span className="font-bold text-white">{successBill.invoiceNumber}</span> has been finalized.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button onClick={handleDownloadInvoice} className="px-6 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-900/30 flex items-center gap-2" disabled={isPdfGenerating}>
              {isPdfGenerating ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />} Download PDF
            </button>
            <button
              onClick={async () => {
                if (!successBill || !settings) return;
                const customer = customers.find(c => String(c.id) === String(successBill.customerId));
                if (!customer?.phone) { alert("No phone number registered for this customer."); return; }
                setWASending(true);
                try {
                  await autoSendWhatsAppBill(successBill, customer, settings);
                  alert("WhatsApp Invoice Sent!");
                } catch (e) {
                  alert("WhatsApp Dispatch Failed. Check Hub for details.");
                } finally {
                  setWASending(false);
                }
              }}
              disabled={waSending}
              className="px-6 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-900/30 flex items-center gap-2"
            >
              {waSending ? <Loader2 size={16} className="animate-spin" /> : <Smartphone size={16} />}
              {waSending ? 'Sending...' : 'Send WhatsApp'}
            </button>
            <button
              ref={newSaleBtnRef}
              onClick={() => setSuccessBill(null)}
              className="px-6 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-white font-black text-xs uppercase tracking-widest flex items-center gap-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <PlusCircle size={16} /> New Sale (F2)
            </button>
          </div>
          {waSending && <p className="text-xs text-blue-400 mt-4 animate-pulse uppercase font-black tracking-widest">Neural Link Active: Dispatching Receipt...</p>}
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex flex-col lg:flex-row gap-4 relative z-0">

        {/* Left Panel: Search & Cart */}
        <GlassCard className="flex flex-col flex-1 min-h-0 border-blue-500/10">
          {/* Search Section */}
          <div className="p-6 border-b border-white/5 bg-black/10 backdrop-blur-sm z-10">
            <div className="flex gap-4 items-start">
              <div className="relative w-full" ref={productSearchRef}>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 z-10" size={18} />
                <GlassInput
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setShowProductDropdown(true); }}
                  onFocus={() => setShowProductDropdown(true)}
                  placeholder={posMode === 'RETURN' ? "Scan or type Invoice Number..." : "Search (Alt+S) or scan barcode..."}
                  className="w-full pl-12 text-sm"
                />
                {showProductDropdown && filteredProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0f1d]/80 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl p-2 z-[500] overflow-visible animate-in fade-in zoom-in-95">
                    {filteredProducts.map(p => (
                      <div key={p.id} onClick={() => addToCart(p)} className="p-3 hover:bg-blue-500/10 rounded-xl cursor-pointer flex justify-between items-center">
                        <div>
                          <p className="text-xs font-bold text-white">{p.name}</p>
                          <p className="text-[9px] text-gray-400 font-mono">{p.sku}</p>
                        </div>
                        <p className="text-xs font-mono text-blue-400">LKR {p.price?.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {posMode === 'RETURN' ? (
                <button onClick={handleInvoiceSearch} className="p-4 bg-orange-600 hover:bg-orange-500 rounded-2xl text-white"><Search size={20} /></button>
              ) : (
                <button onClick={() => setShowManualService(true)} className="p-4 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/20 rounded-2xl text-blue-400 hover:text-white transition-all"><PenTool size={20} /></button>
              )}
            </div>
          </div>

          {/* Cart Section */}
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-3 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-700">
                <ShoppingCart size={48} className="mb-4" />
                <h3 className="text-lg font-bold text-gray-500">Cart is Empty</h3>
                <p className="text-xs">Add products to get started</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <CartItemMemo
                  key={item.productId}
                  item={item}
                  idx={idx}
                  onUpdateQty={updateCartQty}
                  onRemove={removeFromCart}
                  onUpdateDiscount={updateCartDiscount}
                  isReturnMode={posMode === 'RETURN'}
                />
              ))
            )}
          </div>
        </GlassCard>

        {/* Right Panel: Billing */}
        <div className="w-full lg:w-[420px] flex flex-col gap-4 min-h-0 relative">
          {/* Customer Panel */}
          <GlassCard className="p-6 border-blue-500/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase text-white tracking-widest">Customer</h3>
              <button onClick={() => setShowQuickCust(true)} className="text-xs font-bold text-blue-400 hover:text-blue-500 flex items-center gap-1">
                <UserPlus size={14} /> New
              </button>
            </div>
            <div className="relative" ref={customerSearchRef}>
              <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 z-10" size={18} />
              <GlassInput
                value={customerSearch}
                onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); setSelectedCustomerId(''); }}
                onFocus={() => setShowCustomerDropdown(true)}
                placeholder="Search by name or phone..."
                className="w-full pl-12"
              />
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0f1d]/80 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl p-2 z-[500] overflow-visible animate-in fade-in zoom-in-95">
                  {filteredCustomers.map(c => (
                    <div key={c.id} onClick={() => { setSelectedCustomerId(String(c.id)); setCustomerSearch(c.name); setShowCustomerDropdown(false); }} className="p-3 hover:bg-blue-500/10 rounded-xl cursor-pointer">
                      <p className="text-xs font-bold text-white">{c.name}</p>
                      <p className="text-[9px] text-gray-400 font-mono">{c.phone}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedCustomer && (
              <div className="mt-4 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-xs flex items-center justify-between">
                <span className="font-bold text-blue-300">{selectedCustomer.name}</span>
                <button onClick={() => { setSelectedCustomerId(''); setCustomerSearch(''); }} className="text-blue-400/50 hover:text-white">
                  <X size={16} />
                </button>
              </div>
            )}
          </GlassCard>

          {/* Totals Panel */}
          <GlassCard className="flex-1 flex flex-col border-blue-500/10">
            <div className="p-6 flex-1 space-y-4">
              <h3 className="text-sm font-black uppercase text-white tracking-widest">Summary</h3>
              <div className="space-y-2 text-sm font-mono">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Subtotal</span>
                  <span>LKR {totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Discount</span>
                  <span className="text-orange-400">LKR {totals.totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-emerald-500/60 font-black uppercase tracking-widest pt-1">
                  <span>Gross Profit</span>
                  <span>LKR {totals.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-black text-white pt-2 border-t border-white/10">
                  <span>Total</span>
                  <span>LKR {totals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Enterprise Feature: Auto WhatsApp Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 mb-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="text-blue-400" size={14} />
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Auto WhatsApp</span>
                </div>
                <button
                  onClick={() => {
                    const newVal = !autoSendWA;
                    setAutoSendWA(newVal);
                    localStorage.setItem('pos_auto_wa', String(newVal));
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${autoSendWA ? 'bg-blue-600' : 'bg-white/10'}`}
                >
                  <span className={`pointer-events-none block h-3 w-3 rounded-full bg-white shadow-lg ring-0 transition-transform ${autoSendWA ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="pt-4 space-y-3">
                <div className="relative">
                  <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <GlassInput
                    type="number"
                    value={cashReceived}
                    onChange={e => setCashReceived(e.target.value === '' ? '' : toNum(e.target.value))}
                    placeholder="Cash Received..."
                    className="w-full pl-12 text-lg font-mono"
                  />
                </div>
                <div className="flex justify-between items-center text-xl font-black font-mono text-emerald-400 p-4 rounded-2xl bg-emerald-500/10">
                  <span>Change</span>
                  <span>LKR {totals.change.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {posMode === 'SALE' && (totals.total > toNum(cashReceived)) &&
                <div className="relative pt-2">
                  <label className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-2 block">Loan Due Date (Optional)</label>
                  <GlassInput type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full" />
                </div>
              }
            </div>

            <div className="p-4 border-t border-white/5 space-y-2 bg-black/20">
              <button
                onClick={handleCheckout}
                disabled={isSaving || cart.length === 0}
                className={`w-full p-5 rounded-2xl font-black text-sm uppercase transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${posMode === 'RETURN' ? 'bg-orange-600 hover:bg-orange-500 text-white tracking-[0.3em] pl-[0.3em]' : 'bg-blue-600 hover:bg-blue-500 text-white tracking-[0.3em] pl-[0.3em]'}`}>
                {isSaving ? <Loader2 size={20} className="animate-spin" /> : (posMode === 'SALE' ? <Check size={20} /> : <RotateCcw size={20} />)}
                {posMode === 'SALE' ? 'Authorize Sale' : 'Confirm Return'}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setCart([])} className="w-full p-3 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-bold uppercase hover:bg-red-500 hover:text-white transition-all tracking-[0.3em] pl-[0.3em]">Empty Cart</button>
                <button onClick={() => setPosMode(m => m === 'SALE' ? 'RETURN' : 'SALE')} className={`w-full p-3 rounded-lg text-[10px] font-bold uppercase transition-all tracking-[0.3em] pl-[0.3em] ${posMode === 'RETURN' ? 'bg-orange-500/20 text-orange-300' : 'bg-white/5 text-gray-400'}`}>Return Mode</button>
              </div>
            </div>
          </GlassCard>
        </div>

      </div>

      {showQuickCust &&
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <GlassCard className="w-full max-w-sm p-8">
            <h3 className="font-bold text-white text-lg mb-4">Create Customer</h3>
            <form onSubmit={handleQuickCustomer} className="space-y-4">
              <GlassInput value={quickCustForm.name} onChange={e => setQuickCustForm(s => ({ ...s, name: e.target.value }))} placeholder="Customer Name" />
              <GlassInput value={quickCustForm.phone} onChange={e => setQuickCustForm(s => ({ ...s, phone: e.target.value }))} placeholder="WhatsApp Number (Optional)" />
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 p-3 bg-blue-600 text-white rounded-lg">Save</button>
                <button type="button" onClick={() => setShowQuickCust(false)} className="flex-1 p-3 bg-white/10 text-white rounded-lg">Cancel</button>
              </div>
            </form>
          </GlassCard>
        </div>
      }

      {showManualService &&
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <GlassCard className="w-full max-w-sm p-8">
            <h3 className="font-bold text-white text-lg mb-4">Add Manual Service/Item</h3>
            <form onSubmit={handleAddServiceItem} className="space-y-4">
              <GlassInput value={serviceForm.name} onChange={e => setServiceForm(s => ({ ...s, name: e.target.value }))} placeholder="Service/Item Name" />
              <GlassInput type="number" value={serviceForm.price} onChange={e => setServiceForm(s => ({ ...s, price: e.target.value }))} placeholder="Price (LKR)" />
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 p-3 bg-blue-600 text-white rounded-lg">Add to Cart</button>
                <button type="button" onClick={() => setShowManualService(false)} className="flex-1 p-3 bg-white/10 text-white rounded-lg">Cancel</button>
              </div>
            </form>
          </GlassCard>
        </div>
      }
    </div>
  );
};
