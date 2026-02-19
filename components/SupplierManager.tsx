
import {
   Banknote, BarChart3,
   CheckCircle, History, ListPlus, Loader2, PackageCheck,
   Phone, Plus, ShoppingBag, Tag, Trash2, Truck,
   User, Wallet, X, Edit, PlusCircle as PlusIcon, Check,
   CreditCard, Ban, ShoppingCart, List, Percent,
   Edit2, BrainCircuit, PhoneCall, AlertTriangle, MessageSquare, UserPlus,
   FileText, ArrowLeft, Search
} from 'lucide-react';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { db, generateId } from '../services/mockDb';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, Supplier, Product, BusinessSettings, MarginType, SupplierPayment } from '../types';
import { GlassCard } from './ui/GlassCard';
import { GlassInput } from './ui/GlassInput';
import { cleanPhone } from '../services/utils';
import { AIAdvisor } from './AIAdvisor';

export const SupplierManager: React.FC = () => {
   const [suppliers, setSuppliers] = useState<Supplier[]>([]);
   const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
   const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
   const [settings, setSettings] = useState<BusinessSettings | null>(null);
   const [searchQuery, setSearchQuery] = useState('');
   const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
   const [expandedPoId, setExpandedPoId] = useState<string | null>(null);

   const [isManualPoModalOpen, setIsManualPoModalOpen] = useState(false);
   const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
   const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
   const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
   const [activePoToReceive, setActivePoToReceive] = useState<PurchaseOrder | null>(null);
   const [editingPoId, setEditingPoId] = useState<string | null>(null);
   const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
   const [oldPaymentAmount, setOldPaymentAmount] = useState<number>(0);
   const [showAiModal, setShowAiModal] = useState(false);

   // Searchable Dropdown State
   const [poVendorSearch, setPoVendorSearch] = useState('');
   const [showPoVendorList, setShowPoVendorList] = useState(false);
   const poVendorListRef = useRef<HTMLDivElement>(null);

   const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({
      name: '', phone: '', hotline: '', workerMobile: '', category: 'General',
      bankName: '', accountNumber: '', branch: '', email: '', address: '', contactPerson: ''
   });
   const [isEditingSupplier, setIsEditingSupplier] = useState(false);

   const [poForm, setPoForm] = useState<{
      supplierId: string;
      items: PurchaseOrderItem[];
      paidAmount: number;
      transportCost: number;
      transportPaidExternal: boolean;
      paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
   }>({
      supplierId: '',
      items: [{ name: '', quantity: 1, unitCost: 0, sellingPrice: 0, receivedQuantity: 0, shortageQuantity: 0, damagedQuantity: 0, discountPercentage: 0 }],
      paidAmount: 0,
      transportCost: 0,
      transportPaidExternal: false,
      paymentMethod: 'CASH'
   });

   const [paymentForm, setPaymentForm] = useState({
      amount: 0,
      note: '',
      method: 'CASH' as 'CASH' | 'BANK_TRANSFER' | 'CHEQUE',
      chequeNumber: '',
      chequeDate: new Date().toISOString().split('T')[0],
      purchaseOrderId: '' as string | undefined
   });

   const [isSaving, setIsSaving] = useState(false);

   useEffect(() => { loadData(); }, []);

   useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
         if (poVendorListRef.current && !poVendorListRef.current.contains(e.target as Node)) {
            setShowPoVendorList(false);
         }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

   const loadData = async () => {
      const [s, po, sett] = await Promise.all([db.suppliers.getAll(), db.purchaseOrders.getAll(), db.settings.get()]);
      setSuppliers(s);
      setPurchaseOrders(po);
      setSettings(sett);
      if (selectedSupplier) {
         const payments = await db.supplierPayments.getBySupplierId(selectedSupplier.id);
         setSupplierPayments(payments);
      }
   };

   const handleSelectSupplier = async (supplier: Supplier) => {
      setSelectedSupplier(supplier);
      const payments = await db.supplierPayments.getBySupplierId(supplier.id);
      setSupplierPayments(payments);
   };

   const getSupplierStats = (supplierId: string) => {
      const orders = purchaseOrders.filter(po => String(po.supplierId) === String(supplierId) && po.status !== 'CANCELLED');
      const totalBilled = orders.reduce((sum, po) => sum + Number(po.totalCost) + (po.transportPaidExternal ? 0 : (po.transportCost || 0)), 0);
      const totalPaidOnOrders = orders.reduce((sum, po) => sum + Number(po.paidAmount || 0), 0);

      // Calculate unlinked payments if available (only accurate when supplier is selected)
      const unlinkedPayments = supplierPayments
         .filter(p => String(p.supplierId) === String(supplierId) && p.chequeStatus !== 'BOUNCED' && !p.purchaseOrderId)
         .reduce((sum, p) => sum + Number(p.amount), 0);

      const totalPaid = totalPaidOnOrders + unlinkedPayments;
      const balance = Math.max(0, totalBilled - totalPaid);

      return { totalBilled, totalPaid, balance };
   };

   const getSupplierContext = () => {
      const totalPending = suppliers.reduce((sum, s) => sum + getSupplierStats(s.id).balance, 0);
      const totalOrders = purchaseOrders.length;
      const pendingOrders = purchaseOrders.filter(p => p.status !== 'RECEIVED').length;
      return `
      Total Active Vendors: ${suppliers.length}
      Total Accounts Payable: LKR ${totalPending}
      Total Purchase Orders: ${totalOrders}
      Pending Deliveries: ${pendingOrders}
    `;
   };

   const handleSaveSupplier = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      try {
         const data: Supplier = {
            ...supplierForm as Supplier,
            phone: cleanPhone(supplierForm.phone || ''),
            hotline: cleanPhone(supplierForm.hotline || ''),
            workerMobile: cleanPhone(supplierForm.workerMobile || ''),
            accountNumber: supplierForm.accountNumber || ''
         };

         let targetId = supplierForm.id;
         if (isEditingSupplier && targetId) {
            await db.suppliers.update(data);
         } else {
            targetId = await db.suppliers.add(data);
         }

         const allSuppliers = await db.suppliers.getAll();
         setSuppliers(allSuppliers);

         const updatedEntity = allSuppliers.find(s => String(s.id) === String(targetId));
         if (updatedEntity) handleSelectSupplier(updatedEntity);

         setIsSupplierModalOpen(false);
         setIsEditingSupplier(false);
      } catch (err: any) {
         alert("Registration Error: " + err.message);
      } finally {
         setIsSaving(false);
      }
   };

   const handleCollectSupplierPayment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedSupplier || paymentForm.amount <= 0) return;
      setIsSaving(true);
      try {
         if (editingPaymentId) {
            await db.supplierPayments.update(
               editingPaymentId,
               oldPaymentAmount,
               paymentForm.amount,
               paymentForm.note,
               paymentForm.method,
               paymentForm.purchaseOrderId
            );
         } else {
            await db.supplierPayments.add({
               supplierId: selectedSupplier.id,
               purchaseOrderId: paymentForm.purchaseOrderId || undefined,
               amount: paymentForm.amount,
               note: paymentForm.note,
               paymentMethod: paymentForm.method,
               chequeNumber: paymentForm.method === 'CHEQUE' ? paymentForm.chequeNumber : undefined,
               chequeDate: paymentForm.method === 'CHEQUE' ? paymentForm.chequeDate : undefined,
               chequeStatus: paymentForm.method === 'CHEQUE' ? 'PENDING' : 'PASSED'
            });
         }

         setIsPaymentModalOpen(false);
         setEditingPaymentId(null);
         setPaymentForm({ amount: 0, note: '', method: 'CASH', chequeNumber: '', chequeDate: new Date().toISOString().split('T')[0], purchaseOrderId: undefined });
         await handleSelectSupplier(selectedSupplier);
         await loadData();
      } catch (err: any) {
         alert(err.message);
      } finally {
         setIsSaving(false);
      }
   };

   const openEditPayment = (p: SupplierPayment) => {
      setEditingPaymentId(p.id);
      setOldPaymentAmount(p.amount);
      setPaymentForm({
         amount: p.amount,
         note: p.note,
         method: p.paymentMethod,
         chequeNumber: p.chequeNumber || '',
         chequeDate: p.chequeDate || new Date().toISOString().split('T')[0],
         purchaseOrderId: p.purchaseOrderId
      });
      setIsPaymentModalOpen(true);
   };

   const handleDeleteAuditItem = async (item: any) => {
      if (!confirm(`Permanently revoke this ${item.type.toLowerCase()} record?`)) return;

      try {
         if (item.type === 'ORDER') {
            await db.purchaseOrders.delete(item.id);
         } else {
            await db.supplierPayments.delete(item.id);
         }

         if (selectedSupplier) await handleSelectSupplier(selectedSupplier);
         await loadData();
      } catch (err: any) {
         alert("Revocation Failed: " + err.message);
      }
   };

   const handleCreatePO = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!poForm.supplierId || poForm.items.length === 0) return;
      setIsSaving(true);
      try {
         const supplier = suppliers.find(s => String(s.id) === String(poForm.supplierId));
         const draftTotal = poForm.items.reduce((sum, i) => sum + ((i.unitCost || 0) * i.quantity), 0);

         if (poForm.items.length === 0 || poForm.items.some(i => !i.name || i.quantity <= 0)) {
            alert("Please add at least one item with a valid name and quantity.");
            return;
         }

         if (!confirm(`Generate Procurement Order for ${supplier?.name || 'Unknown'}?`)) return;

         setIsSaving(true);
         try {
            if (editingPoId) {
               await db.purchaseOrders.update({
                  id: editingPoId,
                  supplierId: poForm.supplierId,
                  supplierName: supplier?.name || 'Unknown',
                  items: poForm.items,
                  totalCost: draftTotal,
                  paidAmount: poForm.paidAmount,
                  paymentMethod: poForm.paymentMethod,
                  status: 'PENDING',
                  date: new Date().toISOString(),
                  transportCost: poForm.transportCost,
                  transportPaidExternal: poForm.transportPaidExternal
               } as PurchaseOrder);
            } else {
               await db.purchaseOrders.add({
                  supplierId: poForm.supplierId,
                  supplierName: supplier?.name || 'Unknown',
                  items: poForm.items,
                  totalCost: draftTotal,
                  paidAmount: poForm.paidAmount,
                  paymentMethod: poForm.paymentMethod,
                  status: 'PENDING',
                  transportCost: poForm.transportCost,
                  transportPaidExternal: poForm.transportPaidExternal
               });
            }

            setIsManualPoModalOpen(false);
            setEditingPoId(null);
            setPoForm({ supplierId: '', items: [{ name: '', quantity: 1, unitCost: 0, sellingPrice: 0, receivedQuantity: 0, shortageQuantity: 0, damagedQuantity: 0, discountPercentage: 0 }], paidAmount: 0, transportCost: 0, transportPaidExternal: false, paymentMethod: 'CASH' });
            await loadData();
         } finally {
            setIsSaving(false);
         }
      } finally {
         setIsSaving(false);
      }
   };

   const handleEditPo = (po: PurchaseOrder) => {
      setEditingPoId(po.id);
      setPoForm({
         supplierId: po.supplierId,
         items: [...po.items],
         paidAmount: po.paidAmount,
         transportCost: po.transportCost || 0,
         transportPaidExternal: po.transportPaidExternal || false,
         paymentMethod: po.paymentMethod || 'CASH'
      });
      setPoVendorSearch(po.supplierName);
      setIsManualPoModalOpen(true);
   };

   const openSettlePoModal = (po: PurchaseOrder) => {
      const balance = (po.totalCost + (po.transportPaidExternal ? 0 : (po.transportCost || 0))) - po.paidAmount;
      if (balance <= 0) return;

      setEditingPaymentId(null);
      setPaymentForm({
         amount: balance,
         note: `Settled balance for PO #${po.id.slice(-6)}`,
         method: 'CASH',
         chequeNumber: '',
         chequeDate: new Date().toISOString().split('T')[0],
         purchaseOrderId: po.id
      });

      const supplier = suppliers.find(s => s.id === po.supplierId);
      if (supplier) setSelectedSupplier(supplier);
      setIsPaymentModalOpen(true);
   };

   const openReceiptModal = (po: PurchaseOrder) => {
      const auditedItems = po.items.map(item => ({
         ...item,
         receivedQuantity: item.receivedQuantity || item.quantity,
         damagedQuantity: item.damagedQuantity || 0,
         discountPercentage: item.discountPercentage || 0,
         unitCost: item.unitCost || 0,
         sellingPrice: item.sellingPrice || 0
      }));
      setActivePoToReceive({ ...po, items: auditedItems, discountAmount: po.discountAmount || 0 });
      setIsReceiptModalOpen(true);
   };

   const calculateAuditedTotal = (po: PurchaseOrder) => {
      const itemsTotal = po.items.reduce((sum, i) => {
         const discountedUnit = (i.unitCost || 0) * (1 - (i.discountPercentage || 0) / 100);
         return sum + ((i.receivedQuantity || 0) * discountedUnit);
      }, 0);
      return Math.max(0, itemsTotal - (po.discountAmount || 0));
   };

   const handleFinalizeReceipt = async () => {
      if (!activePoToReceive) return;

      if (!confirm("Finalize inventory audit and sync to global stock? This action cannot be undone.")) return;

      setIsSaving(true);
      try {
         const products = await db.products.getAll();
         const updatedTotalCost = calculateAuditedTotal(activePoToReceive);

         for (const item of activePoToReceive.items) {
            const received = item.receivedQuantity || 0;
            const actualCostBeforeDisc = item.unitCost || 0;
            const discountedCost = actualCostBeforeDisc * (1 - (item.discountPercentage || 0) / 100);

            if (received <= 0) continue;

            let product = products.find(p =>
               (p.sku && item.productId && p.sku === item.productId) ||
               p.name.toLowerCase().trim() === item.name.toLowerCase().trim()
            );

            const distributedTransport = (activePoToReceive.transportCost || 0) / activePoToReceive.items.length;

            if (product) {
               product.stock += received;
               if (item.sellingPrice && item.sellingPrice > 0) {
                  product.price = item.sellingPrice;
               }
               product.cost = discountedCost;
               product.transportCost = distributedTransport;
               await db.products.update(product);
            } else {
               await db.products.add({
                  name: item.name,
                  sku: item.productId || `SN-${generateId().slice(-4).toUpperCase()}`,
                  category: 'General',
                  cost: discountedCost,
                  price: item.sellingPrice || (discountedCost * 1.25),
                  stock: received,
                  transportCost: distributedTransport,
                  marginType: MarginType.PERCENTAGE,
                  marginValue: 25,
                  warrantyYears: 0,
                  warrantyUnit: 'YEARS',
                  // Default required fields for mockDb add method
                  warrantyCost: 0,
                  warrantyPrice: 0,
                  hasWarranty: false,
                  description: '',
                  barcode: ''
               });
            }
         }

         const updatedPo = {
            ...activePoToReceive,
            totalCost: updatedTotalCost,
            status: 'RECEIVED' as PurchaseOrderStatus
         };

         await db.purchaseOrders.update(updatedPo);

         setIsReceiptModalOpen(false);
         setActivePoToReceive(null);
         await loadData();
      } finally {
         setIsSaving(false);
      }
   };

   const sendWhatsAppPO = (po: PurchaseOrder) => {
      const supplier = suppliers.find(s => s.id === po.supplierId);
      if (!supplier || !settings) return;

      const itemsText = po.items.map(i => `• ${i.name} (Qty: ${i.quantity})`).join('\n');
      const message = `*PURCHASE ORDER: #${po.id.slice(-6)}*\n` +
         `*${settings.businessName}*\n\n` +
         `Vendor: ${po.supplierName}\n` +
         `Date: ${new Date(po.date).toLocaleDateString()}\n\n` +
         `*ORDER MANIFEST:*\n${itemsText}\n\n` +
         `Status: ${po.status}\n\n` +
         `_Please confirm dispatch and expected delivery._`;

      window.open(`https://api.whatsapp.com/send?phone=${cleanPhone(supplier.phone)}&text=${encodeURIComponent(message)}`, '_blank');
   };

   const toggleChequeStatus = async (paymentId: string, currentStatus: string) => {
      const nextStatus = currentStatus === 'PASSED' ? 'BOUNCED' : 'PASSED';
      if (!confirm(`Mark cheque as ${nextStatus}? This will adjust vendor balance.`)) return;
      await db.supplierPayments.updateStatus(paymentId, nextStatus);
      if (selectedSupplier) await handleSelectSupplier(selectedSupplier);
   };

   const filteredSuppliers = useMemo(() => {
      return suppliers.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
   }, [suppliers, searchQuery]);

   return (
      <div className="h-full flex flex-col overflow-hidden relative">
         {/* --- MAIN UI --- */}
         {selectedSupplier ? (
            <div className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-300">
               <div className="flex justify-between items-center gap-2 mb-4 shrink-0">
                  <button onClick={() => setSelectedSupplier(null)} className="flex items-center gap-2 text-gray-500 hover:text-white transition-all group">
                     <div className="p-2 rounded-lg bg-white/5 border border-white/10 group-hover:bg-blue-600/10 transition-all">
                        <ArrowLeft size={16} />
                     </div>
                     <span className="font-black uppercase text-[9px] tracking-widest">Global Repository</span>
                  </button>
                  <div className="flex gap-2">
                     <button onClick={() => { setSupplierForm({ ...selectedSupplier }); setIsEditingSupplier(true); setIsSupplierModalOpen(true); }} className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase text-gray-400 hover:text-white transition-all flex items-center gap-2 shadow-sm"><Edit size={14} /> Profile Edit</button>
                     <button onClick={() => { setEditingPaymentId(null); setIsPaymentModalOpen(true); }} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-all">Settle Account</button>
                  </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 overflow-hidden">
                  <div className="lg:col-span-4 flex flex-col min-h-0">
                     <GlassCard className="bg-[#0b1121]/90 p-8 rounded-[2.5rem] flex-1 flex flex-col border-white/5 shadow-2xl overflow-hidden">
                        <div className="text-center mb-8 shrink-0">
                           <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] mx-auto mb-5 flex items-center justify-center text-4xl font-black text-white shadow-3xl shadow-blue-600/30 transform hover:scale-105 transition-all">{selectedSupplier.name.charAt(0)}</div>
                           <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none mb-2 truncate">{selectedSupplier.name}</h2>
                           <div className="flex items-center justify-center gap-2">
                              <span className="text-[9px] text-blue-500 font-black uppercase tracking-widest px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/10">{selectedSupplier.category}</span>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-6 shrink-0">
                           <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                              <p className="text-[8px] font-black text-gray-700 uppercase mb-1">Total Orders</p>
                              <p className="text-sm font-black text-white">{purchaseOrders.filter(po => String(po.supplierId) === String(selectedSupplier.id)).length}</p>
                           </div>
                           <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
                              <p className="text-[8px] font-black text-gray-700 uppercase mb-1">Clearance</p>
                              <p className="text-sm font-black text-emerald-400">98%</p>
                           </div>
                        </div>

                        <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-0">
                           <div className="p-6 bg-gradient-to-br from-red-600/10 to-transparent rounded-[2rem] border border-red-500/10 shrink-0">
                              <div className="flex justify-between items-center mb-1">
                                 <span className="text-[9px] uppercase font-black text-gray-500">Unsettled Balance</span>
                                 <AlertTriangle size={14} className="text-red-500/50" />
                              </div>
                              <span className="text-2xl font-black font-mono text-red-400">LKR {getSupplierStats(selectedSupplier.id).balance.toLocaleString()}</span>
                           </div>

                           <div className="grid grid-cols-1 gap-2.5">
                              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between group">
                                 <div className="min-w-0">
                                    <p className="text-[8px] font-black text-gray-700 uppercase">Primary Contact</p>
                                    <p className="text-[12px] text-gray-300 font-bold truncate">{selectedSupplier.hotline || selectedSupplier.phone || 'N/A'}</p>
                                 </div>
                                 <Phone size={16} className="text-blue-500 opacity-20 group-hover:opacity-100 transition-all shrink-0" />
                              </div>
                           </div>
                        </div>
                     </GlassCard>
                  </div>

                  <div className="lg:col-span-8 flex flex-col min-h-0 overflow-hidden">
                     <GlassCard className="bg-[#0b1121]/40 flex-1 flex flex-col overflow-hidden p-8 rounded-[3rem] border-white/5 shadow-xl">
                        <div className="flex justify-between items-center mb-8 shrink-0">
                           <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em] flex items-center gap-3"><History size={18} className="text-blue-500" /> Audit Ledger</h3>
                           <div className="flex gap-2">
                              <button className="p-2 bg-white/5 rounded-xl text-gray-500 hover:text-white transition-all" onClick={loadData}><BarChart3 size={16} /></button>
                           </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar min-h-0 will-change-transform scroll-smooth">
                           {[
                              ...supplierPayments.map(p => ({ ...p, type: 'PAYMENT' })),
                              ...purchaseOrders.filter(po => String(po.supplierId) === String(selectedSupplier.id)).map(po => ({ ...po, type: 'ORDER' }))
                           ].sort((a: any, b: any) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime()).map((item: any) => (
                              <div key={item.id} className="p-6 rounded-[2.5rem] bg-black/40 border border-white/5 flex items-center justify-between group hover:border-blue-500/20 transition-all shadow-sm">
                                 <div className="flex items-center gap-5 min-w-0">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-inner shrink-0 ${item.type === 'PAYMENT' ? (item.chequeStatus === 'BOUNCED' ? 'bg-red-500/10 text-red-400 border-red-500/10' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10') :
                                       'bg-blue-500/10 text-blue-400 border-blue-500/10'
                                       }`}>
                                       {item.type === 'PAYMENT' ? (item.paymentMethod === 'CHEQUE' ? <CreditCard size={24} /> : <Banknote size={24} />) : <ShoppingBag size={24} />}
                                    </div>
                                    <div className="min-w-0">
                                       <p className="text-xs font-black text-white uppercase tracking-tight truncate">
                                          {item.type === 'PAYMENT' ? `Settlement: ${item.paymentMethod}` : `Procurement: #${item.id.slice(-6)}`}
                                       </p>
                                       <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                          <span className="text-[8px] text-gray-600 font-bold uppercase tracking-widest shrink-0">{new Date(item.date || item.created_at).toLocaleDateString()}</span>
                                          {item.chequeNumber && <span className="text-[8px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest shrink-0">Chq: {item.chequeNumber}</span>}
                                          {item.type === 'ORDER' && <span className={`text-[7px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest shrink-0 ${item.status === 'RECEIVED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'}`}>{item.status}</span>}
                                          {item.type === 'PAYMENT' && item.purchaseOrderId && <span className="text-[7px] bg-white/5 text-gray-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest shrink-0">Linked to PO</span>}
                                       </div>
                                       {item.note && <p className="text-[9px] text-gray-700 italic mt-1 font-medium line-clamp-1">{item.note}</p>}
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-8 text-right shrink-0">
                                    <div>
                                       <p className={`text-lg font-black font-mono tracking-tighter ${item.type === 'PAYMENT' ? (item.chequeStatus === 'BOUNCED' ? 'text-gray-700 line-through' : 'text-emerald-400') : 'text-red-400'}`}>
                                          {item.type === 'PAYMENT' ? '-' : '+'} LKR {(item.amount || item.totalCost).toLocaleString()}
                                       </p>
                                       <span className="text-[8px] font-black text-gray-700 uppercase tracking-tighter">{item.type === 'PAYMENT' ? 'Treasury Debit' : 'Vendor Credit'}</span>
                                    </div>

                                    <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                                       {item.type === 'ORDER' && item.status !== 'RECEIVED' && (
                                          <button onClick={() => openReceiptModal(item)} className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-lg hover:bg-emerald-500 transition-all"><PackageCheck size={16} /></button>
                                       )}
                                       {item.type === 'ORDER' && (
                                          <button onClick={() => sendWhatsAppPO(item)} className="p-2.5 bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"><MessageSquare size={16} /></button>
                                       )}
                                       {item.type === 'ORDER' && item.status !== 'RECEIVED' && (
                                          <button onClick={() => handleEditPo(item)} className="p-2.5 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Edit size={16} /></button>
                                       )}
                                       {item.type === 'PAYMENT' && (
                                          <button onClick={() => openEditPayment(item)} className="p-2.5 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Edit2 size={16} /></button>
                                       )}
                                       {item.paymentMethod === 'CHEQUE' && (
                                          <button onClick={() => toggleChequeStatus(item.id, item.chequeStatus)} className={`p-2.5 rounded-xl border transition-all ${item.chequeStatus === 'PASSED' ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500 hover:text-white' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-600 hover:text-white'}`}>
                                             {item.chequeStatus === 'PASSED' ? <Ban size={16} /> : <Check size={16} />}
                                          </button>
                                       )}
                                       <button onClick={() => handleDeleteAuditItem(item)} className="p-2.5 text-red-500/40 hover:text-red-500"><Trash2 size={16} /></button>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </GlassCard>
                  </div>
               </div>
            </div>
         ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-6 animate-in fade-in duration-500">
               <div className="grid grid-cols-1 md:grid-cols-12 gap-4 shrink-0 px-1">
                  <div className="md:col-span-8">
                     <GlassCard className="p-4 border-white/5 bg-white/5 rounded-2xl">
                        <div className="flex gap-4">
                           <div className="flex-1 relative">
                              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700" />
                              <input placeholder="SEARCH GLOBAL VENDORS..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-[10px] font-black text-white uppercase tracking-[0.2em] outline-none focus:border-blue-500 transition-all placeholder-gray-800" />
                           </div>
                           <button onClick={() => { setSupplierForm({ name: '', phone: '', hotline: '', workerMobile: '', category: 'General', bankName: '', accountNumber: '', branch: '', email: '', address: '', contactPerson: '' }); setIsEditingSupplier(false); setIsSupplierModalOpen(true); }} className="px-6 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-2">
                              <UserPlus size={14} /> New Profile
                           </button>
                        </div>
                     </GlassCard>
                  </div>
                  <div className="md:col-span-4 flex gap-2">
                     <button onClick={() => { setEditingPoId(null); setPoVendorSearch(''); setIsManualPoModalOpen(true); }} className="flex-1 h-full bg-emerald-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-[0.4em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                        <Plus size={18} /> New Order
                     </button>
                     <button onClick={() => setShowAiModal(true)} className="p-4 bg-purple-600/10 text-purple-500 border border-purple-500/20 rounded-2xl hover:bg-purple-600 hover:text-white transition-all shadow-lg">
                        <BrainCircuit size={20} />
                     </button>
                  </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 lg:overflow-hidden overflow-y-auto px-1 pb-4 custom-scrollbar">
                  <div className="lg:col-span-4 flex flex-col h-[500px] lg:h-auto lg:min-h-0">
                     <GlassCard className="border-white/5 bg-[#0b1121]/40 flex-1 flex flex-col overflow-hidden p-6 rounded-[2rem]">
                        <h3 className="text-[9px] font-black text-white uppercase tracking-[0.5em] mb-6 shrink-0 flex items-center gap-3">
                           <ListPlus size={14} className="text-blue-500" /> Directory Hub
                        </h3>
                        <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar min-h-0 will-change-transform scroll-smooth">
                           {filteredSuppliers.map(s => {
                              const stats = getSupplierStats(s.id);
                              return (
                                 <div key={s.id} onClick={() => handleSelectSupplier(s)} className="p-4 rounded-2xl border border-white/5 bg-white/5 hover:border-blue-500/30 transition-all flex flex-col gap-3 group cursor-pointer shadow-sm">
                                    <div className="flex justify-between items-center">
                                       <div className="min-w-0 flex-1">
                                          <p className="text-[12px] font-black text-white uppercase truncate tracking-tight">{s.name}</p>
                                          <div className="flex items-center gap-2 mt-1">
                                             <PhoneCall size={10} className="text-blue-500 opacity-50" />
                                             <p className="text-[8px] text-gray-600 font-bold uppercase">{s.phone || 'NO CONTACT'}</p>
                                          </div>
                                       </div>
                                       <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-black text-gray-500 border border-white/5 shadow-inner">
                                          {s.name.charAt(0)}
                                       </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-2">
                                       <div>
                                          <p className="text-[7px] text-gray-500 uppercase font-bold tracking-widest mb-0.5">Billed</p>
                                          <p className="text-[9px] text-gray-400 font-mono">LKR {stats.totalBilled.toLocaleString()}</p>
                                       </div>
                                       <div>
                                          <p className="text-[7px] text-gray-500 uppercase font-bold tracking-widest mb-0.5">Paid</p>
                                          <p className="text-[9px] text-emerald-500 font-mono">LKR {stats.totalPaid.toLocaleString()}</p>
                                       </div>
                                       <div>
                                          <p className="text-[7px] text-gray-500 uppercase font-bold tracking-widest mb-0.5">Due</p>
                                          <p className={`text-[9px] font-mono font-black ${stats.balance > 0 ? 'text-red-400' : 'text-gray-600'}`}>LKR {stats.balance.toLocaleString()}</p>
                                       </div>
                                    </div>
                                 </div>
                              )
                           })}
                        </div>
                     </GlassCard>
                  </div>

                  <div className="lg:col-span-8 flex flex-col h-[500px] lg:h-auto lg:min-h-0">
                     <GlassCard className="border-white/5 bg-[#0b1121]/40 flex-1 flex flex-col overflow-hidden p-6 rounded-[2rem]">
                        <h3 className="text-[9px] font-black text-white uppercase tracking-[0.5em] mb-6 shrink-0 flex items-center gap-3">
                           <Truck size={16} className="text-emerald-500" /> Pipeline Operations
                        </h3>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar min-h-0 will-change-transform scroll-smooth">
                           {purchaseOrders.map(po => (
                              <div key={po.id} className="p-4 rounded-3xl border border-white/5 bg-black/40 group hover:border-emerald-500/20 transition-all shadow-md">
                                 <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                                    <div className="flex items-center gap-4 min-w-0">
                                       <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 group-hover:border-blue-500/20 shrink-0">
                                          <ShoppingCart size={18} className="text-blue-500 opacity-50" />
                                       </div>
                                       <div className="min-w-0">
                                          <p className="text-[11px] font-black text-white uppercase truncate">Order #{po.id.slice(-6)} • {po.supplierName}</p>
                                          <div className="flex items-center gap-2 mt-0.5">
                                             <span className={`text-[7px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest shrink-0 ${po.status === 'RECEIVED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'}`}>{po.status}</span>
                                             <span className="text-[7px] text-gray-700 font-black uppercase tracking-widest shrink-0">{new Date(po.date).toLocaleDateString()}</span>
                                          </div>
                                       </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                       {po.status !== 'RECEIVED' && (po.totalCost > po.paidAmount) && (
                                          <button onClick={() => openSettlePoModal(po)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg flex items-center gap-2">
                                             <Banknote size={12} /> Settle Balance
                                          </button>
                                       )}
                                       <button onClick={() => sendWhatsAppPO(po)} className="p-2 bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 rounded-lg hover:bg-emerald-600 hover:text-white transition-all"><MessageSquare size={14} /></button>
                                       {po.status !== 'RECEIVED' && (
                                          <>
                                             <button onClick={() => handleEditPo(po)} className="p-2 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-lg hover:bg-blue-600 hover:text-white transition-all"><Edit size={14} /></button>
                                             <button onClick={() => openReceiptModal(po)} className="p-2 bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 rounded-lg hover:bg-emerald-600 hover:text-white transition-all"><PackageCheck size={14} /></button>
                                          </>
                                       )}
                                       <button onClick={() => { if (confirm("Permanently remove record?")) db.purchaseOrders.delete(po.id).then(loadData); }} className="p-2 text-red-500/20 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                                    </div>
                                 </div>

                                 <div className="mb-4 bg-black/60 rounded-2xl p-4 border border-white/5">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                       <div className="flex items-center gap-2">
                                          <List size={12} className="text-gray-600" />
                                          <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Order Manifest ({po.items.length} lines)</span>
                                       </div>
                                       <button onClick={() => setExpandedPoId(expandedPoId === po.id ? null : po.id)} className="text-[7px] font-black text-blue-500 uppercase tracking-widest border-b border-blue-500/20 px-1 py-0.5 hover:bg-blue-600/10 transition-all rounded">
                                          {expandedPoId === po.id ? 'Collapse' : 'Show Items'}
                                       </button>
                                    </div>
                                    {expandedPoId === po.id && (
                                       <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-1 animate-in fade-in slide-in-from-top-1 will-change-contents">
                                          {po.items.map((item, i) => (
                                             <div key={i} className="flex justify-between items-center text-[10px] py-2 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors rounded-lg px-2">
                                                <div className="flex flex-col min-w-0">
                                                   <span className="text-gray-400 font-bold uppercase truncate pr-4">{item.name}</span>
                                                   {item.unitCost > 0 && <span className="text-[8px] text-gray-600 font-black uppercase">Cost: LKR {(item.unitCost || 0).toLocaleString()}</span>}
                                                </div>
                                                <div className="text-right shrink-0">
                                                   <span className="text-white font-mono">{item.quantity} units</span>
                                                   {item.unitCost > 0 && <p className="text-[9px] text-blue-400 font-mono">LKR {((item.unitCost || 0) * item.quantity).toLocaleString()}</p>}
                                                </div>
                                             </div>
                                          ))}
                                       </div>
                                    )}
                                 </div>

                                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-white/5 p-2 rounded-xl border border-white/5 text-center">
                                       <p className="text-[7px] font-black text-gray-700 uppercase">Items</p>
                                       <p className="text-[10px] font-black text-white">{po.items.length}</p>
                                    </div>
                                    <div className="bg-white/5 p-2 rounded-xl border border-white/5 text-center">
                                       <p className="text-[7px] font-black text-gray-700 uppercase">Paid So Far</p>
                                       <p className="text-[10px] font-black text-emerald-400 font-mono">{(po.paidAmount || 0).toLocaleString()}</p>
                                    </div>
                                    <div className="bg-white/5 p-2 rounded-xl border border-white/5 text-center">
                                       <p className="text-[7px] font-black text-gray-700 uppercase">Remaining</p>
                                       <p className={`text-[10px] font-black font-mono ${po.totalCost - po.paidAmount > 0 ? 'text-red-400' : 'text-gray-600'}`}>{(po.totalCost - po.paidAmount).toLocaleString()}</p>
                                    </div>
                                    <div className="bg-blue-600/10 p-2 rounded-xl border border-blue-600/20 text-center">
                                       <p className="text-[7px] font-black text-blue-400 uppercase">Grand Total</p>
                                       <p className="text-[10px] font-black text-white font-mono">{po.totalCost.toLocaleString()}</p>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </GlassCard>
                  </div>
               </div>
            </div>
         )}

         {/* --- MODALS --- */}

         {isSupplierModalOpen && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-4">
               <GlassCard className="w-full max-w-lg bg-[#0b1121] p-10 rounded-[3rem] border-2 border-white/10 shadow-3xl animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-8 shrink-0">
                     <h3 className="text-base font-black text-white uppercase tracking-widest flex items-center gap-3">
                        <UserPlus size={20} className="text-blue-500" /> {isEditingSupplier ? 'Modify Vendor' : 'New Vendor'}
                     </h3>
                     <button onClick={() => setIsSupplierModalOpen(false)} className="p-3 text-gray-500 hover:text-white bg-white/5 rounded-full"><X size={18} /></button>
                  </div>
                  <form onSubmit={handleSaveSupplier} className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
                     <div className="grid grid-cols-2 gap-4">
                        <GlassInput label="Vendor Name" value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} required className="col-span-2" />
                        <GlassInput label="Primary Phone" value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
                        <GlassInput label="Hotline (Opt)" value={supplierForm.hotline} onChange={e => setSupplierForm({ ...supplierForm, hotline: e.target.value })} />
                     </div>
                     <GlassInput label="Contact Person" value={supplierForm.contactPerson} onChange={e => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })} />
                     <GlassInput label="Email Address" type="email" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} />

                     <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Office Address</label>
                        <textarea className="glass-input rounded-2xl px-5 py-4 text-xs outline-none min-h-[80px]" value={supplierForm.address} onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })} />
                     </div>

                     <div className="p-4 bg-white/5 rounded-2xl border border-white/5 mt-2">
                        <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-3">Bank Details</p>
                        <div className="grid grid-cols-2 gap-4">
                           <GlassInput label="Bank Name" value={supplierForm.bankName} onChange={e => setSupplierForm({ ...supplierForm, bankName: e.target.value })} />
                           <GlassInput label="Branch" value={supplierForm.branch} onChange={e => setSupplierForm({ ...supplierForm, branch: e.target.value })} />
                           <GlassInput label="Account Number" value={supplierForm.accountNumber} onChange={e => setSupplierForm({ ...supplierForm, accountNumber: e.target.value })} className="col-span-2" />
                        </div>
                     </div>

                     <button type="submit" disabled={isSaving} className="w-full py-5 bg-blue-600 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.3em] shadow-xl hover:bg-blue-500 transition-all mt-4">
                        {isSaving ? <Loader2 className="animate-spin mx-auto" /> : 'SAVE PROFILE'}
                     </button>
                  </form>
               </GlassCard>
            </div>
         )}

         {isManualPoModalOpen && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-4">
               <GlassCard className="w-full max-w-4xl bg-[#0b1121] p-10 rounded-[3rem] border-2 border-white/10 shadow-3xl animate-in zoom-in-95 flex flex-col max-h-[90vh] overflow-visible relative">
                  <div className="flex justify-between items-center mb-8 shrink-0">
                     <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
                        <FileText size={24} className="text-emerald-500" /> Procurement Order
                     </h3>
                     <button onClick={() => setIsManualPoModalOpen(false)} className="p-3 text-gray-500 hover:text-white bg-white/5 rounded-full"><X size={20} /></button>
                  </div>

                  <form onSubmit={handleCreatePO} className="flex-1 flex flex-col overflow-hidden">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 shrink-0 relative z-[1050]">
                        <div className="relative" ref={poVendorListRef}>
                           <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 mb-2 block">Vendor Selection</label>
                           <input
                              className="w-full glass-input rounded-2xl px-5 py-4 text-xs font-black uppercase outline-none focus:border-blue-500 transition-all"
                              placeholder="Search Vendor..."
                              value={poVendorSearch}
                              onChange={e => { setPoVendorSearch(e.target.value); setShowPoVendorList(true); }}
                              onFocus={() => setShowPoVendorList(true)}
                           />
                           {showPoVendorList && (
                              <div className="absolute top-full left-0 right-0 mt-2 bg-[#0f172a] border border-white/10 rounded-2xl shadow-3xl max-h-48 overflow-y-auto custom-scrollbar z-50">
                                 {suppliers.filter(s => s.name.toLowerCase().includes(poVendorSearch.toLowerCase())).map(s => (
                                    <div key={s.id} onClick={() => { setPoForm({ ...poForm, supplierId: s.id }); setPoVendorSearch(s.name); setShowPoVendorList(false); }} className="p-4 hover:bg-blue-600/20 cursor-pointer border-b border-white/5 last:border-0">
                                       <p className="text-[10px] font-black text-white uppercase">{s.name}</p>
                                    </div>
                                 ))}
                              </div>
                           )}
                        </div>
                        <div>
                           <GlassInput label="Advance Payment" type="number" value={poForm.paidAmount || ''} onChange={e => setPoForm({ ...poForm, paidAmount: Number(e.target.value) })} />
                        </div>
                     </div>

                     <div className="flex-1 overflow-y-auto custom-scrollbar mb-6 pr-2 bg-white/5 rounded-[2rem] p-4 border border-white/5 relative z-0">
                        <div className="flex justify-between items-center mb-4 px-2">
                           <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Order Items</span>
                           <button type="button" onClick={() => setPoForm({ ...poForm, items: [...poForm.items, { name: '', quantity: 1, unitCost: 0, sellingPrice: 0 }] })} className="text-[9px] font-black text-blue-400 uppercase tracking-widest hover:text-white flex items-center gap-1"><PlusIcon size={12} /> Add Line</button>
                        </div>
                        {poForm.items.map((item, idx) => (
                           <div key={idx} className="grid grid-cols-12 gap-3 mb-3 items-end">
                              <div className="col-span-5">
                                 <input className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none" placeholder="Item Name" value={item.name} onChange={e => { const n = [...poForm.items]; n[idx].name = e.target.value; setPoForm({ ...poForm, items: n }); }} />
                              </div>
                              <div className="col-span-2">
                                 <input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none text-center" placeholder="Qty" value={item.quantity} onChange={e => { const n = [...poForm.items]; n[idx].quantity = Number(e.target.value); setPoForm({ ...poForm, items: n }); }} />
                              </div>
                              <div className="col-span-3">
                                 <input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none text-right" placeholder="Cost" value={item.unitCost || ''} onChange={e => { const n = [...poForm.items]; n[idx].unitCost = Number(e.target.value); setPoForm({ ...poForm, items: n }); }} />
                              </div>
                              <div className="col-span-2 flex items-center justify-center">
                                 <button type="button" onClick={() => { const n = [...poForm.items]; n.splice(idx, 1); setPoForm({ ...poForm, items: n }); }} className="p-2 text-red-500/50 hover:text-red-500"><Trash2 size={14} /></button>
                              </div>
                           </div>
                        ))}
                     </div>

                     <div className="grid grid-cols-3 gap-6 shrink-0 bg-black/40 p-6 rounded-[2rem] border border-white/5 relative z-0">
                        <div>
                           <GlassInput label="Transport Cost" type="number" value={poForm.transportCost || ''} onChange={e => setPoForm({ ...poForm, transportCost: Number(e.target.value) })} />
                           <div className="mt-2 flex items-center gap-2">
                              <input type="checkbox" checked={poForm.transportPaidExternal} onChange={e => setPoForm({ ...poForm, transportPaidExternal: e.target.checked })} className="rounded border-white/20 bg-black/40" />
                              <span className="text-[9px] font-bold text-gray-500 uppercase">Paid External?</span>
                           </div>
                        </div>
                        <div className="col-span-2 flex flex-col justify-end items-end">
                           <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Estimated Total</p>
                           <p className="text-3xl font-black text-emerald-400 font-mono tracking-tighter">
                              LKR {(poForm.items.reduce((sum, i) => sum + ((i.unitCost || 0) * i.quantity), 0) + (poForm.transportPaidExternal ? 0 : (poForm.transportCost || 0))).toLocaleString()}
                           </p>
                        </div>
                     </div>

                     <button type="submit" disabled={isSaving} className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.4em] shadow-xl hover:bg-emerald-500 transition-all mt-6 active:scale-95">
                        {isSaving ? <Loader2 className="animate-spin mx-auto" /> : 'CONFIRM ORDER'}
                     </button>
                  </form>
               </GlassCard>
            </div>
         )}

         {isReceiptModalOpen && activePoToReceive && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-6 md:p-12">
               <GlassCard className="w-full max-w-5xl bg-[#0b1121] p-8 rounded-[2.5rem] border-2 border-white/10 shadow-3xl overflow-hidden flex flex-col max-h-[85vh]">
                  <div className="flex justify-between items-center mb-8 shrink-0">
                     <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-blue-600/10 text-blue-500 rounded-2xl flex items-center justify-center border border-blue-500/20">
                           <PackageCheck size={32} />
                        </div>
                        <div>
                           <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Inventory Audit & Verification</h3>
                           <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.4em]">Apply Item Discounts & Sync to Main Stock Hub</p>
                        </div>
                     </div>
                     <button onClick={() => { setIsReceiptModalOpen(false); setActivePoToReceive(null); }} className="p-4 bg-white/5 text-gray-500 hover:text-white rounded-2xl"><X size={28} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4 mb-8">
                     <div className="grid grid-cols-12 gap-4 px-6 mb-2">
                        <div className="col-span-3 text-[9px] font-black text-gray-700 uppercase tracking-widest">Component Name</div>
                        <div className="col-span-2 text-[9px] font-black text-emerald-500 uppercase tracking-widest text-center">Receipt Qty</div>
                        <div className="col-span-2 text-[9px] font-black text-blue-500 uppercase tracking-widest text-center">Unit Cost (Raw)</div>
                        <div className="col-span-1 text-[9px] font-black text-orange-400 uppercase tracking-widest text-center">Disc %</div>
                        <div className="col-span-2 text-[9px] font-black text-blue-400 uppercase tracking-widest text-center">Net Cost</div>
                        <div className="col-span-2 text-[9px] font-black text-emerald-400 uppercase tracking-widest text-right">Retail Rate</div>
                     </div>
                     {activePoToReceive.items.map((item, idx) => {
                        const discountedNet = (item.unitCost || 0) * (1 - (item.discountPercentage || 0) / 100);
                        return (
                           <div key={idx} className="grid grid-cols-12 gap-4 p-6 bg-white/5 rounded-[2.5rem] border border-white/5 items-center group hover:bg-white/10 transition-all">
                              <div className="col-span-3">
                                 <p className="text-sm font-black text-white uppercase truncate">{item.name}</p>
                                 <p className="text-[8px] text-gray-700 font-bold uppercase tracking-widest">Ordered: {item.quantity}</p>
                              </div>
                              <div className="col-span-2">
                                 <input
                                    type="number"
                                    className="w-full bg-black/60 border border-emerald-500/20 rounded-xl py-3 px-4 text-xs font-black text-emerald-400 outline-none text-center"
                                    value={item.receivedQuantity || ''}
                                    placeholder="0"
                                    onChange={e => {
                                       const newItems = [...activePoToReceive.items];
                                       newItems[idx].receivedQuantity = Number(e.target.value);
                                       setActivePoToReceive({ ...activePoToReceive, items: newItems });
                                    }}
                                 />
                              </div>
                              <div className="col-span-2">
                                 <input
                                    type="number"
                                    className="w-full bg-black/60 border border-blue-500/20 rounded-xl py-3 px-4 text-xs font-black text-blue-400 outline-none text-center"
                                    value={item.unitCost || ''}
                                    placeholder="Raw LKR"
                                    onChange={e => {
                                       const newItems = [...activePoToReceive.items];
                                       newItems[idx].unitCost = Number(e.target.value);
                                       setActivePoToReceive({ ...activePoToReceive, items: newItems });
                                    }}
                                 />
                              </div>
                              <div className="col-span-1">
                                 <div className="relative">
                                    <input
                                       type="number"
                                       className="w-full bg-black/60 border border-orange-500/20 rounded-xl py-3 px-3 text-xs font-black text-orange-400 outline-none text-center"
                                       value={item.discountPercentage || ''}
                                       placeholder="0"
                                       onChange={e => {
                                          const newItems = [...activePoToReceive.items];
                                          newItems[idx].discountPercentage = Number(e.target.value);
                                          setActivePoToReceive({ ...activePoToReceive, items: newItems });
                                       }}
                                    />
                                    <Percent size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-orange-500/50" />
                                 </div>
                              </div>
                              <div className="col-span-2 text-center">
                                 <p className="text-sm font-black text-blue-300 font-mono">LKR {(discountedNet * (item.receivedQuantity || 0)).toLocaleString()}</p>
                                 <p className="text-[7px] text-gray-700 font-black uppercase tracking-tighter">@{discountedNet.toLocaleString()}/u</p>
                              </div>
                              <div className="col-span-2 text-right">
                                 <input
                                    type="number"
                                    className="w-full bg-black/60 border border-emerald-500/20 rounded-xl py-3 px-4 text-xs font-black text-emerald-400 outline-none text-right"
                                    value={item.sellingPrice || ''}
                                    placeholder="Retail LKR"
                                    onChange={e => {
                                       const newItems = [...activePoToReceive.items];
                                       newItems[idx].sellingPrice = Number(e.target.value);
                                       setActivePoToReceive({ ...activePoToReceive, items: newItems });
                                    }}
                                 />
                              </div>
                           </div>
                        )
                     })}
                  </div>

                  <div className="p-8 bg-blue-600/5 border border-blue-500/10 rounded-[3rem] flex flex-col lg:flex-row justify-between items-center gap-8 shrink-0">
                     <div className="flex gap-8 items-center w-full lg:w-auto">
                        <div>
                           <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Adjust Final Bill</p>
                           <div className="relative">
                              <input
                                 type="number"
                                 className="bg-black/40 border border-white/10 rounded-2xl py-3 px-10 text-xs font-black text-red-400 outline-none focus:border-red-500 transition-all"
                                 placeholder="Additional Discount..."
                                 value={activePoToReceive.discountAmount || ''}
                                 onChange={e => setActivePoToReceive({ ...activePoToReceive, discountAmount: Number(e.target.value) })}
                              />
                              <Tag size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700" />
                           </div>
                        </div>
                        <div className="h-12 w-px bg-white/10 hidden lg:block"></div>
                        <div>
                           <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Audited Settlement</p>
                           <p className="text-3xl font-black text-white font-mono">
                              LKR {calculateAuditedTotal(activePoToReceive).toLocaleString()}
                           </p>
                        </div>
                     </div>
                     <button onClick={handleFinalizeReceipt} disabled={isSaving} className="w-full lg:w-auto px-16 py-6 bg-blue-600 text-white rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.5em] shadow-2xl active:scale-95 transition-all">
                        {isSaving ? <Loader2 className="animate-spin mx-auto" /> : 'VERIFY & SYNC GLOBAL INVENTORY'}
                     </button>
                  </div>
               </GlassCard>
            </div>
         )}

         {isPaymentModalOpen && selectedSupplier && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-4">
               <GlassCard className="w-full max-w-lg bg-[#0b1121] p-12 rounded-[4rem] border-2 border-white/10 shadow-3xl animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-10">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-600/10 text-emerald-500 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                           <Banknote size={28} />
                        </div>
                        <div>
                           <h3 className="text-xl font-black text-white uppercase tracking-tight">{editingPaymentId ? 'Adjust Settlement' : 'Treasury Settlement'}</h3>
                           <p className="text-[9px] text-gray-600 font-black uppercase tracking-[0.3em]">{editingPaymentId ? 'Revise Transaction' : 'Authorize Payout'}</p>
                        </div>
                     </div>
                     <button onClick={() => { setIsPaymentModalOpen(false); setEditingPaymentId(null); }} className="p-4 bg-white/5 text-gray-500 hover:text-white rounded-2xl transition-all"><X size={24} /></button>
                  </div>
                  <form onSubmit={handleCollectSupplierPayment} className="space-y-8">
                     <div className="p-6 bg-red-600/5 border border-red-500/10 rounded-[2rem] flex justify-between items-center shadow-inner">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Outstanding Debt</span>
                        <span className="text-xl font-black text-red-400 font-mono">LKR {getSupplierStats(selectedSupplier.id).balance.toLocaleString()}</span>
                     </div>

                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Payment Protocol</label>
                        <div className="flex gap-2 p-1.5 bg-black/60 rounded-[2rem] border border-white/10">
                           <button type="button" onClick={() => setPaymentForm({ ...paymentForm, method: 'CASH' })} className={`flex-1 py-3 rounded-[1.5rem] text-[9px] font-black uppercase tracking-widest transition-all ${paymentForm.method === 'CASH' ? 'bg-white text-black shadow-lg' : 'text-gray-600'}`}>Cash</button>
                           <button type="button" onClick={() => setPaymentForm({ ...paymentForm, method: 'BANK_TRANSFER' })} className={`flex-1 py-3 rounded-[1.5rem] text-[9px] font-black uppercase tracking-widest transition-all ${paymentForm.method === 'BANK_TRANSFER' ? 'bg-white text-black shadow-lg' : 'text-gray-600'}`}>Bank</button>
                           <button type="button" onClick={() => setPaymentForm({ ...paymentForm, method: 'CHEQUE' })} className={`flex-1 py-3 rounded-[1.5rem] text-[9px] font-black uppercase tracking-widest transition-all ${paymentForm.method === 'CHEQUE' ? 'bg-white text-black shadow-lg' : 'text-gray-600'}`}>Cheque</button>
                        </div>
                     </div>

                     {paymentForm.method === 'CHEQUE' && (
                        <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                           <GlassInput label="Cheque #" value={paymentForm.chequeNumber} onChange={e => setPaymentForm({ ...paymentForm, chequeNumber: e.target.value })} placeholder="X001-XXXX" />
                           <GlassInput label="Post Date" type="date" value={paymentForm.chequeDate} onChange={e => setPaymentForm({ ...paymentForm, chequeDate: e.target.value })} />
                        </div>
                     )}

                     <GlassInput label="Disbursement Amount (LKR)" type="number" value={paymentForm.amount || ''} onChange={e => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })} required />

                     <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Note / Reference</label>
                        <textarea className="glass-input rounded-2xl px-6 py-4 text-xs font-black uppercase outline-none focus:border-blue-500 transition-all min-h-[80px]" value={paymentForm.note} onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })} placeholder="E.g. Corrected typo in payment..." />
                     </div>

                     <button type="submit" disabled={isSaving} className={`w-full py-6 rounded-[2.5rem] text-xs font-black uppercase tracking-[0.5em] shadow-2xl active:scale-95 transition-all ${editingPaymentId ? 'bg-blue-600 shadow-blue-600/30' : 'bg-emerald-600 shadow-emerald-600/30'} text-white`}>
                        {isSaving ? <Loader2 className="animate-spin mx-auto" /> : editingPaymentId ? 'COMMIT CORRECTION' : 'CONFIRM DISBURSEMENT'}
                     </button>
                  </form>
               </GlassCard>
            </div>
         )}

         {showAiModal && (
            <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-4">
               <div className="w-full max-w-2xl animate-in zoom-in-95 duration-300">
                  <AIAdvisor mode="SUPPLIER" contextData={getSupplierContext()} onClose={() => setShowAiModal(false)} />
               </div>
            </div>
         )}
      </div>
   );
};
