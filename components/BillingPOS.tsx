
import {
  Check, Loader2, Printer, ShoppingCart, Trash, UserCheck, X,
  Barcode, Smartphone, Search, Plus, RotateCcw,
  PenTool, CreditCard, Banknote, UserPlus, Info, Receipt,
  Minus, PlusCircle, AlertCircle, FileDown, ArrowLeft, RotateCw, Send, QrCode,
  Scan, Package, PackagePlus, DollarSign, Truck
} from 'lucide-react';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { db, generateId } from '../services/mockDb';
import { whatsappService } from '../services/whatsapp';
import { autoSendWhatsAppBill } from '../services/whatsappAutoSend';
import { pdfService } from '../services/pdfService';
import { Bill, BillItem, BusinessSettings, Customer, Product } from '../types';
import { GlassCard } from './ui/GlassCard';
import { GlassInput } from './ui/GlassInput';
import { audioService } from '../services/audio';
import { useAuth } from '../context/AuthContext';

const toNum = (val: any) => { const n = Number(val); return isNaN(n) ? 0 : n; };
const round2 = (n: number) => Math.round(n * 100) / 100;
const printCopyRateForPages = (pages: number) => {
  if (pages <= 1) return 20;
  if (pages <= 10) return 15;
  if (pages <= 50) return 10;
  return 8;
};

const addWarrantyPeriod = (start: Date, amount = 0, unit: 'MONTHS' | 'YEARS' = 'YEARS') => {
  const end = new Date(start);
  if (unit === 'MONTHS') end.setMonth(end.getMonth() + amount);
  else end.setFullYear(end.getFullYear() + amount);
  return end.toISOString();
};

const parseProductScanValue = (value: string) => {
  const raw = value.trim();
  if (!raw) return { raw: '' };

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type === 'WR_PRODUCT') {
      return {
        raw,
        id: String(parsed.id || ''),
        sku: String(parsed.sku || ''),
        barcode: String(parsed.barcode || '')
      };
    }
  } catch {
    // Normal barcode/SKU scanners send plain text.
  }

  return { raw };
};

const warrantyPeriodOptions = [
  { label: '3M', years: 3, unit: 'MONTHS' as const },
  { label: '6M', years: 6, unit: 'MONTHS' as const },
  { label: '1Y', years: 1, unit: 'YEARS' as const },
  { label: '2Y', years: 2, unit: 'YEARS' as const }
];

const CartItemMemo = React.memo(({ item, idx, onUpdateQty, onRemove, onUpdateDiscount, onUpdateDiscountType, onUpdateWarranty, isReturnMode }: any) => {
  // Find product for image
  const [productData, setProductData] = useState<Product | null>(null);
  
  useEffect(() => {
    if (item.productId && !item.productId.startsWith('manual') && !item.productId.startsWith('SERVICE')) {
        db.products.get(item.productId).then(p => setProductData(p || null));
    }
  }, [item.productId]);

  const price = toNum(item.price);
  const qty = toNum(item.quantity);
  const warrantyPrice = item.warranty ? toNum(item.warrantyPrice) : 0;
  const unitPrice = price + warrantyPrice;
  const lineGross = unitPrice * qty;
  const discountVal = toNum(item.discountValue);
  const totalLineDiscount = item.discountType === 'PERCENTAGE' 
    ? (lineGross * (discountVal / 100)) 
    : discountVal;
  
  const lineTotal = Math.max(0, lineGross - totalLineDiscount);

  return (
    <div className={`group animate-in slide-in-from-left duration-200 rounded-2xl border transition-all ${isReturnMode ? 'bg-orange-500/5 border-orange-500/15' : 'bg-white/[0.045] border-white/5 hover:bg-blue-600/[0.06] hover:border-blue-500/20'}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 px-3 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 shrink-0 overflow-hidden flex items-center justify-center">
            {productData?.imageUrl ? (
              <img src={productData.imageUrl} className="w-full h-full object-cover" />
            ) : (
              <Package size={15} className="text-blue-400 opacity-45" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black text-white uppercase truncate leading-tight">{item.name}</p>
            <p className="text-[8px] text-blue-300/70 font-mono font-bold tracking-widest truncate">
              {item.sku || 'N/A'} {isReturnMode && (item as any).maxReturnQty ? `- returnable ${(item as any).maxReturnQty}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center bg-black/50 rounded-lg px-1 border border-white/10 h-9">
          <button onClick={() => onUpdateQty(idx, -1)} className="h-7 w-7 flex items-center justify-center text-gray-500 hover:text-white transition-colors" title="Decrease quantity">
            <Minus size={13} />
          </button>
          <input
            type="number"
            min="0"
            step="1"
            value={item.quantity}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val)) {
                onUpdateQty(idx, val - item.quantity);
              }
            }}
            className="w-10 bg-transparent text-center text-xs font-black text-white border-0 focus:ring-1 focus:ring-blue-500 rounded p-0.5 outline-none appearance-none"
            style={{ MozAppearance: 'textfield' }}
          />
          <button onClick={() => onUpdateQty(idx, 1)} className="h-7 w-7 flex items-center justify-center text-gray-500 hover:text-white transition-colors" title="Increase quantity">
            <Plus size={13} />
          </button>
        </div>

        <div className="text-right min-w-[5.5rem]">
          <p className="text-[8px] text-slate-500 font-mono">LKR {unitPrice.toLocaleString()}</p>
          <p className="text-[12px] font-black text-white font-mono leading-tight">{isReturnMode ? '-' : ''}LKR {lineTotal.toLocaleString()}</p>
        </div>

        <button onClick={() => onRemove(idx)} className="h-9 w-9 flex items-center justify-center text-red-500/45 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Remove item">
          <Trash size={14} />
        </button>
      </div>

      {!isReturnMode && (
        <div className="px-3 pb-2 space-y-2">
          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_3.25rem] items-center gap-2">
            <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Discount</span>
            <input
              type="number"
              value={item.discountValue || ''}
              onChange={e => onUpdateDiscount(idx, toNum(e.target.value))}
              className="min-w-0 bg-black/35 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-orange-300 focus:border-orange-500 outline-none"
              placeholder={item.discountType === 'PERCENTAGE' ? "Enter %" : "Enter LKR"}
            />
            <button
              onClick={() => onUpdateDiscountType(idx, item.discountType === 'PERCENTAGE' ? 'FIXED' : 'PERCENTAGE')}
              className={`h-8 rounded-lg text-[9px] font-black border transition-all ${item.discountType === 'PERCENTAGE' ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'bg-blue-500/20 border-blue-500/40 text-blue-300'}`}
            >
              {item.discountType === 'PERCENTAGE' ? '%' : 'LKR'}
            </button>
          </div>

          {!String(item.productId || '').startsWith('SERVICE') && (
            <div className={`rounded-xl border p-2 ${item.warranty ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-white/5 border-white/10'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateWarranty(idx, { warranty: !item.warranty })}
                  className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wide border ${item.warranty ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-black/20 text-slate-400 border-white/10'}`}
                >
                  {item.warranty ? 'Warranty On' : 'Warranty Off'}
                </button>
                <span className="text-[8px] font-black uppercase tracking-wide text-slate-400">
                  {toNum(item.warrantyYears) || 1} {item.warrantyUnit || 'YEARS'} {warrantyPrice > 0 ? `+ LKR ${warrantyPrice.toLocaleString()}` : ''}
                </span>
              </div>
              {item.warranty && (
                <div className="space-y-2 mt-2">
                  <div className="grid grid-cols-4 gap-1">
                    {warrantyPeriodOptions.map(option => {
                      const active = toNum(item.warrantyYears) === option.years && (item.warrantyUnit || 'YEARS') === option.unit;
                      return (
                        <button
                          key={`${option.years}-${option.unit}`}
                          type="button"
                          onClick={() => onUpdateWarranty(idx, { warrantyYears: option.years, warrantyUnit: option.unit })}
                          className={`py-1.5 rounded-lg text-[8px] font-black uppercase border ${active ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-black/25 text-slate-400 border-white/10'}`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <input
                      value={item.serialNumber || ''}
                      onChange={e => onUpdateWarranty(idx, { serialNumber: e.target.value })}
                      placeholder="Serial / IMEI before sale"
                      className="min-w-0 bg-black/35 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white focus:border-emerald-400 outline-none"
                    />
                    <span className="px-3 py-2 rounded-lg bg-black/25 border border-white/10 text-[8px] font-black text-emerald-300 uppercase whitespace-nowrap">
                      Exp: {item.warrantyEndDate ? new Date(item.warrantyEndDate).toLocaleDateString() : 'After sale'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export const BillingPOS: React.FC = () => {
  const { user } = useAuth();
  const [posMode, setPosMode] = useState<'SALE' | 'RETURN'>('SALE');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | any>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);

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
  const [billDiscount, setBillDiscount] = useState<number | ''>('');

  const [showQuickCust, setShowQuickCust] = useState(false);
  const [quickCustForm, setQuickCustForm] = useState({ name: '', phone: '' });
  const [showManualService, setShowManualService] = useState(false);
  const [serviceForm, setServiceForm] = useState({ type: 'Photocopy', side: 'Single Side', pages: '1', rate: '20' });
  const [showReloadService, setShowReloadService] = useState(false);
  const [reloadForm, setReloadForm] = useState({ operator: 'Dialog', phone: '', amount: '100', commission: '0' });
  const [dueDate, setDueDate] = useState<string>('');
  const [showCheckoutMobile, setShowCheckoutMobile] = useState(false);

  const [autoSendWA, setAutoSendWA] = useState(() => localStorage.getItem('pos_auto_wa') !== 'false');
  const [waSending, setWASending] = useState(false);
  const [invoiceWASending, setInvoiceWASending] = useState(false);
  const [isSavingRequest, setIsSavingRequest] = useState(false);
  const [showReturnItems, setShowReturnItems] = useState(false);
  const [bills, setBills] = useState<Bill[]>([]);
  const [billSearch, setBillSearch] = useState('');
  const [selectedBillForReturn, setSelectedBillForReturn] = useState<Bill | null>(null);
  const [returnWASent, setReturnWASent] = useState(false);

  // Barcode scanning states
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [showManualProduct, setShowManualProduct] = useState(false);
  const [manualProductForm, setManualProductForm] = useState({ name: '', sku: '', costPrice: '', sellPrice: '', quantity: '' });
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const customerSearchRef = useRef<HTMLDivElement>(null);
  const productSearchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const newSaleBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (productSearchRef.current && !productSearchRef.current.contains(target)) {
        setShowProductDropdown(false);
      }

      if (customerSearchRef.current && !customerSearchRef.current.contains(target)) {
        setShowCustomerDropdown(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (successBill && newSaleBtnRef.current) {
      newSaleBtnRef.current.focus();
    } else {
      // Auto-focus search for barcode scanner readiness
      searchInputRef.current?.focus();
    }
  }, [successBill]);

  // ─── Keyboard Shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // F1: Focus Search
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }

      // F2: Checkout
      if (e.key === 'F2') {
        if (cart.length > 0 && !successBill && !isSaving) {
          e.preventDefault();
          handleCheckout();
        }
      }

      // F3: New Sale / Clear
      if (e.key === 'F3') {
        e.preventDefault();
        setCart([]);
        setSuccessBill(null);
        setSearch('');
        setCashReceived('');
        setSelectedCustomerId('');
        searchInputRef.current?.focus();
      }

      // Escape: Close dropdowns
      if (e.key === 'Escape') {
        setShowProductDropdown(false);
        setShowCustomerDropdown(false);
        setShowQuickCust(false);
        setShowManualService(false);
        setShowReloadService(false);
        setShowCheckoutMobile(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [cart, successBill, isSaving]);

  const loadData = async () => {
    const [p, c, s, b] = await Promise.all([db.products.getAll(), db.customers.getAll(), db.settings.get(), db.bills.getAll()]);
    setProducts(p); setCustomers(c); setSettings(s); setBills(b);
  };

  const selectedCustomer = useMemo(
    () => customers.find(c => String(c.id) === String(selectedCustomerId)) || null,
    [customers, selectedCustomerId]
  );

  const totals = useMemo(() => {
    let totalDiscount = 0;
    let subtotal = 0;
    let totalProfit = 0;

    cart.forEach(i => {
      const price = toNum(i.price);
      const cost = toNum(i.cost);
      const qty = toNum(i.quantity);
      const discVal = toNum(i.discountValue);
      
      const warrantyPrice = i.warranty ? toNum(i.warrantyPrice) : 0;
      const lineGross = (price + warrantyPrice) * qty;
      const lineDiscount = i.discountType === 'PERCENTAGE' 
        ? (lineGross * (discVal / 100)) 
        : discVal;
      
      const warrantyCost = i.warranty ? toNum(i.warrantyCost) : 0;
      const lineProfit = lineGross - lineDiscount - ((cost + warrantyCost) * qty);

      subtotal += lineGross;
      totalDiscount += lineDiscount;
      totalProfit += lineProfit;
    });

    const netTotal = Math.max(0, subtotal - totalDiscount - toNum(billDiscount));
    const received = cashReceived === '' ? 0 : toNum(cashReceived);
    return {
      subtotal: round2(subtotal),
      total: round2(netTotal),
      totalDiscount: round2(totalDiscount + toNum(billDiscount)),
      totalProfit: round2(totalProfit - toNum(billDiscount)),
      change: round2(Math.max(0, received - netTotal))
    };
  }, [cart, cashReceived, billDiscount]);

  const handleCheckout = async () => {
    if (cart.length === 0 || isSaving) return;

    if (posMode === 'RETURN') {
      const invalidReturn = cart.find(item => {
        const maxQty = toNum((item as any).maxReturnQty || item.quantity);
        return toNum(item.quantity) <= 0 || toNum(item.quantity) > maxQty;
      });

      if (invalidReturn) {
        alert(`Return quantity for ${invalidReturn.name} is not valid.`);
        return;
      }

      if (!confirm(`Confirm Refund of LKR ${totals.total.toLocaleString()}?`)) return;
      setIsSaving(true);
      try {
        for (const item of cart) {
          if (item.billId && item.lineId) {
            await db.bills.returnItem(item.billId, item.lineId, item.quantity);
          } else {
            // Unlinked return logic
            await db.bills.returnUnlinkedItem(
              item.productId,
              item.quantity,
              toNum(item.price),
              toNum(item.cost),
              'CASH',
              selectedCustomerId || undefined
            );
          }
        }
        setSuccessBill({ id: 'return-ok', invoiceNumber: 'RETURN-OK' } as any);
        setCart([]); setSelectedCustomerId(''); setCashReceived(''); setCustomerSearch(''); setDueDate('');
        await loadData();
      } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
      return;
    }

    const actualPaid = cashReceived === '' ? 0 : toNum(cashReceived);
    if (totals.total - actualPaid > 0.01 && !selectedCustomerId) {
      alert("Please assign a customer for credit sales."); return;
    }

    if (!confirm(`Confirm sale for LKR ${totals.total.toLocaleString()}?`)) return;

    setIsSaving(true);
    try {
      const customer = customers.find(c => String(c.id) === String(selectedCustomerId));
      const isLoan = totals.total - actualPaid > 0.01;

      const bill: Bill = {
        id: generateId(),
        invoiceNumber: `INV-${Date.now().toString().slice(-8).toUpperCase()}`,
        date: new Date().toISOString(),
        customerId: selectedCustomerId || null,
        customerName: customer ? customer.name : 'CASH SALE',
        items: cart.map(i => ({ ...i, lineId: generateId() })),
        subtotal: totals.subtotal,
        totalCost: round2(cart.reduce((sum, i) => sum + ((toNum(i.cost) + (i.warranty ? toNum(i.warrantyCost) : 0)) * toNum(i.quantity)), 0)),
        totalProfit: totals.totalProfit,
        discount: totals.totalDiscount,
        total: totals.total,
        cashReceived: actualPaid,
        changeReturned: totals.change,
        paymentType: isLoan ? 'LOAN' : 'CASH',
        dueDate: isLoan ? dueDate || undefined : undefined
      };

      await db.bills.create(bill);
      audioService.playSuccess();

      // Fire and forget WhatsApp to not block checkout
      if (autoSendWA && customer) {
        autoSendWhatsAppBill(bill, customer, settings).catch(e => console.error("WA Background Error", e));
      }

      setSuccessBill(bill);
      setCart([]); setCashReceived(''); setSelectedCustomerId(''); setCustomerSearch(''); setDueDate(''); setBillDiscount('');

      // Load data in background
      loadData().catch(e => console.error("Load Data Error", e));
    } catch (e: any) { alert("POS Failure: " + e.message); } finally { setIsSaving(false); }
  };

  const handleQuickCustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustForm.name || !quickCustForm.phone) return;
    setIsSaving(true);
    try {
      // Ensure required fields are present with sensible defaults
      const id = await db.customers.add({
        name: quickCustForm.name,
        phone: quickCustForm.phone,
        language: 'en',
        balanceDue: 0,
        totalLoan: 0,
        totalPaid: 0,
        address: '',
        nic: ''
      });
      await loadData();
      const newCust = ((await db.customers.getAll()) as Customer[]).find((cust: Customer) => String(cust.id) === String(id));
      if (newCust) {
        setSelectedCustomerId(String(newCust.id));
        setCustomerSearch(newCust.name);
      }
      setShowQuickCust(false);
      setQuickCustForm({ name: '', phone: '' });
      setShowCustomerDropdown(false);
    } catch (err: any) {
      alert("Failed to add customer: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const addToCart = (product: Product) => {
    audioService.playBeep();
    setCart(prev => {
      const existing = prev.find(i => i.productId === String(product.id));
      if (existing) return prev.map(i => i.productId === String(product.id) ? { ...i, quantity: i.quantity + 1 } : i);
      const warranty = Boolean(product.hasWarranty);
      const warrantyStartDate = warranty ? new Date().toISOString() : undefined;
      return [...prev, {
        productId: String(product.id),
        name: product.name,
        sku: product.sku || 'N/A',
        quantity: 1,
        cost: toNum(product.cost),
        price: toNum(product.price),
        profit: toNum(product.price) - toNum(product.cost),
        discountValue: 0,
        discountType: 'FIXED',
        warranty,
        warrantyYears: toNum(product.warrantyYears),
        warrantyUnit: product.warrantyUnit || 'YEARS',
        warrantyPrice: toNum(product.warrantyPrice),
        warrantyCost: toNum(product.warrantyCost),
        warrantyStartDate,
        warrantyEndDate: warranty ? addWarrantyPeriod(new Date(warrantyStartDate as string), toNum(product.warrantyYears), product.warrantyUnit || 'YEARS') : undefined
      } as BillItem];
    });
    setSearch('');
    setShowProductDropdown(false);
    // Maintain focus for next scan
    searchInputRef.current?.focus();
  };

  const saveCustomerItemRequest = async () => {
    const itemName = search.trim();
    if (!itemName || isSavingRequest) return;
    setIsSavingRequest(true);
    try {
      const customer = customers.find(c => String(c.id) === String(selectedCustomerId));
      await db.productRequests.add({
        itemName,
        quantity: 1,
        customerId: customer?.id || null,
        customerName: customer?.name || customerSearch || 'Walk-in Customer',
        customerPhone: customer?.phone || '',
        note: `Requested from POS search: ${itemName}`,
        status: 'OPEN'
      });
      setSearch('');
      setShowProductDropdown(false);
      alert('Customer item request saved for next supplier order.');
    } catch (e: any) {
      alert(`Failed to save request: ${e.message || e}`);
    } finally {
      setIsSavingRequest(false);
    }
  };

  const updateCartQty = (idx: number, delta: number) => {
    setCart(prev => prev.map((item, i) => {
      if (i === idx) {
        const maxQty = posMode === 'RETURN' && (item as any).maxReturnQty ? toNum((item as any).maxReturnQty) : Number.POSITIVE_INFINITY;
        const newQty = Math.min(maxQty, Math.max(1, item.quantity + delta));
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const updateCartDiscount = (idx: number, val: number) => {
    setCart(prev => prev.map((item, i) => (i === idx ? { ...item, discountValue: val } : item)));
  };

  const updateCartDiscountType = (idx: number, type: 'FIXED' | 'PERCENTAGE') => {
    setCart(prev => prev.map((item, i) => (i === idx ? { ...item, discountType: type } : item)));
  };

  const updateCartWarranty = (idx: number, patch: Partial<BillItem>) => {
    setCart(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const warranty = patch.warranty ?? item.warranty;
      const warrantyStartDate = item.warrantyStartDate || new Date().toISOString();
      const warrantyYears = toNum(patch.warrantyYears ?? item.warrantyYears) || 1;
      const warrantyUnit = patch.warrantyUnit || item.warrantyUnit || 'YEARS';
      const warrantyEndDate = warranty
        ? addWarrantyPeriod(new Date(warrantyStartDate), warrantyYears, warrantyUnit)
        : undefined;

      return {
        ...item,
        ...patch,
        warranty,
        warrantyYears,
        warrantyUnit,
        warrantyStartDate: warranty ? warrantyStartDate : undefined,
        warrantyEndDate
      };
    }));
  };

  // Barcode / QR scanning handler
  const handleBarcodeInput = (barcode: string) => {
    const scan = parseProductScanValue(barcode);
    if (!scan.raw) return;
    const rawLower = scan.raw.toLowerCase();
    const product = products.find(p =>
      (scan.id && String(p.id) === scan.id) ||
      (scan.sku && String(p.sku || '').toLowerCase() === scan.sku.toLowerCase()) ||
      (scan.barcode && String(p.barcode || '').toLowerCase() === scan.barcode.toLowerCase()) ||
      String(p.sku || '').toLowerCase() === rawLower ||
      String(p.barcode || '').toLowerCase() === rawLower
    );
    if (product) {
      addToCart(product);
      setBarcodeInput('');
      setShowBarcodeScanner(false);
    } else {
      alert(`Product with code ${scan.raw} not found. Add it manually?`);
      setBarcodeInput('');
    }
  };

  // Manual product entry
  const addManualProduct = async () => {
    const { name, sku, costPrice, sellPrice, quantity } = manualProductForm;
    if (!name || !costPrice || !sellPrice || !quantity) {
      alert('Please fill all fields');
      return;
    }

    const item: BillItem = {
      productId: 'manual-' + Date.now(),
      name: name,
      sku: sku || 'MANUAL',
      quantity: parseInt(quantity),
      cost: toNum(costPrice),
      price: toNum(sellPrice),
      profit: toNum(sellPrice) - toNum(costPrice),
      discountValue: 0,
      discountType: 'FIXED',
      warranty: false
    };

    setCart(prev => [...prev, item]);
    setManualProductForm({ name: '', sku: '', costPrice: '', sellPrice: '', quantity: '' });
    setShowManualProduct(false);
  };

  const resetPrintCopyService = () => {
    setServiceForm({ type: 'Photocopy', side: 'Single Side', pages: '1', rate: '20' });
  };

  const updatePrintCopyPages = (value: string) => {
    const sheets = Math.max(1, Math.floor(toNum(value)));
    const billablePages = sheets * (serviceForm.side === 'Double Side' ? 2 : 1);
    setServiceForm(prev => ({
      ...prev,
      pages: value,
      rate: billablePages ? String(printCopyRateForPages(billablePages)) : prev.rate
    }));
  };

  const updatePrintCopySide = (side: string) => {
    const sheets = Math.max(1, Math.floor(toNum(serviceForm.pages)));
    const billablePages = sheets * (side === 'Double Side' ? 2 : 1);
    setServiceForm(prev => ({
      ...prev,
      side,
      rate: String(printCopyRateForPages(billablePages))
    }));
  };

  const addPrintCopyService = () => {
    const sheets = Math.max(1, Math.floor(toNum(serviceForm.pages)));
    const billablePages = sheets * (serviceForm.side === 'Double Side' ? 2 : 1);
    const rate = toNum(serviceForm.rate);
    if (!sheets || rate <= 0) {
      alert('Please enter sheet count and rate.');
      return;
    }

    const type = serviceForm.type || 'Photocopy';
    const item: BillItem = {
      productId: `SERVICE-${type.toUpperCase()}-${Date.now()}`,
      name: `${type} ${serviceForm.side} (${sheets} sheet${sheets === 1 ? '' : 's'} / ${billablePages} page${billablePages === 1 ? '' : 's'} @ LKR ${rate})`,
      sku: 'PRINT-COPY',
      quantity: billablePages,
      cost: 0,
      price: rate,
      profit: rate,
      warranty: false,
      discountValue: 0,
      discountType: 'FIXED'
    };

    setCart(prev => [...prev, item]);
    audioService.playBeep();
    resetPrintCopyService();
    setShowManualService(false);
  };

  const resetReloadService = () => {
    setReloadForm({ operator: 'Dialog', phone: '', amount: '100', commission: '0' });
  };

  const addReloadService = () => {
    const operator = reloadForm.operator || 'Dialog';
    const phone = reloadForm.phone.trim();
    const amount = toNum(reloadForm.amount);
    const commission = Math.min(Math.max(0, toNum(reloadForm.commission)), amount);

    if (!phone || amount <= 0) {
      alert('Please enter mobile number and reload amount.');
      return;
    }

    const item: BillItem = {
      productId: `SERVICE-RELOAD-${operator.toUpperCase()}-${Date.now()}`,
      name: `${operator} Reload (${phone})`,
      sku: 'RELOAD',
      quantity: 1,
      cost: amount - commission,
      price: amount,
      profit: commission,
      warranty: false,
      discountValue: 0,
      discountType: 'FIXED'
    };

    setCart(prev => [...prev, item]);
    audioService.playBeep();
    resetReloadService();
    setShowReloadService(false);
  };

  const removeFromCart = (idx: number) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
  };

  const addReturnItemsFromBill = (bill: Bill) => {
    const billDate = new Date(bill.date);
    const diffDays = (new Date().getTime() - billDate.getTime()) / (1000 * 3600 * 24);
    
    if (diffDays > (settings?.returnDaysLimit || 3)) {
      if (!confirm(`Warning: This invoice is ${Math.floor(diffDays)} days old, exceeding the 3-day return policy. Do you still want to proceed with the return?`)) {
        return;
      }
    }

    const returnableItems = bill.items
      .map(i => {
        const remainingQty = Math.max(0, toNum(i.quantity) - toNum(i.returnedQty));
        return {
          ...i,
          billId: bill.id,
          quantity: remainingQty,
          maxReturnQty: remainingQty,
          originalSoldQty: i.quantity
        } as BillItem & { maxReturnQty: number; originalSoldQty: number };
      })
      .filter(i => i.quantity > 0);

    if (returnableItems.length === 0) {
      alert('All items on this invoice have already been returned.');
      return;
    }

    setPosMode('RETURN');
    setCart(returnableItems);
    setSelectedCustomerId(bill.customerId || '');
    setShowReturnItems(false);
    setSelectedBillForReturn(bill);
    setReturnWASent(false);
  };

  const sendReturnWhatsApp = async () => {
    if (cart.length === 0 || !selectedBillForReturn) return;
    setWASending(true);
    try {
      const customer = customers.find(c => String(c.id) === String(selectedCustomerId));
      if (!customer) { alert('Please select a customer'); setWASending(false); return; }

      const returnSummary = {
        id: 'RETURN-' + Date.now().toString().slice(-8).toUpperCase(),
        invoiceNumber: 'RETURN-' + selectedBillForReturn.invoiceNumber,
        date: new Date().toISOString(),
        customerId: customer.id,
        customerName: customer.name,
        items: cart,
        subtotal: totals.total,
        total: totals.total,
        originalBill: selectedBillForReturn.invoiceNumber
      } as any;

      await autoSendWhatsAppBill(returnSummary, customer, settings);
      setReturnWASent(true);
      alert('Return receipt sent via WhatsApp!');
    } catch (e: any) {
      alert('Failed to send WhatsApp: ' + e.message);
    } finally {
      setWASending(false);
    }
  };

  const sendInvoiceWhatsApp = async (bill: Bill) => {
    const customer = customers.find(c => String(c.id) === String(bill.customerId));
    if (!customer?.phone) {
      alert('This bill needs a customer with phone number.');
      return;
    }

    setInvoiceWASending(true);
    try {
      const url = await pdfService.generateInvoice(bill, settings, customer);
      setInvoiceUrl(url);
      await whatsappService.sendBillTemplate(settings, customer, bill, { invoiceUrl: url });
      alert('Invoice PDF link sent to WhatsApp.');
    } catch (e: any) {
      alert('Failed to send invoice to WhatsApp: ' + e.message);
    } finally {
      setInvoiceWASending(false);
    }
  };

  const printBillWithQR = (bill: Bill) => {
    const qrValue = `INV:${bill.invoiceNumber}|TOTAL:${bill.total}|DATE:${new Date(bill.date).toLocaleDateString()}`;
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bill Receipt - ${bill.invoiceNumber}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Courier New', monospace;
            padding: 20px;
            background: white;
            color: #000;
          }
          .receipt {
            max-width: 400px;
            margin: 0 auto;
            border: 2px solid #000;
            padding: 20px;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
          }
          .header h1 {
            font-size: 20px;
            font-weight: bold;
          }
          .invoice-no {
            font-weight: bold;
            margin: 10px 0;
            font-size: 14px;
          }
          .customer-info {
            margin: 15px 0;
            font-size: 12px;
          }
          .items {
            margin: 20px 0;
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            padding: 10px 0;
            font-size: 11px;
          }
          .item-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .totals {
            margin-top: 15px;
          }
          .total-line {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            font-weight: bold;
            font-size: 14px;
          }
          .grand-total {
            text-align: right;
            font-size: 18px;
            font-weight: bold;
            margin-top: 15px;
            border-top: 2px solid #000;
            padding-top: 10px;
          }
          .qr-section {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #000;
          }
          .qr-code {
            width: 150px;
            height: 150px;
            display: inline-block;
            margin: 10px 0;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 11px;
            border-top: 2px solid #000;
            padding-top: 10px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h1>WR POS</h1>
            <p>SALES RECEIPT</p>
          </div>

          <div class="invoice-no">Invoice: ${bill.invoiceNumber}</div>
          <div class="customer-info">
            Date: ${new Date(bill.date).toLocaleString()}<br>
            Customer: ${bill.customerName || 'CASH SALE'}
          </div>

          <div class="items">
            <div style="font-weight: bold; display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #000;">
              <span>Item</span>
              <span>Qty × Price</span>
            </div>
            ${bill.items.map(item => `
              <div class="item-row">
                <span>${item.name} (x${item.quantity})</span>
                <span>LKR ${(item.quantity * item.price).toLocaleString()}</span>
              </div>
            `).join('')}
          </div>

          <div class="totals">
            <div class="total-line">
              <span>Subtotal:</span>
              <span>LKR ${bill.subtotal.toLocaleString()}</span>
            </div>
            ${bill.discount > 0 ? `
              <div class="total-line">
                <span>Discount:</span>
                <span>-LKR ${bill.discount.toLocaleString()}</span>
              </div>
            ` : ''}
            <div class="grand-total">
              TOTAL: LKR ${bill.total.toLocaleString()}
            </div>
            <div class="total-line">
              <span>Paid:</span>
              <span>LKR ${(bill.cashReceived || 0).toLocaleString()}</span>
            </div>
            ${(bill.changeReturned || 0) > 0 ? `
              <div class="total-line">
                <span>Change:</span>
                <span>LKR ${(bill.changeReturned || 0).toLocaleString()}</span>
              </div>
            ` : ''}
          </div>

          <div class="qr-section">
            <p style="font-size: 10px; margin-bottom: 10px;">Scan to verify</p>
            <div id="qrcode" class="qr-code"></div>
            <p style="font-size: 10px; margin-top: 10px;">${qrValue}</p>
          </div>

          <div class="footer">
            <p>Thank you for your purchase!</p>
            <p>WR Smile Supplies • v6.0</p>
            <p>${new Date().toLocaleString()}</p>
          </div>
        </div>

        <script>
          new QRCode(document.getElementById("qrcode"), "${qrValue}");
          setTimeout(() => {
            window.print();
            window.close();
          }, 500);
        </script>
      </body>
      </html>
    `.replace('Qty Ã— Price', 'Qty x Price').replace('WR Smile Supplies â€¢ v6.0', 'WR Smile Supplies - v6.0'));
    printWindow.document.body.innerHTML = printWindow.document.body.innerHTML
      .replace(/Qty[^A-Za-z0-9]+Price/g, 'Qty x Price')
      .replace(/WR Smile Supplies[^A-Za-z0-9]+v6\.0/g, 'WR Smile Supplies - v6.0');
    printWindow.document.close();
  };

  const filteredProducts = useMemo(() => {
    if (!search) return [];

    const scan = parseProductScanValue(search);
    const searchText = scan.raw.toLowerCase();
    const filtered = products.filter(p =>
      (scan.id && String(p.id) === scan.id) ||
      (scan.sku && String(p.sku || '').toLowerCase() === scan.sku.toLowerCase()) ||
      (scan.barcode && String(p.barcode || '').toLowerCase() === scan.barcode.toLowerCase()) ||
      p.name.toLowerCase().includes(searchText) ||
      String(p.sku || '').toLowerCase().includes(searchText) ||
      String(p.barcode || '').toLowerCase().includes(searchText)
    );

    // Intelligent sorting: show low stock first (urgent)
    return filtered.sort((a, b) => {
      const stockA = a.stock || 0;
      const stockB = b.stock || 0;

      // Low stock first
      if ((stockA < 5 ? 1 : 0) !== (stockB < 5 ? 1 : 0)) {
        return (stockA < 5 ? -1 : 0) - (stockB < 5 ? -1 : 0);
      }

      // High profit margin second
      const profitA = (toNum(a.price) - toNum(a.cost)) || 0;
      const profitB = (toNum(b.price) - toNum(b.cost)) || 0;
      return profitB - profitA;
    }).slice(0, 12); // Show more results
  }, [search, products]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return [];

    const filtered = customers.filter(c =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone?.toLowerCase().includes(customerSearch.toLowerCase())
    );

    // Intelligent sorting: prioritize by balance status
    return filtered.sort((a, b) => {
      const balanceA = (a.balanceDue || 0);
      const balanceB = (b.balanceDue || 0);

      // High balance first (need to collect)
      if (balanceA !== balanceB) return balanceB - balanceA;

      // Then by name
      return a.name.localeCompare(b.name);
    }).slice(0, 12); // Show more results
  }, [customerSearch, customers]);

  const filteredBills = useMemo(() => {
    if (!billSearch) return bills.slice(0, 10);
    const search = billSearch.toLowerCase();
    return bills.filter(b =>
      b.invoiceNumber?.toLowerCase().includes(search) ||
      b.customerName?.toLowerCase().includes(search)
    ).slice(0, 10);
  }, [billSearch, bills]);

  const showProductResults = showProductDropdown && filteredProducts.length > 0;
  const showProductRequestPrompt = showProductDropdown && search.trim().length > 1 && filteredProducts.length === 0;
  const showCustomerResults = showCustomerDropdown && (filteredCustomers.length > 0 || customerSearch.length > 2);
  const printCopySheets = Math.max(1, Math.floor(toNum(serviceForm.pages)));
  const printCopyPages = printCopySheets * (serviceForm.side === 'Double Side' ? 2 : 1);
  const printCopyRate = toNum(serviceForm.rate);
  const printCopyTotal = round2(printCopyPages * printCopyRate);
  const reloadAmount = toNum(reloadForm.amount);
  const reloadCommission = Math.min(Math.max(0, toNum(reloadForm.commission)), reloadAmount);

  if (successBill) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <GlassCard className="w-full max-w-lg text-center p-8 sm:p-12 animate-in fade-in zoom-in-95">
          <div className="p-6 bg-emerald-500/10 rounded-full mb-6 inline-block">
            <Check size={48} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black uppercase text-white tracking-tight mb-2">Success</h2>
          <p className="text-xs text-slate-400 mb-8">{successBill.invoiceNumber} finalized.</p>
          <div className="grid grid-cols-1 gap-3">
            <button onClick={() => { setSuccessBill(null); setInvoiceUrl(null); }} className="w-full py-4 bg-blue-600 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">New Sale</button>
            <button onClick={() => printBillWithQR(successBill)} className="w-full py-4 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-purple-600 hover:text-white transition-all flex items-center justify-center gap-2">
              <QrCode size={16} /> Print with QR Code
            </button>
            <button onClick={async (e) => {
               const btn = e.currentTarget;
               btn.disabled = true;
               try {
                 const customer = customers.find(c => String(c.id) === String(successBill.customerId));
                 const url = await pdfService.generateInvoice(successBill, settings, customer);
                 setInvoiceUrl(url);
               } finally {
                 btn.disabled = false;
               }
            }} className="w-full py-4 bg-white/5 rounded-2xl text-white font-black text-xs uppercase tracking-widest border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2"><FileDown size={16} /> {invoiceUrl ? 'Regenerate PDF' : 'Download PDF'}</button>
            <button
              onClick={() => sendInvoiceWhatsApp(successBill)}
              disabled={invoiceWASending || !successBill.customerId}
              className="w-full py-4 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {invoiceWASending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {invoiceWASending ? 'Sending PDF...' : 'Send PDF To WhatsApp'}
            </button>
            
            {invoiceUrl && (
              <button 
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(invoiceUrl);
                    alert('Invoice URL copied to clipboard!');
                  } catch (e) {
                    console.warn('Clipboard failed, ignoring.');
                  }
                }}
                className="w-full py-4 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <Send size={16} /> Copy Invoice URL
              </button>
            )}
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 flex-1 relative">
      <div className="flex-1 flex flex-col lg:flex-row gap-5 min-h-0 relative overflow-visible">

        {/* Left Panel: Search & Cart */}
        <GlassCard className={`flex flex-col lg:flex-[1.3] min-h-0 border-blue-500/10 overflow-visible relative ${showProductResults ? 'z-[700]' : 'z-10'} ${showCheckoutMobile ? 'hidden lg:flex' : 'flex'}`} style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, rgba(139, 92, 246, 0.03) 100%)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}>
          <div className="p-5 border-b border-white/5 bg-black/10 overflow-visible">
            <div className="flex gap-3 mb-3 overflow-visible items-start">
              <div ref={productSearchRef} className="relative flex-1 overflow-visible">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200/45" size={18} />
                <GlassInput
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setShowProductDropdown(true); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      // If there's an exact barcode match or a filtered result, add it
                      if (filteredProducts.length > 0) {
                        addToCart(filteredProducts[0]);
                      } else {
                        handleBarcodeInput(search);
                      }
                    }
                  }}
                  onFocus={() => { if (filteredProducts.length > 0) setShowProductDropdown(true); }}
                  placeholder="Search (F1) / Scan Barcode or QR..."
                  className="w-full pl-12 h-14 rounded-[1.6rem] border-white/10 bg-white/5 shadow-[0_18px_40px_rgba(2,6,23,0.45)]"
                />
                {showProductResults && (
                  <div className="liquid-glass-popover absolute top-[calc(100%+12px)] left-0 w-full sm:max-w-[30rem] p-2.5 z-[9999] max-h-[22rem] overflow-y-auto animate-in slide-in-from-top-2 fade-in duration-300 custom-scrollbar">
                    <div className="flex items-center justify-between gap-3 px-2.5 pb-2.5">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-300">Inventory Match</p>
                        <p className="text-[10px] text-slate-400 mt-1">Quick product pick</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-black text-slate-300">
                        {filteredProducts.length} results
                      </span>
                    </div>
                    {filteredProducts.map(p => {
                      const cost = toNum(p.cost);
                      const price = toNum(p.price);
                      const profit = price - cost;
                      const profitMargin = cost > 0 ? Math.round((profit / cost) * 100) : 0;
                      const stock = p.stock || 0;
                      const isLowStock = stock < 5;

                      return (
                        <div
                          key={p.id}
                          onClick={() => addToCart(p)}
                          className={`liquid-glass-item p-3 mb-2 last:mb-0 rounded-[1.2rem] cursor-pointer transition-all border ${isLowStock
                            ? 'bg-orange-500/10 border-orange-400/25 hover:bg-orange-500/18'
                            : 'hover:bg-blue-500/10 border-blue-400/20'
                            }`}
                        >
                          <div className="flex items-start justify-between mb-2 gap-3">
                            <div className="flex-1 flex gap-2.5">
                              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex-shrink-0 overflow-hidden shadow-[0_10px_24px_rgba(59,130,246,0.14)]">
                                {p.imageUrl ? (
                                  <img src={p.imageUrl} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center opacity-40"><Package size={18} className="text-blue-400" /></div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13px] font-black text-white uppercase tracking-wide truncate">{p.name}</p>
                                <p className="text-[9px] text-gray-400 font-mono font-bold">SKU: {p.sku || 'N/A'}</p>
                              </div>
                            </div>
                            {isLowStock && (
                              <div className="text-right">
                                <p className="text-[8px] text-orange-400 font-black uppercase">LOW</p>
                              </div>
                            )}
                          </div>

                          {/* Stock & Pricing Info */}
                          <div className="flex gap-2.5 pt-2.5 border-t border-white/10 text-[11px]">
                            <div className="flex-1">
                              <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mb-1">Price</p>
                              <p className="font-black text-white font-mono">
                                {price.toLocaleString()}
                              </p>
                            </div>
                            <div className="flex-1">
                              <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mb-1">Stock</p>
                              <p className={`font-black font-mono ${isLowStock ? 'text-orange-400' : 'text-emerald-400'}`}>
                                {stock}
                              </p>
                            </div>
                            <div className="flex-1">
                              <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mb-1">Margin</p>
                              <p className="font-black text-blue-400 font-mono">
                                {profitMargin}%
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {showProductRequestPrompt && (
                  <div className="liquid-glass-popover fixed left-3 right-3 top-[7rem] sm:absolute sm:top-[calc(100%+12px)] sm:left-0 sm:right-auto sm:w-[min(26rem,calc(100vw-4rem))] p-3 z-[9999] animate-in slide-in-from-top-2 fade-in duration-300">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-300">Not in Stock</p>
                    <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                      Save "{search.trim()}" as a customer request and use it later in supplier orders.
                    </p>
                    <button
                      type="button"
                      onClick={saveCustomerItemRequest}
                      disabled={isSavingRequest}
                      className="mt-3 w-full py-3 bg-orange-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.22em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {isSavingRequest ? <Loader2 size={14} className="animate-spin" /> : <PackagePlus size={14} />}
                      Save Request
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => setShowBarcodeScanner(true)} className="p-3 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-xl hover:bg-purple-600 hover:text-white transition-all shadow-lg" title="Barcode Scanner">
                <Scan size={20} />
              </button>
              <button onClick={() => setShowManualService(true)} className="p-3 bg-sky-600/20 text-sky-300 border border-sky-500/30 rounded-xl hover:bg-sky-600 hover:text-white transition-all shadow-lg" title="Print / Photocopy">
                <Printer size={20} />
              </button>
              <button onClick={() => setShowReloadService(true)} className="p-3 bg-orange-600/20 text-orange-300 border border-orange-500/30 rounded-xl hover:bg-orange-600 hover:text-white transition-all shadow-lg" title="Mobile Reload">
                <Smartphone size={20} />
              </button>
              <button onClick={() => setShowManualProduct(true)} className="p-3 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-lg" title="Manual Product">
                <Plus size={20} />
              </button>
              <button onClick={() => setPosMode(m => m === 'SALE' ? 'RETURN' : 'SALE')} className={`p-3 rounded-xl border transition-all ${posMode === 'RETURN' ? 'bg-orange-600 border-orange-500' : 'bg-white/5 border-white/10'}`}>
                <RotateCcw size={20} className="text-white" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {cart.length > 0 && (
              <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_8rem_6rem_2.5rem] items-center gap-3 px-3 text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">
                <span>Product</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Total</span>
                <span />
              </div>
            )}
            {cart.map((item, idx) => (
              <CartItemMemo 
                key={item.productId} 
                item={item} 
                idx={idx} 
                onUpdateQty={updateCartQty} 
                onRemove={removeFromCart} 
                onUpdateDiscount={updateCartDiscount} 
                onUpdateDiscountType={updateCartDiscountType}
                onUpdateWarranty={updateCartWarranty}
                isReturnMode={posMode === 'RETURN'} 
              />
            ))}
            {cart.length === 0 && <div className="h-full flex flex-col items-center justify-center opacity-20"><ShoppingCart size={64} /><p className="font-black uppercase tracking-widest mt-4">Empty Cart</p></div>}
          </div>

          {/* Mobile Floating Checkout Button */}
          <div className="lg:hidden p-4 bg-[#0b1121] border-t border-white/10">
            <button onClick={() => setShowCheckoutMobile(true)} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex justify-between px-6">
              <span>View Summary</span>
              <span>LKR {totals.total.toLocaleString()}</span>
            </button>
          </div>
        </GlassCard>

        {/* Right Panel: Checkout (Slide up on mobile) */}
          <div className={`w-full lg:w-[390px] xl:w-[420px] flex flex-col gap-2.5 h-full lg:relative absolute inset-0 bg-[#020617] lg:bg-transparent p-3 lg:p-0 transition-transform duration-500 overflow-visible ${showCustomerResults ? 'z-[800]' : 'z-[500]'} ${showCheckoutMobile ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}`}>

          <button onClick={() => setShowCheckoutMobile(false)} className="lg:hidden mb-4 text-slate-400 flex items-center gap-2 font-black uppercase text-[10px] tracking-widest">
            <ArrowLeft size={16} /> Back to Cart
          </button>

          {/* Customer */}
          <GlassCard className="p-3 border-blue-500/10 relative overflow-visible z-[90]" style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(139, 92, 246, 0.05) 100%)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div>
                <h3 className="text-[9px] font-black uppercase text-white tracking-[0.12em]">Customer Assignment</h3>
                <p className="text-[8px] text-slate-500 mt-0.5">Search name or phone</p>
              </div>
              {selectedCustomerId && (
                <button
                  type="button"
                  onClick={() => { setSelectedCustomerId(''); setCustomerSearch(''); }}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[8px] font-black uppercase tracking-wide text-slate-300 hover:text-white hover:bg-white/10 transition-all"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-visible items-center">
              <div ref={customerSearchRef} className="relative flex-1 overflow-visible">
                <UserCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-200/55 z-10" size={15} />
                <GlassInput
                  value={customerSearch}
                  onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); setSelectedCustomerId(''); }}
                  onFocus={() => { if (filteredCustomers.length > 0 || customerSearch.length > 2) setShowCustomerDropdown(true); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && showCustomerDropdown) {
                      e.preventDefault();
                      if (filteredCustomers.length > 0) {
                        setSelectedCustomerId(String(filteredCustomers[0].id));
                        setCustomerSearch(filteredCustomers[0].name);
                        setShowCustomerDropdown(false);
                      } else if (customerSearch.length > 2) {
                        setQuickCustForm({ name: '', phone: customerSearch.replace(/[^0-9]/g, '') });
                        setShowQuickCust(true);
                        setShowCustomerDropdown(false);
                      }
                    }
                  }}
                  placeholder="Customer name or phone..."
                  title={customerSearch}
                  className="w-full min-w-0 pl-10 pr-3 h-10 rounded-xl border-blue-400/25 bg-black/50 shadow-[0_10px_24px_rgba(2,6,23,0.36)] text-[12px] text-white font-bold tracking-normal placeholder:text-slate-500 focus:border-blue-400 truncate"
                />
                {showCustomerDropdown && (
                  <div className="liquid-glass-popover fixed left-3 right-3 top-[7rem] md:absolute md:left-0 md:right-auto md:top-[calc(100%+12px)] md:w-full md:max-w-[24rem] p-2.5 z-[5000] max-h-[20rem] overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2 fade-in duration-200" style={{ maxHeight: '56vh' }}>
                    <div className="flex items-start justify-between gap-3 px-2.5 pb-2.5">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-300">Customer Search</p>
                        <p className="text-[10px] text-slate-400 mt-1">Quick pick with balance</p>
                      </div>
                      <span className="shrink-0 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-black text-slate-300">
                        {filteredCustomers.length}
                      </span>
                    </div>
                    {filteredCustomers.length > 0 ? (
                      <>
                        {filteredCustomers.map(c => {
                          const balance = c.balanceDue || 0;
                          const loan = c.totalLoan || 0;
                          const hasDebt = balance > 0;
                          const debtLevel = balance > 10000 ? 'high' : balance > 5000 ? 'medium' : 'low';

                          return (
                            <div
                              key={c.id}
                              onClick={() => { setSelectedCustomerId(String(c.id)); setCustomerSearch(c.name); setShowCustomerDropdown(false); }}
                              className={`liquid-glass-item p-2.5 mb-2 last:mb-0 rounded-[1.1rem] cursor-pointer transition-all border ${hasDebt
                                ? debtLevel === 'high'
                                  ? 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20'
                                  : 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20'
                                : 'hover:bg-blue-500/10 border-blue-500/20'
                                }`}
                            >
                              <div className="flex items-start justify-between gap-3 min-w-0">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] sm:text-[12px] font-black text-white uppercase tracking-normal leading-snug break-words whitespace-normal">{c.name}</p>
                                  <p className="text-[10px] text-gray-400 font-mono font-bold break-words">{c.phone || 'No phone'}</p>
                                </div>
                                {hasDebt && (
                                  <div className="text-right shrink-0">
                                    <p className={`text-[10px] font-black uppercase tracking-wide ${debtLevel === 'high' ? 'text-red-400' : 'text-orange-400'
                                      }`}>DEBT</p>
                                  </div>
                                )}
                              </div>
                              {/* Balance & Loan Info */}
                              <div className="grid grid-cols-2 gap-2.5 mt-2 pt-2 border-t border-white/10">
                                {balance > 0 && (
                                  <div className="flex-1">
                                    <p className="text-[8px] text-gray-500 font-bold uppercase tracking-wide mb-1">Balance</p>
                                    <p className="text-[12px] font-black text-white font-mono">{balance.toLocaleString()}</p>
                                  </div>
                                )}
                                 {(c.totalLoan || 0) > 0 && (
                                   <div className="flex-1">
                                     <p className="text-[8px] text-gray-500 font-bold uppercase tracking-wide mb-1">Loan</p>
                                     <p className="text-[12px] font-black text-white font-mono">{(c.totalLoan || 0).toLocaleString()}</p>
                                   </div>
                                 )}
                                 {balance === 0 && (c.totalLoan || 0) === 0 && (
                                   <div className="flex-1">
                                     <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">✓ Clear</p>
                                   </div>
                                 )}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    ) : customerSearch.length > 2 ? (
                      <button
                        onClick={() => {
                          setQuickCustForm({ name: '', phone: customerSearch.replace(/[^0-9]/g, '') });
                          setShowQuickCust(true);
                          setShowCustomerDropdown(false);
                        }}
                        className="w-full p-3.5 flex items-center justify-center gap-2 text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest border border-blue-500/30 leading-snug break-words"
                      >
                        <UserPlus size={16} /> Add "{customerSearch}" as New Customer
                      </button>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <AlertCircle size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No Customers Found</p>
                        <p className="text-[9px] mt-2 text-gray-600">Try a different search term</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowQuickCust(true)}
                className="h-10 w-11 shrink-0 bg-blue-600/12 border border-blue-500/25 text-blue-300 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-lg flex items-center justify-center"
                title="Quick Add Customer"
              >
                <UserPlus size={17} />
              </button>
            </div>
          </GlassCard>

          {/* Selected Customer Details - If customer is selected */}
          {selectedCustomerId && (
            (() => {
              if (!selectedCustomer) return null;

              const balance = selectedCustomer.balanceDue || 0;
              const loan = selectedCustomer.totalLoan || 0;
              const hasDebt = balance > 0;
              const debtLevel = balance > 10000 ? 'high' : balance > 5000 ? 'medium' : 'low';

              return (
                <GlassCard
                className={`p-2.5 border transition-all overflow-visible ${hasDebt
                    ? debtLevel === 'high'
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-orange-500/10 border-orange-500/30'
                    : 'bg-emerald-500/10 border-emerald-500/30'
                    }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Selected Customer</p>
                      <p className="text-[12px] font-black text-white uppercase leading-snug break-words">{selectedCustomer.name}</p>
                      <p className="text-[9px] text-slate-400 font-mono font-bold mt-0.5 break-words">{selectedCustomer.phone || 'No phone'}</p>
                    </div>
                    <button
                      onClick={() => { setSelectedCustomerId(''); setCustomerSearch(''); }}
                      className="text-gray-400 hover:text-white transition-colors shrink-0"
                      title="Clear selection"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* Customer Stats */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                    {hasDebt && (
                      <div>
                        <p className="text-[8px] text-gray-400 font-bold uppercase tracking-wide mb-1">Balance</p>
                        <p className={`text-[13px] font-black font-mono ${debtLevel === 'high' ? 'text-red-400' : 'text-orange-400'
                          }`}>
                          {balance.toLocaleString()}
                        </p>
                      </div>
                    )}
                     {(selectedCustomer.totalLoan || 0) > 0 && (
                       <div>
                         <p className="text-[8px] text-gray-400 font-bold uppercase tracking-wide mb-1">Loan</p>
                         <p className="text-[13px] font-black font-mono text-blue-400">
                           {(selectedCustomer.totalLoan || 0).toLocaleString()}
                         </p>
                       </div>
                     )}
                     {!hasDebt && (selectedCustomer.totalLoan || 0) === 0 && (
                       <div className="col-span-2">
                         <p className="text-xs text-emerald-400 font-black uppercase">✓ Account Clear</p>
                       </div>
                     )}
                  </div>
                </GlassCard>
              );
            })()
          )}

          {/* Totals */}
          <GlassCard className="flex-1 flex flex-col border-blue-500/10 min-h-0 overflow-visible" style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(139, 92, 246, 0.05) 100%)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
          }}>
            <div className="p-3.5 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              <div className="p-3.5 bg-black/20 rounded-2xl border border-white/5 space-y-2">
                <div className="flex justify-between text-slate-500 text-[8px] font-black uppercase tracking-[0.12em]"><span>Subtotal</span><span>LKR {totals.subtotal.toLocaleString()}</span></div>
                <div className="flex justify-between text-orange-500/80 text-[8px] font-black uppercase tracking-[0.12em]"><span>Total Discount</span><span>-LKR {totals.totalDiscount.toLocaleString()}</span></div>
                
                {/* Easy View Total Box */}
                <div className="mt-2.5 p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center gap-3 shadow-inner">
                  <span className="text-[8px] font-black uppercase text-blue-400 tracking-[0.16em]">Grand Total</span>
                  <div className="text-right">
                    <span className="text-xl font-black font-mono text-white tracking-tighter block">LKR {totals.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-wide block mb-1 px-1 text-center">Grand Discount</label>
                    <div className="relative">
                      <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 text-orange-500/50" size={13} />
                      <GlassInput
                        type="number"
                        value={billDiscount}
                        onChange={e => setBillDiscount(e.target.value === '' ? '' : toNum(e.target.value))}
                        placeholder="0.00"
                        className="w-full h-10 pl-8 px-2 py-2 text-center text-[12px] font-black text-orange-400 rounded-xl"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-wide block mb-1 px-1 text-center">Cash Received</label>
                    <div className="relative">
                      <Banknote className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-500/50" size={13} />
                      <GlassInput
                        type="number"
                        value={cashReceived}
                        onChange={e => setCashReceived(e.target.value === '' ? '' : toNum(e.target.value))}
                        placeholder="0.00"
                        className="w-full h-10 pl-8 px-2 py-2 text-center text-[12px] font-black text-emerald-400 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Cash Buttons */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[100, 500, 1000, 5000].map(amt => (
                    <button 
                      key={amt}
                      onClick={() => setCashReceived(amt)}
                      className="py-2 premium-chip tap-lift bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-lg text-[9px] font-black transition-all"
                    >
                      {amt}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between items-center p-3 rounded-2xl border border-emerald-500/20" style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.06) 100%)',
                  backdropFilter: 'blur(16px)',
                }}>
                  <span className="text-[8px] font-black uppercase text-emerald-400 tracking-wide">Change</span>
                  <span className="text-lg font-black font-mono text-white tracking-tighter">LKR {totals.change.toLocaleString()}</span>
                </div>
              </div>

              {totals.total > toNum(cashReceived) && (
                <div className="animate-in slide-in-from-top-2">
                  <label className="text-[8px] font-black text-orange-400 uppercase tracking-wide block mb-1 px-1">Credit Due Date</label>
                  <GlassInput type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full h-10 py-2 rounded-xl text-[12px]" />
                </div>
              )}
            </div>

            <div className="p-3.5 bg-black/60 border-t border-white/5 space-y-2">
                <button
                  onClick={handleCheckout}
                  disabled={isSaving || cart.length === 0}
                  className="w-full py-3.5 premium-button tap-lift bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.18em] shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                {posMode === 'SALE' ? 'Authorize Sale (F2)' : 'Complete Return (F2)'}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowReturnItems(true)}
                  className="py-2 premium-chip tap-lift bg-white/5 text-slate-400 border border-white/5 rounded-lg font-black text-[8px] uppercase tracking-[0.14em] hover:bg-white/10 transition-all flex items-center justify-center gap-1.5"
                >
                  <RotateCw size={12} /> Returns
                </button>
                <button onClick={() => setCart([])} className="py-2 premium-chip tap-lift bg-red-500/5 text-red-500/60 border border-red-500/10 rounded-lg font-black text-[8px] uppercase tracking-[0.14em] hover:bg-red-500/10 transition-all">Reset (F3)</button>
              </div>

              {posMode === 'RETURN' && selectedBillForReturn && (
                <button
                  onClick={sendReturnWhatsApp}
                  disabled={waSending || !autoSendWA}
                  className="w-full py-3 mt-1 premium-chip tap-lift bg-green-600/10 text-green-500 border border-green-500/20 rounded-xl font-black text-[9px] uppercase tracking-[0.22em] shadow-lg hover:bg-green-600/20 transition-all flex items-center justify-center gap-2"
                >
                  {waSending ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                  {returnWASent ? 'Receipt Sent' : 'WhatsApp Receipt'}
                </button>
              )}
            </div>
          </GlassCard>
        </div>
      </div >

      {/* Return Items Modal */}
      {
        showReturnItems && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <GlassCard className="w-full max-w-lg p-8 border-white/10 shadow-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-lg font-black uppercase text-white tracking-widest">Load Previous Bills</h2>
                <button onClick={() => setShowReturnItems(false)} className="text-gray-500 hover:text-white transition-all"><X size={20} /></button>
              </div>

              <div className="mb-6 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input
                  type="text"
                  value={billSearch}
                  onChange={e => setBillSearch(e.target.value)}
                  placeholder="Search by invoice or customer..."
                  className="w-full bg-black/60 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/5 outline-none text-white placeholder-gray-700 font-semibold"
                />
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                {filteredBills.length > 0 ? (
                  filteredBills.map(bill => (
                    <button
                      key={bill.id}
                      onClick={() => addReturnItemsFromBill(bill)}
                      className="w-full p-4 text-left bg-blue-500/10 border border-blue-500/20 rounded-2xl hover:bg-blue-600 hover:text-white transition-all group"
                    >
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-white uppercase text-sm group-hover:text-white">{bill.invoiceNumber}</p>
                          <p className="text-[10px] text-gray-500 group-hover:text-gray-300">{bill.customerName}</p>
                        </div>
                        <span className="font-mono text-white font-black text-right">LKR {bill.total.toLocaleString()}</span>
                      </div>
                      <p className="text-[9px] text-gray-600 group-hover:text-gray-400 mt-2">{bill.items.length} items • {new Date(bill.date).toLocaleDateString()}</p>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Receipt size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No Bills Found</p>
                  </div>
                )}
              </div>
            </GlassCard>
          </div>
        )
      }

      {/* Barcode Scanner Modal */}
      {
        showBarcodeScanner && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
            <GlassCard className="w-full max-w-md p-6 sm:p-8 border-purple-500/20 rounded-[2rem] sm:rounded-[3rem] animate-in zoom-in-95 max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar" style={{
              background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)',
            }}>
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-white uppercase tracking-widest">Barcode Scanner</h2>
                <button onClick={() => { setShowBarcodeScanner(false); setIsScannerActive(false); setBarcodeInput(''); }} className="p-2 text-gray-500 hover:text-white transition-all"><X size={24} /></button>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-purple-600/10 rounded-3xl border border-purple-500/20 text-center">
                  <Scan size={32} className="mx-auto text-purple-400 mb-3" />
                  <p className="text-[10px] font-black text-purple-300 uppercase tracking-widest">Ready to scan</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Barcode / SKU:</label>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={barcodeInput}
                    onChange={e => setBarcodeInput(e.target.value)}
                    onKeyPress={e => {
                      if (e.key === 'Enter') {
                        handleBarcodeInput(barcodeInput);
                      }
                    }}
                    placeholder="Scan or type barcode..."
                    className="w-full bg-black/60 border border-purple-500/30 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500/50 outline-none text-white placeholder-gray-600 font-semibold text-center text-lg"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { handleBarcodeInput(barcodeInput); setShowBarcodeScanner(false); }}
                    className="flex-1 py-3 bg-purple-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-purple-500 active:scale-95 transition-all"
                  >
                    Add Product
                  </button>
                  <button
                    onClick={() => { setShowBarcodeScanner(false); setBarcodeInput(''); }}
                    className="flex-1 py-3 bg-white/5 text-white rounded-2xl font-black uppercase text-xs tracking-widest border border-white/10 hover:bg-white/10 active:scale-95 transition-all"
                  >
                    Cancel
                  </button>
                </div>

                <p className="text-[9px] text-gray-500 text-center font-bold">Press ENTER to add or click Add Product button</p>
              </div>
            </GlassCard>
          </div>
        )
      }

      {/* Mobile Reload Service Modal */}
      {
        showReloadService && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
            <GlassCard className="w-full max-w-md p-6 sm:p-8 border-orange-500/20 rounded-[2rem] sm:rounded-[3rem] animate-in zoom-in-95 max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar" style={{
              background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(251, 146, 60, 0.05) 100%)',
            }}>
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-white uppercase tracking-widest">Mobile Reload</h2>
                <button onClick={() => { setShowReloadService(false); resetReloadService(); }} className="p-2 text-gray-500 hover:text-white transition-all"><X size={24} /></button>
              </div>

              <form onSubmit={e => { e.preventDefault(); addReloadService(); }} className="space-y-5">
                <div className="grid grid-cols-2 gap-2">
                  {['Dialog', 'Airtel', 'Mobitel', 'Hutch'].map(operator => (
                    <button
                      key={operator}
                      type="button"
                      onClick={() => setReloadForm(prev => ({ ...prev, operator }))}
                      className={`py-3 rounded-2xl border font-black uppercase text-[10px] tracking-widest transition-all ${reloadForm.operator === operator ? 'bg-orange-600 text-white border-orange-400' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'}`}
                    >
                      {operator}
                    </button>
                  ))}
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Mobile Number</label>
                  <input
                    type="tel"
                    value={reloadForm.phone}
                    onChange={e => setReloadForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="e.g. 0771234567"
                    className="w-full bg-black/60 border border-orange-500/25 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500/50 outline-none text-white placeholder-gray-600 font-mono"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Reload Amount</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={reloadForm.amount}
                      onChange={e => setReloadForm(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full bg-black/60 border border-orange-500/25 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500/50 outline-none text-white placeholder-gray-600 font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Commission</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={reloadForm.commission}
                      onChange={e => setReloadForm(prev => ({ ...prev, commission: e.target.value }))}
                      className="w-full bg-black/60 border border-orange-500/25 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500/50 outline-none text-white placeholder-gray-600 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[100, 200, 500, 1000].map(amount => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setReloadForm(prev => ({ ...prev, amount: String(amount) }))}
                      className={`py-2.5 rounded-xl border text-[10px] font-black transition-all ${reloadAmount === amount ? 'bg-orange-600 text-white border-orange-400' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'}`}
                    >
                      {amount}
                    </button>
                  ))}
                </div>

                <div className="p-4 rounded-2xl border border-orange-500/20 bg-orange-500/10 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[9px] text-orange-300 font-black uppercase tracking-widest">Total</p>
                    <p className="text-[10px] text-slate-400 mt-1">{reloadForm.operator} reload profit LKR {reloadCommission.toLocaleString()}</p>
                  </div>
                  <p className="text-2xl font-black text-white font-mono">LKR {reloadAmount.toLocaleString()}</p>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-orange-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-orange-500 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Check size={16} /> Add Reload
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowReloadService(false); resetReloadService(); }}
                    className="flex-1 py-3 bg-white/5 text-white rounded-2xl font-black uppercase text-xs tracking-widest border border-white/10 hover:bg-white/10 active:scale-95 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </GlassCard>
          </div>
        )
      }

      {/* Print / Photocopy Service Modal */}
      {
        showManualService && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
            <GlassCard className="w-full max-w-md p-6 sm:p-8 border-sky-500/20 rounded-[2rem] sm:rounded-[3rem] animate-in zoom-in-95 max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar" style={{
              background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(56, 189, 248, 0.05) 100%)',
            }}>
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-white uppercase tracking-widest">Print / Copy</h2>
                <button onClick={() => { setShowManualService(false); resetPrintCopyService(); }} className="p-2 text-gray-500 hover:text-white transition-all"><X size={24} /></button>
              </div>

              <form onSubmit={e => { e.preventDefault(); addPrintCopyService(); }} className="space-y-5">
                <div className="grid grid-cols-2 gap-2">
                  {['Photocopy', 'Print'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setServiceForm(prev => ({ ...prev, type }))}
                      className={`py-3 rounded-2xl border font-black uppercase text-[10px] tracking-widest transition-all ${serviceForm.type === type ? 'bg-sky-600 text-white border-sky-400' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {['Single Side', 'Double Side'].map(side => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => updatePrintCopySide(side)}
                      className={`py-3 rounded-2xl border font-black uppercase text-[10px] tracking-widest transition-all ${serviceForm.side === side ? 'bg-cyan-600 text-white border-cyan-400' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'}`}
                    >
                      {side}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Sheets</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={serviceForm.pages}
                      onChange={e => updatePrintCopyPages(e.target.value)}
                      className="w-full bg-black/60 border border-sky-500/25 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500/50 outline-none text-white placeholder-gray-600 font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Rate / Page</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={serviceForm.rate}
                      onChange={e => setServiceForm(prev => ({ ...prev, rate: e.target.value }))}
                      className="w-full bg-black/60 border border-sky-500/25 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500/50 outline-none text-white placeholder-gray-600 font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[20, 15, 10, 8].map(rate => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setServiceForm(prev => ({ ...prev, rate: String(rate) }))}
                      className={`py-2.5 rounded-xl border text-[10px] font-black transition-all ${printCopyRate === rate ? 'bg-sky-600 text-white border-sky-400' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'}`}
                    >
                      {rate}
                    </button>
                  ))}
                </div>

                <div className="p-4 rounded-2xl border border-sky-500/20 bg-sky-500/10 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[9px] text-sky-300 font-black uppercase tracking-widest">Total</p>
                    <p className="text-[10px] text-slate-400 mt-1">{printCopySheets} sheet{printCopySheets === 1 ? '' : 's'} / {printCopyPages} page{printCopyPages === 1 ? '' : 's'} x LKR {printCopyRate || 0}</p>
                  </div>
                  <p className="text-2xl font-black text-white font-mono">LKR {printCopyTotal.toLocaleString()}</p>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-sky-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-sky-500 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Check size={16} /> Add to Cart
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowManualService(false); resetPrintCopyService(); }}
                    className="flex-1 py-3 bg-white/5 text-white rounded-2xl font-black uppercase text-xs tracking-widest border border-white/10 hover:bg-white/10 active:scale-95 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </GlassCard>
          </div>
        )
      }

      {/* Manual Product Entry Modal */}
      {
        showManualProduct && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
            <GlassCard className="w-full max-w-md p-6 sm:p-8 border-emerald-500/20 rounded-[2rem] sm:rounded-[3rem] animate-in zoom-in-95 max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar" style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(52, 211, 153, 0.05) 100%)',
            }}>
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-white uppercase tracking-widest">Add Manual Product</h2>
                <button onClick={() => { setShowManualProduct(false); setManualProductForm({ name: '', sku: '', costPrice: '', sellPrice: '', quantity: '' }); }} className="p-2 text-gray-500 hover:text-white transition-all"><X size={24} /></button>
              </div>

              <form onSubmit={e => { e.preventDefault(); addManualProduct(); }} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Product Name *</label>
                  <GlassInput
                    value={manualProductForm.name}
                    onChange={e => setManualProductForm({ ...manualProductForm, name: e.target.value })}
                    placeholder="e.g. Kitchen Item"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">SKU / Code</label>
                  <GlassInput
                    value={manualProductForm.sku}
                    onChange={e => setManualProductForm({ ...manualProductForm, sku: e.target.value })}
                    placeholder="Optional SKU"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Cost Price *</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                      <input
                        type="number"
                        value={manualProductForm.costPrice}
                        onChange={e => setManualProductForm({ ...manualProductForm, costPrice: e.target.value })}
                        placeholder="Cost"
                        className="w-full bg-black/60 border border-white/10 rounded-xl pl-8 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none text-white placeholder-gray-600 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Sell Price *</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                      <input
                        type="number"
                        value={manualProductForm.sellPrice}
                        onChange={e => setManualProductForm({ ...manualProductForm, sellPrice: e.target.value })}
                        placeholder="Price"
                        className="w-full bg-black/60 border border-white/10 rounded-xl pl-8 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none text-white placeholder-gray-600 font-mono"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Quantity *</label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                    <input
                      type="number"
                      value={manualProductForm.quantity}
                      onChange={e => setManualProductForm({ ...manualProductForm, quantity: e.target.value })}
                      placeholder="1"
                      className="w-full bg-black/60 border border-white/10 rounded-xl pl-8 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none text-white placeholder-gray-600 font-mono"
                      required
                      min="1"
                    />
                  </div>
                </div>

                {manualProductForm.costPrice && manualProductForm.sellPrice && (
                  <div className="p-3 bg-emerald-600/10 rounded-xl border border-emerald-500/20">
                    <p className="text-[9px] text-emerald-300 font-bold">Profit per unit: LKR {(parseFloat(manualProductForm.sellPrice) - parseFloat(manualProductForm.costPrice)).toFixed(2)}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-emerald-500 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Check size={16} /> Add to Cart
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowManualProduct(false); setManualProductForm({ name: '', sku: '', costPrice: '', sellPrice: '', quantity: '' }); }}
                    className="flex-1 py-3 bg-white/5 text-white rounded-2xl font-black uppercase text-xs tracking-widest border border-white/10 hover:bg-white/10 active:scale-95 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </GlassCard>
          </div>
        )
      }

      {/* Quick Add Customer Modal */}
      {
        showQuickCust && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <GlassCard className="w-full max-w-md p-6 sm:p-8 border-white/10 shadow-2xl max-h-[92vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center gap-3 mb-6">
                <h2 className="text-lg font-black uppercase text-white tracking-widest">Quick Register</h2>
                <button onClick={() => setShowQuickCust(false)} className="text-gray-500 hover:text-white transition-all"><X size={20} /></button>
              </div>
              <form onSubmit={handleQuickCustSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Customer Name</label>
                    <GlassInput
                      autoFocus
                      value={quickCustForm.name}
                      onChange={e => setQuickCustForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter full name..."
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Mobile Number</label>
                    <GlassInput
                      type="tel"
                      value={quickCustForm.phone}
                      onChange={e => setQuickCustForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="e.g. 0771234567"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr] gap-3">
                  <button
                    type="button"
                    onClick={() => setShowQuickCust(false)}
                    className="py-4 bg-white/5 text-slate-300 border border-white/10 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-white/10 active:scale-95 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-blue-500 active:scale-95 transition-all"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                    Add & Select
                  </button>
                </div>
              </form>
            </GlassCard>
          </div>
        )
      }
    </div >
  );
};
