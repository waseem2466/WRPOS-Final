
import {
  Edit2, Loader2, PackagePlus, Plus, Search,
  Trash2, X, List, ShieldCheck as ShieldIcon,
  Archive, Calculator, Tag, Barcode, Hash,
  BrainCircuit, Wand2, TrendingUp, AlertTriangle, Package, ChevronRight, ArrowLeft
} from 'lucide-react';
import React, { useEffect, useState, useMemo } from 'react';
import { db, generateId } from '../services/mockDb';
import { extractInventoryItemFromBill, generateAiContent } from '../services/ai';
import { MarginType, Product, WarrantyUnit } from '../types';
import { GlassCard } from './ui/GlassCard';
import { GlassInput } from './ui/GlassInput';
import { useAction } from '../context/ActionContext';
import { FloatingAIButton } from '../src/components/ui/FloatingAIButton';
import { QuickAIInsights } from '../src/components/ui/QuickAIInsights';
import { uploadProductImage } from '../src/services/supabase';
import { Camera, Image as ImageIcon, Trash } from 'lucide-react';

const PRESET_CATEGORIES = [
  "House Hold", "Baby Products", "Watches & Accessories", "Cosmetic", "Fancy",
  "Footwear", "Stationary", "Vehicle", "Electronic", "Toys",
  "Mobile Phone & Accessories", "Others"
];

const WARRANTY_PERIOD_OPTIONS = [
  { label: '3 Month', years: 3, unit: 'MONTHS' as WarrantyUnit },
  { label: '6 Month', years: 6, unit: 'MONTHS' as WarrantyUnit },
  { label: '1 Year', years: 1, unit: 'YEARS' as WarrantyUnit },
  { label: '2 Year', years: 2, unit: 'YEARS' as WarrantyUnit }
];

export const ProductManager: React.FC = () => {
  const { lastAction, clearAction } = useAction();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isAnalyzingBill, setIsAnalyzingBill] = useState(false);
  
  // Mobile UI States
  const [mobileView, setMobileView] = useState<'LIST' | 'FORM'>('LIST');
  const [isUploading, setIsUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [billImageFile, setBillImageFile] = useState<File | null>(null);
  const [billImagePreview, setBillImagePreview] = useState<string | null>(null);
  const [inventoryAiMode, setInventoryAiMode] = useState<'pricing' | 'restock' | 'description' | null>(null);
  const [inventoryAiLoading, setInventoryAiLoading] = useState(false);
  const [inventoryAiInsight, setInventoryAiInsight] = useState('Ask AI to review pricing, stock planning, or write a clean product description.');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrLabelCounts, setQrLabelCounts] = useState<Record<string, number>>({});
  const [isPrintingQr, setIsPrintingQr] = useState(false);

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    category: 'General',
    marginType: MarginType.PERCENTAGE,
    marginValue: 20,
    cost: 0,
    stock: 0,
    warrantyYears: 0,
    warrantyUnit: 'YEARS',
    warrantyCost: 0,
    warrantyPrice: 0,
    barcode: '',
    sku: '',
    hasWarranty: false,
    description: ''
  });

  useEffect(() => {
    if (lastAction && lastAction.type === 'INVENTORY_FILL') {
      const { name, price, cost, stock, category } = lastAction.payload;
      setFormData(prev => ({
        ...prev,
        name: name || prev.name,
        price: Number(price) || prev.price,
        cost: Number(cost) || prev.cost,
        stock: Number(stock) || prev.stock,
        category: category || prev.category,
        marginType: MarginType.MANUAL // AI fills usually come with fixed prices
      }));
      setMobileView('FORM');
      clearAction();
    }
  }, [lastAction]);

  useEffect(() => {
    if (formData.marginType === MarginType.PERCENTAGE && formData.cost) {
      const calculatedPrice = formData.cost * (1 + (formData.marginValue || 0) / 100);
      if (Math.round(calculatedPrice) !== formData.price) {
        setFormData(prev => ({ ...prev, price: Math.round(calculatedPrice) }));
      }
    }
  }, [formData.cost, formData.marginValue, formData.marginType]);

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    const all = await db.products.getAll();
    setProducts(all);
  };

  const resetForm = () => {
    setFormData({
      name: '', category: 'General', marginType: MarginType.PERCENTAGE, marginValue: 20, cost: 0, stock: 0,
      warrantyYears: 0, warrantyUnit: 'YEARS', warrantyCost: 0, warrantyPrice: 0, barcode: '', sku: '', hasWarranty: false, description: ''
    });
    setIsEditing(false);
    setMobileView('LIST');
    setImageFile(null);
    setImagePreview(null);
    setBillImageFile(null);
    setBillImagePreview(null);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const productToSave: Product = {
        ...formData as Product,
        id: isEditing ? (formData.id || '') : generateId(),
        cost: Number(formData.cost || 0),
        price: Number(formData.price || 0),
        stock: Number(formData.stock || 0),
        hasWarranty: Boolean(formData.hasWarranty),
        warrantyYears: formData.hasWarranty ? Number(formData.warrantyYears || 1) : 0,
        warrantyUnit: (formData.warrantyUnit || 'YEARS') as WarrantyUnit,
        warrantyCost: Number(formData.warrantyCost || 0),
        warrantyPrice: Number(formData.warrantyPrice || 0),
        imageUrl: formData.imageUrl || undefined
      };

      if (imageFile) {
        setIsUploading(true);
        const pid = isEditing ? (formData.id || generateId()) : generateId();
        const url = await uploadProductImage(imageFile, pid);
        productToSave.imageUrl = url;
        productToSave.id = pid;
      }

      if (isEditing) await db.products.update(productToSave);
      else await db.products.add(productToSave);

      await loadProducts();
      resetForm();
    } catch (err) {
      alert("Failed to save product.");
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBillFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBillImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setBillImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const applyBillExtraction = async () => {
    if (!billImageFile) {
      alert('Please choose a supplier bill image first.');
      return;
    }

    setIsAnalyzingBill(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = String(reader.result || '');
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(billImageFile);
      });

      const extracted = await extractInventoryItemFromBill(base64);

      setFormData(prev => {
        const nextCost = Number(extracted.cost || 0);
        const nextPrice = Number(extracted.price || 0);

        return {
          ...prev,
          name: extracted.name || prev.name,
          category: extracted.category || prev.category || 'General',
          cost: nextCost || prev.cost || 0,
          price: nextPrice || prev.price || 0,
          stock: Number(extracted.stock || 0) || prev.stock || 0,
          sku: extracted.sku || prev.sku || '',
          barcode: extracted.barcode || prev.barcode || '',
          description: extracted.description || prev.description || '',
          marginType: nextPrice > 0 ? MarginType.MANUAL : prev.marginType,
        };
      });

      alert('Bill image analyzed. Product details were filled into the inventory form.');
    } catch (error: any) {
      alert(`Bill analysis failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsAnalyzingBill(false);
    }
  };

  const inventoryAnalytics = useMemo(() => {
    const totalStockValue = products.reduce((sum, p) => sum + (p.cost * p.stock), 0);
    const lowStockItems = products.filter(p => p.stock < 5);
    return {
      totalStockValue,
      lowStockCount: lowStockItems.length,
    };
  }, [products]);

  const aiContextData = useMemo(() => `Inventory items: ${products.length}. Low stock: ${inventoryAnalytics.lowStockCount}. Total investment: ${inventoryAnalytics.totalStockValue}`, [products, inventoryAnalytics]);
  const lowStockPreview = useMemo(
    () => products.filter(p => p.stock < 5).slice(0, 5).map(p => `${p.name} (${p.stock})`).join(', ') || 'No urgent low stock items',
    [products]
  );
  const inventoryAiContext = useMemo(() => {
    const margin = Number(formData.cost || 0) > 0 && Number(formData.price || 0) > 0
      ? ((((Number(formData.price) - Number(formData.cost)) / Number(formData.cost)) * 100).toFixed(1))
      : '0';

    return [
      `Product name: ${formData.name || 'Not entered'}`,
      `Category: ${formData.category || 'General'}`,
      `Cost: ${Number(formData.cost || 0)}`,
      `Price: ${Number(formData.price || 0)}`,
      `Stock: ${Number(formData.stock || 0)}`,
      `SKU: ${formData.sku || 'None'}`,
      `Barcode: ${formData.barcode || 'None'}`,
      `Description: ${formData.description || 'None'}`,
      `Estimated margin percent: ${margin}%`,
      `Low stock items now: ${inventoryAnalytics.lowStockCount}`,
      `Low stock preview: ${lowStockPreview}`,
      `Total stock value: ${inventoryAnalytics.totalStockValue}`
    ].join('\n');
  }, [formData, inventoryAnalytics, lowStockPreview]);

  const runInventoryAi = async (mode: 'pricing' | 'restock' | 'description') => {
    setInventoryAiMode(mode);
    setInventoryAiLoading(true);
    try {
      const prompt = mode === 'pricing'
        ? `You are helping a retail POS inventory operator. Review this product and suggest the best selling price or margin. Keep it short, practical, and business-focused in 3 bullet-style lines max.\n\n${inventoryAiContext}`
        : mode === 'restock'
          ? `You are helping a retail POS inventory operator. Review this item and the current low stock situation. Give a short restock decision with urgency, suggested action, and one reason. Keep it within 3 short lines.\n\n${inventoryAiContext}`
          : `You are helping a retail POS inventory operator. Write a short clean sales description for this product using the known details. If details are missing, keep it generic but usable. Return plain text under 35 words.\n\n${inventoryAiContext}`;

      const response = await generateAiContent(prompt, { provider: 'local-phi' });
      const cleaned = String(response || '').trim();

      if (mode === 'description' && cleaned) {
        setFormData(prev => ({
          ...prev,
          description: cleaned
        }));
      }

      setInventoryAiInsight(cleaned || 'No AI advice was returned.');
    } catch (error: any) {
      setInventoryAiInsight(`AI request failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setInventoryAiLoading(false);
    }
  };

  const availableProducts = useMemo(() => products.filter(p => Number(p.stock || 0) > 0), [products]);

  const selectedQrLabelTotal = useMemo(() => {
    return Object.values(qrLabelCounts).reduce((sum, count) => sum + Math.max(0, Number(count || 0)), 0);
  }, [qrLabelCounts]);

  const setFirstTenQrLabels = () => {
    const next: Record<string, number> = {};
    availableProducts.slice(0, 10).forEach(product => {
      if (product.id) next[product.id] = 2;
    });
    setQrLabelCounts(next);
  };

  const openQrBatchModal = () => {
    const next: Record<string, number> = {};
    availableProducts.slice(0, 10).forEach(product => {
      if (product.id) next[product.id] = 2;
    });
    setQrLabelCounts(next);
    setIsQrModalOpen(true);
  };

  const updateQrLabelCount = (productId: string, value: number) => {
    setQrLabelCounts(prev => {
      const next = { ...prev };
      const cleanValue = Math.max(0, Math.min(999, Number(value || 0)));
      if (cleanValue > 0) next[productId] = cleanValue;
      else delete next[productId];
      return next;
    });
  };

  const escapePrintText = (value: any) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const getProductQrPayload = (product: Product) => JSON.stringify({
    type: 'WR_PRODUCT',
    id: product.id,
    sku: product.sku || product.barcode || '',
    barcode: product.barcode || '',
    name: product.name,
    price: Number(product.price || 0),
    warranty: Boolean(product.hasWarranty),
    warrantyPeriod: product.hasWarranty ? `${Number(product.warrantyYears || 0)} ${product.warrantyUnit || 'YEARS'}` : ''
  });

  const printBatchQrLabels = async () => {
    const jobs = products
      .filter(product => product.id && Number(qrLabelCounts[product.id] || 0) > 0)
      .map(product => ({ product, count: Math.max(0, Number(qrLabelCounts[product.id!] || 0)) }));

    if (jobs.length === 0) {
      alert('Please select at least one product QR label to print.');
      return;
    }

    setIsPrintingQr(true);
    try {
      const QRCode = await import('qrcode');
      const labelHtmlParts: string[] = [];

      for (const job of jobs) {
        const product = job.product;
        const qrUrl = await QRCode.toDataURL(getProductQrPayload(product), {
          margin: 1,
          width: 180,
          errorCorrectionLevel: 'M'
        });

        for (let index = 0; index < job.count; index += 1) {
          const code = product.sku || product.barcode || product.id || '';
          labelHtmlParts.push(`
            <div class="label">
              <img src="${qrUrl}" alt="QR" />
              <div class="meta">
                <strong>${escapePrintText(product.name)}</strong>
                <span>${escapePrintText(code || 'NO CODE')}</span>
                <b>LKR ${Number(product.price || 0).toLocaleString()}</b>
                ${product.hasWarranty ? `<em>Warranty ${escapePrintText(product.warrantyYears)} ${escapePrintText(product.warrantyUnit === 'MONTHS' ? 'Month' : 'Year')}</em>` : ''}
              </div>
            </div>
          `);
        }
      }

      const printWindow = window.open('', '_blank', 'width=980,height=720');
      if (!printWindow) {
        alert('Please allow popup windows to print QR labels.');
        return;
      }

      printWindow.document.write(`
        <!doctype html>
        <html>
          <head>
            <title>WR POS QR Labels</title>
            <style>
              * { box-sizing: border-box; }
              body { margin: 0; padding: 12px; font-family: Arial, sans-serif; color: #111827; background: #fff; }
              .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
              .label { min-height: 96px; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px; display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: 8px; break-inside: avoid; page-break-inside: avoid; }
              .label img { width: 78px; height: 78px; object-fit: contain; }
              .meta { min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 3px; }
              strong { font-size: 11px; line-height: 1.15; text-transform: uppercase; overflow-wrap: anywhere; }
              span { font-size: 9px; color: #4b5563; overflow-wrap: anywhere; }
              b { font-size: 12px; color: #111827; }
              em { font-size: 8px; color: #047857; font-style: normal; font-weight: 700; text-transform: uppercase; }
              @media print {
                body { padding: 6mm; }
                .sheet { gap: 4mm; }
                .label { border-color: #9ca3af; }
              }
            </style>
          </head>
          <body>
            <div class="sheet">${labelHtmlParts.join('')}</div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.focus();
                  window.print();
                }, 350);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (error: any) {
      alert(`QR print failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsPrintingQr(false);
    }
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full relative">
      
      {/* Desktop Layout (Standard Grid) */}
      <div className="hidden lg:grid grid-cols-12 gap-5 flex-1 min-h-0 p-2">
        <div className="col-span-4 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar leading-none">
           {/* Analytics Card */}
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <GlassCard className="p-4 bg-blue-600/5 border-blue-500/10">
              <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Stock Value</p>
              <h3 className="text-sm font-black text-white mt-1">LKR {inventoryAnalytics.totalStockValue.toLocaleString()}</h3>
            </GlassCard>
            <GlassCard className="p-4 bg-red-600/5 border-red-500/10">
              <p className="text-[8px] font-black text-red-400 uppercase tracking-widest">Alerts</p>
              <h3 className="text-sm font-black text-white mt-1">{inventoryAnalytics.lowStockCount} Low</h3>
            </GlassCard>
          </div>

          <GlassCard className="bg-[#0b1121]/85 p-4 rounded-[1.75rem] border-cyan-500/10 shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-[8px] font-black text-cyan-300 uppercase tracking-[0.28em]">AI Inventory Desk</p>
                <h3 className="text-xs font-black text-white mt-2 leading-4">Smarter stock, price, and product details</h3>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center text-cyan-300 shrink-0">
                <BrainCircuit size={18} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button type="button" onClick={() => runInventoryAi('pricing')} disabled={inventoryAiLoading} className={`py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.16em] transition-all border ${inventoryAiMode === 'pricing' ? 'bg-cyan-500 text-slate-950 border-cyan-300' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'} disabled:opacity-50`}>
                Price
              </button>
              <button type="button" onClick={() => runInventoryAi('restock')} disabled={inventoryAiLoading} className={`py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.16em] transition-all border ${inventoryAiMode === 'restock' ? 'bg-amber-400 text-slate-950 border-amber-200' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'} disabled:opacity-50`}>
                Restock
              </button>
              <button type="button" onClick={() => runInventoryAi('description')} disabled={inventoryAiLoading} className={`py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.16em] transition-all border ${inventoryAiMode === 'description' ? 'bg-emerald-400 text-slate-950 border-emerald-200' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'} disabled:opacity-50`}>
                Describe
              </button>
            </div>
            <div className="rounded-[1.25rem] border border-white/8 bg-black/30 p-3 space-y-2">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                {inventoryAiLoading ? <Loader2 size={12} className="animate-spin text-cyan-300" /> : <Wand2 size={12} className="text-cyan-300" />}
                AI Advice
              </div>
              <p className="text-[11px] leading-4 text-slate-200 whitespace-pre-wrap line-clamp-4">{inventoryAiInsight}</p>
            </div>
          </GlassCard>

          <GlassCard className="bg-[#0b1121]/90 p-5 rounded-[1.75rem] border-white/5 shadow-2xl">
             <div className="flex items-center justify-between gap-3 mb-4">
               <h3 className="text-xs font-black text-white uppercase tracking-[0.24em]">{isEditing ? 'Update Product' : 'Quick Product Entry'}</h3>
               {isEditing && (
                 <button type="button" onClick={resetForm} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 hover:text-white">
                   Clear
                 </button>
               )}
             </div>
             <form onSubmit={handleSaveProduct} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <GlassInput label="Product Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] ml-1">Category</label>
                    <select value={formData.category || 'General'} onChange={e => setFormData({...formData, category: e.target.value})} className="glass-input rounded-[1.25rem] px-4 py-3.5 text-sm font-bold text-white w-full outline-none">
                      <option value="General">General</option>
                      {PRESET_CATEGORIES.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  <GlassInput label="Base Cost (LKR)" type="number" value={formData.cost || ''} onChange={e => setFormData({...formData, cost: Number(e.target.value)})} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Pricing Mode</label>
                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, marginType: MarginType.MANUAL})}
                        className={`flex-1 py-1 text-[8px] font-black uppercase rounded-lg transition-all ${formData.marginType === MarginType.MANUAL ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500'}`}
                      >
                        Manual
                      </button>
                      <button 
                         type="button"
                        onClick={() => setFormData({...formData, marginType: MarginType.PERCENTAGE})}
                        className={`flex-1 py-1 text-[8px] font-black uppercase rounded-lg transition-all ${formData.marginType === MarginType.PERCENTAGE ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-500'}`}
                      >
                        Margin%
                      </button>
                    </div>
                  </div>
                  {formData.marginType === MarginType.PERCENTAGE ? (
                    <GlassInput label="Net Profit %" type="number" value={formData.marginValue || ''} onChange={e => setFormData({...formData, marginValue: Number(e.target.value)})} />
                  ) : (
                    <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex flex-col justify-center">
                      <p className="text-[8px] font-black text-gray-700 uppercase">Manual Mode</p>
                      <p className="text-[10px] text-gray-500 font-bold">Fixed Price Entry</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <GlassInput 
                    label="Retail Price (LKR)" 
                    type="number" 
                    value={formData.price || ''} 
                    onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                    disabled={formData.marginType === MarginType.PERCENTAGE}
                    className={formData.marginType === MarginType.PERCENTAGE ? 'opacity-60 cursor-not-allowed' : ''}
                  />
                  <GlassInput label="Stock" type="number" value={formData.stock || ''} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} />
                  <GlassInput label="SKU / Code" value={formData.sku || ''} onChange={e => setFormData({...formData, sku: e.target.value})} />
                </div>

                <GlassInput label="Barcode" value={formData.barcode || ''} onChange={e => setFormData({...formData, barcode: e.target.value})} />

                <div className="rounded-[1.25rem] border border-emerald-500/15 bg-emerald-500/[0.04] p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[8px] font-black text-emerald-300 uppercase tracking-widest">Warranty Default</p>
                      <p className="text-[9px] text-slate-500 font-bold">Auto applies when this item is sold in billing.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        hasWarranty: !prev.hasWarranty,
                        warrantyYears: !prev.hasWarranty ? Number(prev.warrantyYears || 1) : 0,
                        warrantyUnit: prev.warrantyUnit || 'YEARS'
                      }))}
                      className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border ${formData.hasWarranty ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-black/30 text-slate-400 border-white/10'}`}
                    >
                      {formData.hasWarranty ? 'On' : 'Off'}
                    </button>
                  </div>
                  {formData.hasWarranty && (
                    <>
                      <div className="grid grid-cols-4 gap-1.5">
                        {WARRANTY_PERIOD_OPTIONS.map(option => {
                          const active = Number(formData.warrantyYears || 0) === option.years && (formData.warrantyUnit || 'YEARS') === option.unit;
                          return (
                            <button
                              key={`${option.years}-${option.unit}`}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, warrantyYears: option.years, warrantyUnit: option.unit }))}
                              className={`py-2 rounded-lg text-[8px] font-black uppercase border ${active ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-black/25 text-slate-400 border-white/10'}`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <GlassInput label="Warranty Cost" type="number" value={formData.warrantyCost || ''} onChange={e => setFormData({...formData, warrantyCost: Number(e.target.value)})} />
                        <GlassInput label="Customer Charge" type="number" value={formData.warrantyPrice || ''} onChange={e => setFormData({...formData, warrantyPrice: Number(e.target.value)})} />
                      </div>
                    </>
                  )}
                </div>

                {/* Image Upload Area */}
                <div className="space-y-2">
                  <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest ml-4">Product Identity</p>
                  <div className="relative group h-24 rounded-[1.25rem] bg-black/40 border border-white/5 overflow-hidden flex items-center justify-center transition-all hover:border-blue-500/20">
                    {imagePreview || formData.imageUrl ? (
                      <>
                        <img src={imagePreview || formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-4 transition-all">
                           <label className="p-3 bg-blue-600 rounded-xl cursor-pointer hover:bg-blue-500 transition-all">
                              <ImageIcon size={20} className="text-white" />
                              <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                           </label>
                           <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); setFormData(p => ({...p, imageUrl: undefined})); }} className="p-3 bg-red-600 rounded-xl hover:bg-red-500 transition-all">
                              <Trash size={20} className="text-white" />
                           </button>
                        </div>
                      </>
                    ) : (
                      <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                        <Camera size={32} className="text-blue-500/40 mb-2" />
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Add Photo</p>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                      </label>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest ml-4">Smart Bill Import</p>
                  <div className="rounded-[1.25rem] border border-emerald-500/15 bg-emerald-500/[0.04] p-3 space-y-3">
                    <div className="relative h-20 rounded-[1rem] bg-black/30 border border-white/5 overflow-hidden flex items-center justify-center">
                      {billImagePreview ? (
                        <img src={billImagePreview} alt="Supplier bill preview" className="w-full h-full object-cover" />
                      ) : (
                        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer px-6 text-center">
                          <Wand2 size={22} className="text-emerald-400/70 mb-2" />
                          <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">Upload supplier bill</p>
                          <input type="file" className="hidden" accept="image/*" onChange={handleBillFileChange} />
                        </label>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <label className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 border border-white/10 text-center text-[9px] font-black uppercase tracking-[0.16em] text-slate-300 cursor-pointer hover:bg-white/10 transition-all">
                        Choose Bill Image
                        <input type="file" className="hidden" accept="image/*" onChange={handleBillFileChange} />
                      </label>
                      <button type="button" onClick={applyBillExtraction} disabled={isAnalyzingBill || !billImageFile} className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 text-white text-[9px] font-black uppercase tracking-[0.16em] shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                        {isAnalyzingBill ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                        {isAnalyzingBill ? 'Reading...' : 'Auto Fill'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Description</label>
                  <textarea value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full min-h-[68px] rounded-[1.25rem] border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 transition-colors resize-none" placeholder="Product details or bill notes..." />
                </div>
                <button type="submit" disabled={isSaving || isUploading} className="w-full py-4 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase tracking-[0.28em] shadow-xl">
                  {isSaving || isUploading ? <Loader2 className="animate-spin mx-auto" /> : isEditing ? 'Update Product' : 'Save Product'}
                </button>
             </form>
          </GlassCard>
        </div>

        <div className="col-span-8 flex flex-col min-h-0 overflow-hidden">
          <GlassCard className="bg-[#0b1121]/40 flex-1 flex flex-col overflow-hidden p-5 rounded-[2rem] border-white/5">
            <div className="mb-4 flex items-center gap-3">
              <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <GlassInput value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search product, SKU..." className="w-full pl-12" />
              </div>
              <button type="button" onClick={openQrBatchModal} className="shrink-0 rounded-2xl bg-cyan-600 px-4 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-cyan-950/30 hover:bg-cyan-500 transition-all flex items-center gap-2">
                <Barcode size={16} />
                Print QR
              </button>
              <div className="shrink-0 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Items</p>
                <p className="text-sm font-black text-white">{filtered.length}</p>
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1.8fr)_0.8fr_0.7fr_0.7fr_88px] gap-3 px-4 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 border-b border-white/10">
              <span>Product</span>
              <span>Category</span>
              <span>Stock</span>
              <span>Price</span>
              <span className="text-right">Action</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {filtered.map(p => (
                <div key={p.id} className="grid grid-cols-[minmax(0,1.8fr)_0.8fr_0.7fr_0.7fr_88px] gap-3 items-center px-4 py-3 border-b border-white/[0.06] bg-black/20 hover:bg-blue-500/[0.08] transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border overflow-hidden shrink-0 ${p.stock < 5 ? 'bg-red-500/10 text-red-400 border-red-400/20' : 'bg-blue-500/10 text-blue-400 border-blue-400/20'}`}>
                      {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" /> : <Archive size={16}/>}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-white uppercase truncate">{p.name}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase truncate">{p.sku || p.barcode || 'No code'}</p>
                      {p.hasWarranty && (
                        <p className="text-[8px] text-emerald-300 font-black uppercase truncate">
                          Warranty {Number(p.warrantyYears || 0)} {p.warrantyUnit === 'MONTHS' ? 'Month' : 'Year'}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold truncate">{p.category || 'General'}</p>
                  <p className={`text-[11px] font-black ${p.stock < 5 ? 'text-red-300' : 'text-slate-200'}`}>{p.stock} units</p>
                  <p className="text-[11px] font-black text-white">LKR {Number(p.price || 0).toLocaleString()}</p>
                  <div className="flex justify-end gap-2">
                    <button title="Edit product" onClick={() => { setFormData(p); setIsEditing(true); }} className="p-2 bg-white/5 text-blue-400 rounded-lg hover:bg-blue-500/15 transition-colors"><Edit2 size={14}/></button>
                    <button title="Delete product" onClick={() => db.products.delete(p.id!).then(loadProducts)} className="p-2 bg-white/5 text-red-400/70 rounded-lg hover:bg-red-500/15 transition-colors"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="h-48 flex items-center justify-center text-center text-slate-500">
                  <div>
                    <Archive size={24} className="mx-auto mb-3 opacity-60" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">No products found</p>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* --- MOBILE ADAPTIVE LAYOUT --- */}
      <div className="lg:hidden flex flex-col h-full overflow-hidden">
        
        {/* Mobile Header Tabs */}
        <div className="flex gap-2 p-4 shrink-0">
          <button onClick={() => setMobileView('LIST')} className={`flex-1 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${mobileView === 'LIST' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-white/5 text-gray-500'}`}>List</button>
          <button onClick={() => { setMobileView('FORM'); setIsEditing(false); }} className={`flex-1 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${mobileView === 'FORM' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-white/5 text-gray-500'}`}>+ Add New</button>
        </div>

        {/* Mobile Views */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 pt-0">
          {mobileView === 'LIST' ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <GlassInput value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Quick search..." className="w-full pl-12" />
              </div>
              <button type="button" onClick={openQrBatchModal} className="w-full py-3 rounded-2xl bg-cyan-600 text-white text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/30">
                <Barcode size={16} />
                Print QR Labels
              </button>
              
              <div className="space-y-3">
                {filtered.map(p => (
                  <div key={p.id} className="p-4 rounded-3xl bg-black/40 border border-white/5 flex items-center justify-between shadow-xl active:bg-blue-600/10 transition-all">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${p.stock < 5 ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}><Archive size={18}/></div>
                      <div className="truncate">
                        <p className="text-[11px] font-black text-white uppercase truncate">{p.name}</p>
                        <p className={`text-[9px] font-bold ${p.stock < 5 ? 'text-red-400' : 'text-gray-600'}`}>{p.stock} Units left</p>
                        {p.hasWarranty && (
                          <p className="text-[8px] text-emerald-300 font-black uppercase truncate">
                            Warranty {Number(p.warrantyYears || 0)} {p.warrantyUnit === 'MONTHS' ? 'Month' : 'Year'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-black text-white font-mono mr-2">LKR {p.price}</p>
                      <button onClick={() => { setFormData(p); setIsEditing(true); setMobileView('FORM'); }} className="p-3 bg-white/5 text-blue-400 rounded-xl"><Edit2 size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-in slide-in-from-right duration-300">
              <button onClick={() => setMobileView('LIST')} className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] mb-6"><ArrowLeft size={14}/> Back to Inventory</button>
              <GlassCard className="p-8 rounded-[2rem] border-white/5">
                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-8">{isEditing ? 'Modify SKU' : 'New Registration'}</h3>
                <form onSubmit={handleSaveProduct} className="space-y-6">
                  <div className="space-y-3 rounded-[1.75rem] border border-cyan-500/15 bg-cyan-500/[0.04] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black text-cyan-300 uppercase tracking-widest">AI Inventory Desk</p>
                        <p className="text-[10px] text-slate-500 mt-1">Use AI for price, restock, and description help.</p>
                      </div>
                      <BrainCircuit size={18} className="text-cyan-300 shrink-0" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button type="button" onClick={() => runInventoryAi('pricing')} disabled={inventoryAiLoading} className="py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.14em] text-slate-200 disabled:opacity-50">Price</button>
                      <button type="button" onClick={() => runInventoryAi('restock')} disabled={inventoryAiLoading} className="py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.14em] text-slate-200 disabled:opacity-50">Restock</button>
                      <button type="button" onClick={() => runInventoryAi('description')} disabled={inventoryAiLoading} className="py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.14em] text-slate-200 disabled:opacity-50">Describe</button>
                    </div>
                    <div className="rounded-[1.25rem] border border-white/8 bg-black/30 p-4">
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500 mb-2">
                        {inventoryAiLoading ? <Loader2 size={12} className="animate-spin text-cyan-300" /> : <Wand2 size={12} className="text-cyan-300" />}
                        AI Advice
                      </div>
                      <p className="text-[11px] leading-5 text-slate-200 whitespace-pre-wrap">{inventoryAiInsight}</p>
                    </div>
                  </div>
                  <GlassInput label="Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                  <div className="space-y-3 rounded-[1.75rem] border border-emerald-500/15 bg-emerald-500/[0.04] p-4">
                    <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">Smart Bill Import</p>
                    <div className="relative aspect-[16/9] rounded-[1.25rem] bg-black/30 border border-white/5 overflow-hidden flex items-center justify-center">
                      {billImagePreview ? (
                        <img src={billImagePreview} alt="Supplier bill preview" className="w-full h-full object-cover" />
                      ) : (
                        <label className="w-full h-full flex flex-col items-center justify-center text-center px-4 cursor-pointer">
                          <Wand2 size={24} className="text-emerald-400/70 mb-2" />
                          <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">Upload bill image</p>
                          <input type="file" className="hidden" accept="image/*" onChange={handleBillFileChange} />
                        </label>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-300 cursor-pointer">
                        Choose
                        <input type="file" className="hidden" accept="image/*" onChange={handleBillFileChange} />
                      </label>
                      <button type="button" onClick={applyBillExtraction} disabled={isAnalyzingBill || !billImageFile} className="py-3 px-4 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-[0.16em] disabled:opacity-50 flex items-center justify-center gap-2">
                        {isAnalyzingBill ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                        {isAnalyzingBill ? 'Reading...' : 'Auto Fill'}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <GlassInput label="Base Cost (LKR)" type="number" value={formData.cost || ''} onChange={e => setFormData({...formData, cost: Number(e.target.value)})} />
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-4">Mode</label>
                      <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                        <button type="button" onClick={() => setFormData({...formData, marginType: MarginType.MANUAL})} className={`flex-1 py-1 text-[8px] font-black uppercase rounded-lg transition-all ${formData.marginType === MarginType.MANUAL ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500'}`}>Man</button>
                        <button type="button" onClick={() => setFormData({...formData, marginType: MarginType.PERCENTAGE})} className={`flex-1 py-1 text-[8px] font-black uppercase rounded-lg transition-all ${formData.marginType === MarginType.PERCENTAGE ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-500'}`}>%</button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {formData.marginType === MarginType.PERCENTAGE ? (
                      <GlassInput label="Margin%" type="number" value={formData.marginValue || ''} onChange={e => setFormData({...formData, marginValue: Number(e.target.value)})} />
                    ) : (
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col justify-center"><p className="text-[10px] text-gray-500 font-bold">Manual</p></div>
                    )}
                    <GlassInput label="Sale Price" type="number" value={formData.price || ''} onChange={e => setFormData({...formData, price: Number(e.target.value)})} disabled={formData.marginType === MarginType.PERCENTAGE} />
                  </div>
                  <GlassInput label="In-Stock Qty" type="number" value={formData.stock || ''} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} />
                  <GlassInput label="SKU / Code" value={formData.sku || ''} onChange={e => setFormData({...formData, sku: e.target.value})} />
                  <GlassInput label="Barcode" value={formData.barcode || ''} onChange={e => setFormData({...formData, barcode: e.target.value})} />
                  <div className="rounded-[1.5rem] border border-emerald-500/15 bg-emerald-500/[0.04] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">Warranty Default</p>
                        <p className="text-[10px] text-slate-500 mt-1">Use in billing automatically.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          hasWarranty: !prev.hasWarranty,
                          warrantyYears: !prev.hasWarranty ? Number(prev.warrantyYears || 1) : 0,
                          warrantyUnit: prev.warrantyUnit || 'YEARS'
                        }))}
                        className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border ${formData.hasWarranty ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-black/30 text-slate-400 border-white/10'}`}
                      >
                        {formData.hasWarranty ? 'On' : 'Off'}
                      </button>
                    </div>
                    {formData.hasWarranty && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          {WARRANTY_PERIOD_OPTIONS.map(option => {
                            const active = Number(formData.warrantyYears || 0) === option.years && (formData.warrantyUnit || 'YEARS') === option.unit;
                            return (
                              <button
                                key={`${option.years}-${option.unit}`}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, warrantyYears: option.years, warrantyUnit: option.unit }))}
                                className={`py-3 rounded-xl text-[10px] font-black uppercase border ${active ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-black/25 text-slate-400 border-white/10'}`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <GlassInput label="Warranty Cost" type="number" value={formData.warrantyCost || ''} onChange={e => setFormData({...formData, warrantyCost: Number(e.target.value)})} />
                          <GlassInput label="Customer Charge" type="number" value={formData.warrantyPrice || ''} onChange={e => setFormData({...formData, warrantyPrice: Number(e.target.value)})} />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-4">Description</label>
                    <textarea value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full min-h-[88px] rounded-[1.5rem] border border-white/10 bg-black/40 px-5 py-4 text-sm text-white outline-none focus:border-blue-500 transition-colors resize-none" placeholder="Product details or bill notes..." />
                  </div>
                  <button type="submit" disabled={isSaving} className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-[0.4em] shadow-2xl active:scale-95 transition-all">
                    {isSaving ? <Loader2 className="animate-spin mx-auto" /> : 'Verify SKU'}
                  </button>
                </form>
              </GlassCard>
            </div>
          )}
        </div>
      </div>

      {isQrModalOpen && (
        <div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-[#0b1121] shadow-2xl flex flex-col">
            <div className="p-5 border-b border-white/10 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Inventory QR Printing</p>
                <h3 className="text-xl font-black text-white mt-1">Batch QR Labels</h3>
                <p className="text-xs text-slate-500 mt-1">Default is first 10 available products with 2 labels each.</p>
              </div>
              <button type="button" onClick={() => setIsQrModalOpen(false)} className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b border-white/10 grid grid-cols-2 md:grid-cols-4 gap-3">
              <button type="button" onClick={setFirstTenQrLabels} className="py-3 rounded-2xl bg-cyan-600 text-white text-[10px] font-black uppercase tracking-[0.16em] hover:bg-cyan-500">First 10 x 2</button>
              <button type="button" onClick={() => {
                const next: Record<string, number> = {};
                availableProducts.forEach(product => {
                  if (product.id) next[product.id] = Math.max(1, Number(product.stock || 1));
                });
                setQrLabelCounts(next);
              }} className="py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-200 text-[10px] font-black uppercase tracking-[0.16em] hover:bg-white/10">Use Stock Qty</button>
              <button type="button" onClick={() => setQrLabelCounts({})} className="py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-[0.16em] hover:bg-white/10">Clear</button>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-right">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300">Selected Labels</p>
                <p className="text-lg font-black text-white">{selectedQrLabelTotal}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
              {availableProducts.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-slate-500">
                  <Archive size={24} className="mb-3 opacity-70" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em]">No available stock for QR labels</p>
                </div>
              ) : (
                availableProducts.map(product => {
                  const count = Number(product.id ? qrLabelCounts[product.id] || 0 : 0);
                  return (
                    <div key={product.id} className={`grid grid-cols-[minmax(0,1fr)_92px_118px] md:grid-cols-[minmax(0,1fr)_120px_140px_118px] gap-3 items-center rounded-2xl border p-3 ${count > 0 ? 'border-cyan-400/30 bg-cyan-500/10' : 'border-white/10 bg-black/25'}`}>
                      <div className="min-w-0 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-black/35 border border-white/10 flex items-center justify-center text-cyan-300 shrink-0">
                          <Barcode size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-black uppercase text-white truncate">{product.name}</p>
                          <p className="text-[9px] font-bold uppercase text-slate-500 truncate">{product.sku || product.barcode || 'No code'}</p>
                        </div>
                      </div>
                      <p className="hidden md:block text-[10px] font-black text-slate-300 uppercase">{Number(product.stock || 0)} in stock</p>
                      <p className="text-[10px] font-black text-white">LKR {Number(product.price || 0).toLocaleString()}</p>
                      <input
                        type="number"
                        min="0"
                        max="999"
                        value={count || ''}
                        onChange={event => product.id && updateQrLabelCount(product.id, Number(event.target.value))}
                        placeholder="0"
                        className="w-full rounded-xl border border-white/10 bg-black/45 px-3 py-3 text-center text-sm font-black text-white outline-none focus:border-cyan-400"
                      />
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-white/10 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setIsQrModalOpen(false)} className="py-4 rounded-2xl bg-white/5 border border-white/10 text-slate-300 text-[10px] font-black uppercase tracking-[0.22em] hover:bg-white/10">Cancel</button>
              <button type="button" onClick={printBatchQrLabels} disabled={isPrintingQr || selectedQrLabelTotal === 0} className="py-4 rounded-2xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-[0.22em] hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center gap-2">
                {isPrintingQr ? <Loader2 size={16} className="animate-spin" /> : <Barcode size={16} />}
                {isPrintingQr ? 'Preparing...' : 'Print QR Labels'}
              </button>
            </div>
          </div>
        </div>
      )}

      <FloatingAIButton contextData={aiContextData} mode="INVENTORY" position="bottom-right" />
    </div>
  );
};
