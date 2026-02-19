import {
  Edit2, Loader2, PackagePlus, Plus, Search,
  Trash2, X, List, ShieldCheck as ShieldIcon,
  Archive, Calculator, Tag, Barcode, Hash,
  BrainCircuit, Wand2, TrendingUp, AlertTriangle, Package
} from 'lucide-react';
import React, { useEffect, useState, useMemo } from 'react';
import { db, generateId } from '../services/mockDb';
import { generateAiContent } from '../services/ai';
import { MarginType, Product, WarrantyUnit } from '../types';
import { GlassCard } from './ui/GlassCard';
import { GlassInput } from './ui/GlassInput';
import { useAction } from '../context/ActionContext';
import { FloatingAIButton } from '../src/components/ui/FloatingAIButton';
import { QuickAIInsights } from '../src/components/ui/QuickAIInsights';

const PRESET_CATEGORIES = [
  "House Hold", "Baby Products", "Watches & Accessories", "Cosmetic", "Fancy",
  "Footwear", "Stationary", "Vehicle", "Electronic", "Toys",
  "Mobile Phone & Accessories", "Others"
];

export const ProductManager: React.FC = () => {
  const { lastAction, clearAction } = useAction();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

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
        category: category || prev.category
      }));
      setIsEditing(false);
      clearAction();
    }
  }, [lastAction]);

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
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const pricing = calculatePricing(formData);
      const productToSave: Product = {
        ...formData as Product,
        id: isEditing ? (formData.id || '') : generateId(),
        totalCost: Number(formData.cost || 0),
        price: Number(formData.price || pricing.price),
        warrantyYears: Number(formData.warrantyYears || 0),
        warrantyCost: Number(formData.warrantyCost || 0),
        warrantyPrice: Number(formData.warrantyPrice || 0),
        hasWarranty: formData.hasWarranty || false,
        description: formData.description || ''
      };

      if (isEditing) await db.products.update(productToSave);
      else await db.products.add(productToSave);

      await loadProducts();
      resetForm();
    } catch (err) {
      alert("Failed to save product.");
    } finally {
      setIsSaving(false);
    }
  };

  const calculatePricing = (data: Partial<Product>) => {
    const cost = Number(data.cost) || 0;
    const margin = Number(data.marginValue) || 0;
    let selling = data.marginType === MarginType.FIXED
      ? cost + margin
      : cost + (cost * (margin / 100));
    return { price: Math.ceil(selling) };
  };

  const handleGenerateDescription = async () => {
    if (!formData.name) return;
    setIsGeneratingDesc(true);
    try {
      const prompt = `Generate a short, professional, and catchy product description (max 30 words) for a product named "${formData.name}" in the category "${formData.category}". It costs LKR ${formData.price}. Focus on value and quality.`;
      const desc = await generateAiContent(prompt);
      setFormData(prev => ({ ...prev, description: desc }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const inventoryAnalytics = useMemo(() => {
    const totalItems = products.length;
    const totalStockValue = products.reduce((sum, p) => sum + (p.cost * p.stock), 0);
    const totalRetailValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
    const lowStockItems = products.filter(p => p.stock < 5);
    const outOfStock = products.filter(p => p.stock === 0);

    return {
      totalItems,
      totalStockValue,
      totalRetailValue,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStock.length,
      potentialProfit: totalRetailValue - totalStockValue
    };
  }, [products]);

  const aiContextData = useMemo(() => `
INVENTORY SNAPSHOT:
- Total SKUs: ${inventoryAnalytics.totalItems}
- Total Stock Investment: LKR ${inventoryAnalytics.totalStockValue.toLocaleString()}
- Total Retail Value: LKR ${inventoryAnalytics.totalRetailValue.toLocaleString()}
- Expected Profit: LKR ${inventoryAnalytics.potentialProfit.toLocaleString()}
- Low Stock (<5): ${inventoryAnalytics.lowStockCount} items
- Out of Stock: ${inventoryAnalytics.outOfStockCount} items

LOW STOCK LIST:
${products.filter(p => p.stock < 5).map(p => `• ${p.name}: ${p.stock} remaining`).join('\n')}

CATEGORY DISTRIBUTION:
${Object.entries(products.reduce((acc: any, p) => { acc[p.category] = (acc[p.category] || 0) + 1; return acc; }, {})).map(([k, v]) => `${k}: ${v} items`).join('\n')}
  `.trim(), [inventoryAnalytics, products]);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode?.includes(searchQuery)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in h-full min-h-0 relative p-2">
      {/* Sidebar: Analytics & Controls */}
      <div className="lg:col-span-4 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar">
        {/* Analytics Card */}
        <div className="grid grid-cols-2 gap-3 shrink-0">
          <GlassCard className="p-4 bg-blue-600/5 border-blue-500/10">
            <div className="flex justify-between items-start">
              <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Inventory Value</p>
              <Package size={14} className="text-blue-500/50" />
            </div>
            <h3 className="text-sm font-black text-white mt-1">LKR {inventoryAnalytics.totalStockValue.toLocaleString()}</h3>
          </GlassCard>
          <GlassCard className="p-4 bg-red-600/5 border-red-500/10">
            <div className="flex justify-between items-start">
              <p className="text-[8px] font-black text-red-400 uppercase tracking-widest">Low Stock Alert</p>
              <AlertTriangle size={14} className="text-red-500/50" />
            </div>
            <h3 className="text-sm font-black text-white mt-1">{inventoryAnalytics.lowStockCount} Items</h3>
          </GlassCard>
        </div>

        {/* Product Form */}
        <GlassCard className="bg-[#0b1121]/90 p-6 rounded-[2.5rem] border-white/5 flex flex-col flex-1 shadow-2xl overflow-hidden">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <h3 className="text-xs font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${isEditing ? 'bg-orange-600/10 text-orange-500 border-orange-500/10' : 'bg-blue-600/10 text-blue-500 border-blue-500/10'}`}>
                {isEditing ? <Edit2 size={16} /> : <Plus size={16} />}
              </div>
              {isEditing ? 'Edit Product' : 'New Registry'}
            </h3>
            {isEditing && (
              <button onClick={resetForm} className="p-2 text-gray-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            )}
          </div>

          <form onSubmit={handleSaveProduct} className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <section className="space-y-4">
              <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest border-b border-white/5 pb-2">Identification</p>
              <GlassInput label="Product Name" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="E.g. LED Monitor 24" />
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Category</label>
                  <select className="glass-input rounded-xl px-4 py-2.5 text-xs font-bold uppercase bg-black/40 border border-white/10" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                    {PRESET_CATEGORIES.map(c => <option key={c} value={c} className="bg-[#0f172a]">{c}</option>)}
                  </select>
                </div>
                <GlassInput label="SKU / Code" value={formData.sku || ''} onChange={e => setFormData({ ...formData, sku: e.target.value })} placeholder="#SKU-100" />
              </div>
              <GlassInput label="Barcode" value={formData.barcode || ''} onChange={e => setFormData({ ...formData, barcode: e.target.value })} placeholder="Scan or Type..." />

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</label>
                  <button
                    type="button"
                    onClick={handleGenerateDescription}
                    disabled={isGeneratingDesc || !formData.name}
                    className="flex items-center gap-1 text-[8px] font-black text-purple-400 uppercase tracking-wider hover:text-white disabled:opacity-50 transition-colors"
                  >
                    {isGeneratingDesc ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
                    {isGeneratingDesc ? 'Generating...' : 'Magic Generate'}
                  </button>
                </div>
                <textarea
                  className="glass-input rounded-xl px-4 py-3 text-xs outline-none min-h-[80px] bg-black/40 border border-white/10 text-white"
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Product details..."
                />
              </div>
            </section>

            <section className="space-y-4">
              <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest border-b border-white/5 pb-2">Financial Matrix</p>
              <div className="grid grid-cols-2 gap-3">
                <GlassInput label="Unit Cost" type="number" value={formData.cost || ''} onChange={e => setFormData({ ...formData, cost: Number(e.target.value) })} required />
                <GlassInput label="Stock Qty" type="number" value={formData.stock || ''} onChange={e => setFormData({ ...formData, stock: Number(e.target.value) })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <GlassInput label="Retail Rate" type="number" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} required />
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Margin</label>
                  <div className="bg-black/40 rounded-xl p-2.5 border border-white/10 text-xs font-black text-emerald-400 text-center font-mono">
                    {formData.cost && formData.price ? (((formData.price - formData.cost) / formData.cost) * 100).toFixed(1) : '0.0'}%
                  </div>
                </div>
              </div>
            </section>

            <button type="submit" disabled={isSaving} className={`w-full py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] shadow-xl transition-all active:scale-95 ${isEditing ? 'bg-orange-600 hover:bg-orange-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
              {isSaving ? <Loader2 className="animate-spin mx-auto" /> : isEditing ? 'UPDATE PRODUCT' : 'CONFIRM ENTRY'}
            </button>
          </form>
        </GlassCard>
      </div>

      {/* Right Column: Inventory View */}
      <div className="lg:col-span-8 flex flex-col min-h-0 overflow-hidden">
        {/* Quick Insights Bar */}
        <div className="mb-4 px-1 shrink-0">
          <QuickAIInsights
            contextData={aiContextData}
            mode="INVENTORY"
          />
        </div>

        <GlassCard className="bg-[#0b1121]/40 flex-1 flex flex-col overflow-hidden p-6 rounded-[3rem] border-white/5 shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0">
            <div className="flex-1 relative w-full">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700" />
              <input
                placeholder="SEARCH STOCK REPOSITORY..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-[10px] font-black text-white uppercase tracking-[0.2em] outline-none focus:border-blue-500 transition-all placeholder-gray-800"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {filtered.map(product => (
              <div key={product.id} className="p-5 rounded-[2rem] bg-black/40 border border-white/5 flex items-center justify-between group hover:border-blue-500/30 transition-all shadow-sm">
                <div className="flex items-center gap-5 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner shrink-0 ${product.stock < 5 ? 'bg-red-500/10 text-red-400 border-red-500/10' : 'bg-blue-500/10 text-blue-400 border-blue-500/10'}`}>
                    <Archive size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-black text-white uppercase tracking-tight truncate">{product.name}</p>
                      {product.stock < 5 && <AlertTriangle size={12} className="text-red-500 animate-pulse" />}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">{product.category}</span>
                      <span className="text-[8px] bg-white/5 text-gray-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">{product.sku || 'NO SKU'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-black text-white font-mono">LKR {product.price.toLocaleString()}</p>
                    <p className={`text-[10px] font-black uppercase tracking-tighter ${product.stock < 5 ? 'text-red-400' : 'text-gray-600'}`}>
                      {product.stock} Units
                    </p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => { setFormData(product); setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2.5 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-xl hover:bg-blue-600 hover:text-white transition-all">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => { if (confirm("Permanently delete this product?")) db.products.delete(product.id!).then(loadProducts); }} className="p-2.5 text-red-500/40 hover:text-red-500 transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <FloatingAIButton
        contextData={aiContextData}
        mode="INVENTORY"
        position="bottom-right"
      />
    </div>
  );
};
