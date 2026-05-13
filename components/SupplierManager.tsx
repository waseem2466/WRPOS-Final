
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
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, Supplier, Product, BusinessSettings, MarginType, SupplierPayment, ProductRequest } from '../types';
import { GlassCard } from './ui/GlassCard';
import { GlassInput } from './ui/GlassInput';
import { cleanPhone } from '../services/utils';
import { AIAdvisor } from './AIAdvisor';
import { whatsappService } from '../services/whatsapp';

const formatLkr = (value: number) => `LKR ${Number(value || 0).toLocaleString()}`;
const blankPoItem = (): PurchaseOrderItem => ({
   name: '',
   quantity: 1,
   unitCost: 0,
   sellingPrice: 0,
   receivedQuantity: 0,
   shortageQuantity: 0,
   damagedQuantity: 0,
   discountPercentage: 0
});

export const SupplierManager: React.FC = () => {
   const [suppliers, setSuppliers] = useState<Supplier[]>([]);
   const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
   const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
   const [productRequests, setProductRequests] = useState<ProductRequest[]>([]);
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
   const [showDeliveryTracker, setShowDeliveryTracker] = useState(false);

   // Searchable Dropdown State
   const [poVendorSearch, setPoVendorSearch] = useState('');
   const [showPoVendorList, setShowPoVendorList] = useState(false);
   const [poRequestIds, setPoRequestIds] = useState<string[]>([]);
   const poVendorListRef = useRef<HTMLDivElement>(null);
   const poItemNameRefs = useRef<Array<HTMLInputElement | null>>([]);

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
      items: [blankPoItem()],
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
      const [s, po, sett, req] = await Promise.all([db.suppliers.getAll(), db.purchaseOrders.getAll(), db.settings.get(), db.productRequests.getOpen()]);
      setSuppliers(s);
      setPurchaseOrders(po);
      setSettings(sett);
      setProductRequests(req);
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
         .reduce((sum: number, p) => sum + Number(p.amount), 0);

      const totalPaid = totalPaidOnOrders + unlinkedPayments;
      const balance = Math.max(0, totalBilled - totalPaid);

      return { totalBilled, totalPaid, balance };
   };

   const getSupplierContext = () => {
      const totalPending = suppliers.reduce((sum: number, s) => sum + getSupplierStats(s.id).balance, 0);
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

         const updatedEntity = allSuppliers.find((s: Supplier) => String(s.id) === String(targetId));
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

   const openNewOrder = (supplier?: Supplier) => {
      setEditingPoId(null);
      setPoVendorSearch(supplier?.name || '');
      setPoForm({
         supplierId: supplier?.id || '',
         items: [blankPoItem()],
         paidAmount: 0,
         transportCost: 0,
         transportPaidExternal: false,
         paymentMethod: 'CASH'
      });
      setPoRequestIds([]);
      setIsManualPoModalOpen(true);
   };

   const addRequestToOrder = (request: ProductRequest) => {
      setPoForm(prev => {
         const cleanItems = prev.items.length === 1 && !prev.items[0].name ? [] : prev.items;
         return {
            ...prev,
            items: [
               ...cleanItems,
               {
                  ...blankPoItem(),
                  name: request.itemName,
                  quantity: request.quantity || 1
               }
            ]
         };
      });
      setPoRequestIds(prev => prev.includes(request.id) ? prev : [...prev, request.id]);
   };

   const focusPoItemName = (index: number) => {
      setTimeout(() => {
         const input = poItemNameRefs.current[index];
         input?.focus();
         input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 0);
   };

   const addPoItemRow = () => {
      const nextIndex = poForm.items.length;
      setPoForm(prev => ({ ...prev, items: [...prev.items, blankPoItem()] }));
      focusPoItemName(nextIndex);
   };

   const handlePoRetailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (idx === poForm.items.length - 1) {
         addPoItemRow();
      } else {
         focusPoItemName(idx + 1);
      }
   };

   const handleCreatePO = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      try {
         const typedSupplier = suppliers.find(s => s.name.trim().toLowerCase() === poVendorSearch.trim().toLowerCase());
         const supplierId = poForm.supplierId || typedSupplier?.id || '';
         const supplier = suppliers.find(s => String(s.id) === String(supplierId));
         const draftTotal = poForm.items.reduce((sum, i) => sum + ((i.unitCost || 0) * i.quantity), 0);

         if (!supplierId || !supplier) {
            alert("Please select a vendor from the Vendor Selection list before saving the order.");
            return;
         }

         if (poForm.items.length === 0 || poForm.items.some(i => !i.name || i.quantity <= 0)) {
            alert("Please add at least one item with a valid name and quantity.");
            return;
         }

         if (!confirm(`Generate Procurement Order for ${supplier?.name || 'Unknown'}?`)) return;

         setIsSaving(true);
         try {
            let savedOrderId = editingPoId || '';
            if (editingPoId) {
               await db.purchaseOrders.update({
                  id: editingPoId,
                  supplierId,
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
               savedOrderId = await db.purchaseOrders.add({
                  supplierId,
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

            if (poRequestIds.length > 0) {
               await db.productRequests.markOrdered(poRequestIds, savedOrderId);
            }

            setIsManualPoModalOpen(false);
            setEditingPoId(null);
            setPoRequestIds([]);
            setPoForm({ supplierId: '', items: [blankPoItem()], paidAmount: 0, transportCost: 0, transportPaidExternal: false, paymentMethod: 'CASH' });
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
      setPoRequestIds([]);
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
      const itemsTotal = po.items.reduce((sum: number, i) => {
         const discountedUnit = (i.unitCost || 0) * (1 - (i.discountPercentage || 0) / 100);
         return sum + ((i.receivedQuantity || 0) * discountedUnit);
      }, 0);
      return Math.max(0, itemsTotal - (po.discountAmount || 0));
   };

   const getReceiptVarianceSummary = (po: PurchaseOrder) => {
      return po.items
         .map(item => {
            const ordered = Number(item.quantity || 0);
            const received = Number(item.receivedQuantity || 0);
            const damaged = Math.max(0, Number(item.damagedQuantity || 0));
            const enteredShortage = Math.max(0, Number(item.shortageQuantity || 0));
            const impliedShortage = Math.max(0, ordered - received - damaged);
            const shortage = Math.max(enteredShortage, impliedShortage);
            const hasIssue = shortage > 0 || damaged > 0 || received < ordered;

            return hasIssue ? {
               name: item.name,
               ordered,
               received,
               shortage,
               damaged
            } : null;
         })
         .filter(Boolean) as Array<{
            name: string;
            ordered: number;
            received: number;
            shortage: number;
            damaged: number;
         }>;
   };

   const sendSupplierReceiptConfirmation = async (po: PurchaseOrder) => {
      const supplier = suppliers.find(s => s.id === po.supplierId);
      if (!supplier || !settings) {
         return { success: false, skipped: true, reason: 'Supplier or business settings not available.' };
      }

      const supplierPhone = supplier.hotline || supplier.workerMobile || supplier.phone;
      if (!cleanPhone(supplierPhone || '')) {
         return { success: false, skipped: true, reason: 'Supplier does not have a valid WhatsApp number.' };
      }

      const variances = getReceiptVarianceSummary(po);
      if (variances.length === 0) {
         return { success: true, skipped: true, reason: 'No shortages or damaged items detected.' };
      }

      const lines = variances.map(item => {
         const notes: string[] = [
            `Ordered ${item.ordered}`,
            `Received ${item.received}`
         ];

         if (item.shortage > 0) notes.push(`Short ${item.shortage}`);
         if (item.damaged > 0) notes.push(`Damaged ${item.damaged}`);

         return `- ${item.name}: ${notes.join(' | ')}`;
      }).join('\n');

      const message =
         `*GOODS RECEIVED CONFIRMATION: #${po.id.slice(-6)}*\n` +
         `*${settings.businessName}*\n\n` +
         `Supplier: ${po.supplierName}\n` +
         `Date: ${new Date().toLocaleDateString()}\n\n` +
         `We completed stock checking for this delivery and found the following differences:\n\n` +
         `${lines}\n\n` +
         `_Please confirm replacement, short supply adjustment, or next action._`;

      const result = await whatsappService.sendDirect(settings, supplierPhone, message);
      if (!result.success) {
         return { success: false, skipped: false, reason: result.error || 'WhatsApp send failed.' };
      }

      return { success: true, skipped: false };
   };

   const handleFinalizeReceipt = async () => {
      if (!activePoToReceive) return;

      if (!confirm("Finalize inventory audit and sync to global stock? This action cannot be undone.")) return;

      setIsSaving(true);
      try {
         const products = await db.products.getAll();
         const updatedTotalCost = calculateAuditedTotal(activePoToReceive);
         const variances = getReceiptVarianceSummary(activePoToReceive);
         const hasVariance = variances.length > 0;

         for (const item of activePoToReceive.items) {
            const received = item.receivedQuantity || 0;
            const actualCostBeforeDisc = item.unitCost || 0;
            const discountedCost = actualCostBeforeDisc * (1 - (item.discountPercentage || 0) / 100);

            if (received <= 0) continue;

            let product = products.find((p: Product) =>
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
            status: (hasVariance ? 'PARTIALLY_RECEIVED' : 'RECEIVED') as PurchaseOrderStatus
         };

         await db.purchaseOrders.update(updatedPo);

         const whatsappResult = await sendSupplierReceiptConfirmation(updatedPo);

         setIsReceiptModalOpen(false);
         setActivePoToReceive(null);
         await loadData();

         if (hasVariance) {
            if (whatsappResult.success && !whatsappResult.skipped) {
               alert("Inventory synced. Shortage or damage confirmation was also sent to the supplier on WhatsApp.");
            } else {
               alert(`Inventory synced, but supplier WhatsApp confirmation was not sent: ${whatsappResult.reason || 'Unknown issue.'}`);
            }
         } else {
            alert("Inventory synced successfully. Received supplier items are now listed in Inventory.");
         }
      } finally {
         setIsSaving(false);
      }
   };

   const sendWhatsAppPO = async (po: PurchaseOrder) => {
      const supplier = suppliers.find(s => s.id === po.supplierId);
      if (!supplier || !settings) return;
      const supplierPhone = supplier.hotline || supplier.workerMobile || supplier.phone;
      if (!cleanPhone(supplierPhone || '')) {
         alert('This supplier does not have a valid WhatsApp phone number.');
         return;
      }

      const itemsText = po.items.map(i => `- ${i.name} (Qty: ${i.quantity})`).join('\n');
      const message = `*PURCHASE ORDER: #${po.id.slice(-6)}*\n` +
         `*${settings.businessName}*\n\n` +
         `Vendor: ${po.supplierName}\n` +
         `Date: ${new Date(po.date).toLocaleDateString()}\n\n` +
         `*ORDER MANIFEST:*\n${itemsText}\n\n` +
         `Status: ${po.status}\n\n` +
         `_Please confirm dispatch and expected delivery._`;

      const result = await whatsappService.sendDirect(settings, supplierPhone, message);
      if (!result.success) {
         alert(`WhatsApp send failed: ${result.error || 'Please link QR WhatsApp first.'}`);
      } else {
         alert('Purchase order sent to supplier WhatsApp.');
      }
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

   const supplierOverview = useMemo(() => {
      const totalDue = suppliers.reduce((sum, supplier) => sum + getSupplierStats(supplier.id).balance, 0);
      const pendingOrders = purchaseOrders.filter(po => po.status !== 'RECEIVED' && po.status !== 'CANCELLED').length;
      const receivedOrders = purchaseOrders.filter(po => po.status === 'RECEIVED').length;
      return { totalDue, pendingOrders, receivedOrders };
   }, [suppliers, purchaseOrders, supplierPayments]);

   const supplierLedger = useMemo(() => {
      if (!selectedSupplier) return [];
      return [
         ...supplierPayments.map(p => ({ ...p, type: 'PAYMENT' })),
         ...purchaseOrders.filter(po => String(po.supplierId) === String(selectedSupplier.id)).map(po => ({ ...po, type: 'ORDER' }))
      ].sort((a: any, b: any) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime());
   }, [supplierPayments, purchaseOrders, selectedSupplier]);

   return (
      <div className="h-full flex flex-col overflow-y-auto custom-scrollbar relative text-slate-200 pr-1">
         {/* --- MAIN UI --- */}
         {selectedSupplier ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar animate-in fade-in duration-300">
               <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 shrink-0">
                  <button onClick={() => setSelectedSupplier(null)} className="flex items-center gap-2 text-slate-400 hover:text-white transition-all group">
                     <div className="p-2 rounded-lg bg-white/5 border border-white/10 group-hover:bg-blue-600/10 transition-all">
                        <ArrowLeft size={16} />
                     </div>
                     <span className="font-black uppercase text-[10px] tracking-[0.22em]">Supplier Directory</span>
                  </button>
                  <div className="flex flex-wrap gap-2">
                     <button onClick={() => openNewOrder(selectedSupplier)} className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.16em] shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-all flex items-center gap-2"><Plus size={14} /> New Order</button>
                     <button onClick={() => { setSupplierForm({ ...selectedSupplier }); setIsEditingSupplier(true); setIsSupplierModalOpen(true); }} className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-[0.16em] text-slate-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 shadow-sm"><Edit size={14} /> Edit Profile</button>
                     <button onClick={() => { setEditingPaymentId(null); setIsPaymentModalOpen(true); }} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.16em] shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-all">Settle Account</button>
                  </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden custom-scrollbar pb-4">
                  <div className="lg:col-span-4 flex flex-col min-h-0">
                     <GlassCard className="bg-[#0b1121]/90 p-6 rounded-[2.2rem] flex-1 flex flex-col border-white/5 shadow-2xl overflow-hidden">
                        <div className="text-center mb-6 shrink-0">
                           <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] mx-auto mb-4 flex items-center justify-center text-3xl font-black text-white shadow-3xl shadow-blue-600/30 transform hover:scale-105 transition-all">{selectedSupplier.name.charAt(0)}</div>
                           <h2 className="text-lg font-black text-white uppercase tracking-tight leading-none mb-2 truncate">{selectedSupplier.name}</h2>
                           <div className="flex items-center justify-center gap-2">
                              <span className="text-[9px] text-blue-500 font-black uppercase tracking-widest px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/10">{selectedSupplier.category}</span>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-6 shrink-0">
                           <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                              <p className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Orders</p>
                              <p className="text-base font-black text-white">{purchaseOrders.filter(po => String(po.supplierId) === String(selectedSupplier.id)).length}</p>
                           </div>
                           <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
                              <p className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Paid</p>
                              <p className="text-base font-black text-emerald-400">{formatLkr(getSupplierStats(selectedSupplier.id).totalPaid).replace('LKR ', '')}</p>
                           </div>
                        </div>

                        <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-0">
                           <div className="p-6 bg-gradient-to-br from-red-600/10 to-transparent rounded-[2rem] border border-red-500/10 shrink-0">
                              <div className="flex justify-between items-center mb-1">
                                 <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Unsettled Balance</span>
                                 <AlertTriangle size={14} className="text-red-500/50" />
                              </div>
                              <span className="text-2xl font-black font-mono text-red-400">{formatLkr(getSupplierStats(selectedSupplier.id).balance)}</span>
                           </div>

                           <div className="grid grid-cols-1 gap-2.5">
                              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between group">
                                 <div className="min-w-0">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Primary Contact</p>
                                    <p className="text-[13px] text-slate-200 font-bold truncate">{selectedSupplier.hotline || selectedSupplier.phone || 'N/A'}</p>
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
                           {supplierLedger.length === 0 && (
                              <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center rounded-[2rem] border border-dashed border-white/10 bg-white/[0.03] p-8">
                                 <History size={34} className="text-blue-300/40 mb-4" />
                                 <p className="text-sm font-black text-white uppercase tracking-[0.22em]">No supplier activity yet</p>
                                 <p className="text-xs text-slate-500 mt-2 max-w-sm">Create a purchase order or record a settlement to start the ledger.</p>
                              </div>
                           )}
                           {supplierLedger.map((item: any) => (
                              <div key={item.id} className="p-5 rounded-[2rem] bg-black/40 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-blue-500/20 transition-all shadow-sm">
                                 <div className="flex items-center gap-5 min-w-0">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner shrink-0 ${item.type === 'PAYMENT' ? (item.chequeStatus === 'BOUNCED' ? 'bg-red-500/10 text-red-400 border-red-500/10' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10') :
                                       'bg-blue-500/10 text-blue-400 border-blue-500/10'
                                       }`}>
                                       {item.type === 'PAYMENT' ? (item.paymentMethod === 'CHEQUE' ? <CreditCard size={21} /> : <Banknote size={21} />) : <ShoppingBag size={21} />}
                                    </div>
                                    <div className="min-w-0">
                                       <p className="text-[13px] font-black text-white uppercase tracking-tight truncate">
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
                                 <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 text-right shrink-0">
                                    <div>
                                       <p className={`text-base sm:text-lg font-black font-mono tracking-tighter ${item.type === 'PAYMENT' ? (item.chequeStatus === 'BOUNCED' ? 'text-gray-700 line-through' : 'text-emerald-400') : 'text-red-400'}`}>
                                          {item.type === 'PAYMENT' ? '-' : '+'} {formatLkr(item.amount || item.totalCost)}
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
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar space-y-5 animate-in fade-in duration-500 pr-1">
               <div className="grid grid-cols-1 md:grid-cols-4 gap-3 shrink-0 px-1">
                  <GlassCard className="p-4 rounded-[1.6rem] border-white/5 bg-white/[0.04]">
                     <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500 mb-1">Vendors</p>
                     <p className="text-2xl font-black text-white font-mono">{suppliers.length}</p>
                  </GlassCard>
                  <GlassCard className="p-4 rounded-[1.6rem] border-white/5 bg-emerald-500/[0.04]">
                     <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500 mb-1">Received</p>
                     <p className="text-2xl font-black text-emerald-300 font-mono">{supplierOverview.receivedOrders}</p>
                  </GlassCard>
                  <GlassCard className="p-4 rounded-[1.6rem] border-white/5 bg-orange-500/[0.04]">
                     <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500 mb-1">Pending Orders</p>
                     <p className="text-2xl font-black text-orange-300 font-mono">{supplierOverview.pendingOrders}</p>
                  </GlassCard>
                  <GlassCard className="p-4 rounded-[1.6rem] border-red-500/10 bg-red-500/[0.04]">
                     <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500 mb-1">Total Due</p>
                     <p className="text-xl font-black text-red-300 font-mono">{formatLkr(supplierOverview.totalDue)}</p>
                  </GlassCard>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-12 gap-4 shrink-0 px-1">
                  <div className="md:col-span-8">
                     <GlassCard className="p-4 border-white/5 bg-white/5 rounded-[1.6rem]">
                        <div className="flex flex-col sm:flex-row gap-3">
                           <div className="flex-1 relative">
                              <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200/45" />
                              <input placeholder="Search suppliers by name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-[1.25rem] py-3.5 pl-12 pr-4 text-[12px] font-bold text-white outline-none focus:border-blue-500 transition-all placeholder-slate-600" />
                           </div>
                           <button onClick={() => { setSupplierForm({ name: '', phone: '', hotline: '', workerMobile: '', category: 'General', bankName: '', accountNumber: '', branch: '', email: '', address: '', contactPerson: '' }); setIsEditingSupplier(false); setIsSupplierModalOpen(true); }} className="px-5 py-3 bg-blue-600 text-white rounded-[1.25rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                              <UserPlus size={15} /> New Supplier
                           </button>
                        </div>
                     </GlassCard>
                  </div>
                  <div className="md:col-span-4 flex gap-2">
                     <button onClick={() => openNewOrder()} className="flex-1 min-h-[3.25rem] bg-emerald-600 text-white rounded-[1.35rem] text-[10px] font-black uppercase tracking-[0.22em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                        <Plus size={18} /> New Order
                     </button>
                     <button onClick={() => setShowAiModal(true)} className="p-4 bg-purple-600/10 text-purple-500 border border-purple-500/20 rounded-2xl hover:bg-purple-600 hover:text-white transition-all shadow-lg">
                        <BrainCircuit size={20} />
                     </button>
                  </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 overflow-y-auto px-1 pb-4 custom-scrollbar">
                  <div className="lg:col-span-4 flex flex-col h-[500px] lg:h-auto lg:min-h-0">
                     <GlassCard className="border-white/5 bg-[#0b1121]/40 flex-1 flex flex-col overflow-hidden p-6 rounded-[2rem]">
                        <h3 className="text-[10px] font-black text-white uppercase tracking-[0.36em] mb-6 shrink-0 flex items-center gap-3">
                           <ListPlus size={14} className="text-blue-500" /> Directory Hub
                        </h3>
                        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar min-h-0 will-change-transform scroll-smooth">
                           {filteredSuppliers.length === 0 && (
                              <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.03] p-6">
                                 <Truck size={34} className="text-blue-300/40 mb-4" />
                                 <p className="text-sm font-black text-white uppercase tracking-[0.2em]">No suppliers found</p>
                                 <p className="text-xs text-slate-500 mt-2">Add your first supplier or clear the search field.</p>
                              </div>
                           )}
                           {filteredSuppliers.map(s => {
                              const stats = getSupplierStats(s.id);
                              return (
                                 <div key={s.id} onClick={() => handleSelectSupplier(s)} className="p-4 rounded-[1.4rem] border border-white/5 bg-white/[0.04] hover:bg-blue-500/[0.07] hover:border-blue-500/30 transition-all flex flex-col gap-3 group cursor-pointer shadow-sm">
                                    <div className="flex justify-between items-center">
                                       <div className="min-w-0 flex-1">
                                          <p className="text-[13px] font-black text-white uppercase truncate tracking-tight">{s.name}</p>
                                          <div className="flex items-center gap-2 mt-1">
                                             <PhoneCall size={10} className="text-blue-500 opacity-50" />
                                             <p className="text-[9px] text-slate-500 font-bold uppercase">{s.phone || 'NO CONTACT'}</p>
                                          </div>
                                       </div>
                                       <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-black text-gray-500 border border-white/5 shadow-inner">
                                          {s.name.charAt(0)}
                                       </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-2">
                                       <div>
                                          <p className="text-[8px] text-slate-500 uppercase font-bold tracking-widest mb-0.5">Billed</p>
                                          <p className="text-[10px] text-slate-300 font-mono">{formatLkr(stats.totalBilled)}</p>
                                       </div>
                                       <div>
                                          <p className="text-[8px] text-slate-500 uppercase font-bold tracking-widest mb-0.5">Paid</p>
                                          <p className="text-[10px] text-emerald-500 font-mono">{formatLkr(stats.totalPaid)}</p>
                                       </div>
                                       <div>
                                          <p className="text-[8px] text-slate-500 uppercase font-bold tracking-widest mb-0.5">Due</p>
                                          <p className={`text-[10px] font-mono font-black ${stats.balance > 0 ? 'text-red-400' : 'text-slate-600'}`}>{formatLkr(stats.balance)}</p>
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
                           {purchaseOrders.length === 0 && (
                              <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.03] p-8">
                                 <ShoppingCart size={34} className="text-emerald-300/40 mb-4" />
                                 <p className="text-sm font-black text-white uppercase tracking-[0.2em]">No purchase orders yet</p>
                                 <p className="text-xs text-slate-500 mt-2 max-w-sm">Create a new order to track supplier purchases, received stock, payments, and balances.</p>
                              </div>
                           )}
                           {purchaseOrders.map(po => (
                              <div key={po.id} className="p-5 rounded-[1.8rem] border border-white/5 bg-black/40 group hover:border-emerald-500/20 transition-all shadow-md">
                                 <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                                    <div className="flex items-center gap-4 min-w-0">
                                       <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 group-hover:border-blue-500/20 shrink-0">
                                          <ShoppingCart size={18} className="text-blue-500 opacity-50" />
                                       </div>
                                       <div className="min-w-0">
                                          <p className="text-[12px] font-black text-white uppercase truncate">Order #{po.id.slice(-6)} - {po.supplierName}</p>
                                          <div className="flex items-center gap-2 mt-0.5">
                                             <span className={`text-[8px] px-2 py-1 rounded-full font-black uppercase tracking-widest shrink-0 ${po.status === 'RECEIVED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'}`}>{po.status}</span>
                                             <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest shrink-0">{new Date(po.date).toLocaleDateString()}</span>
                                          </div>
                                       </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                       {po.status !== 'RECEIVED' && (po.totalCost > po.paidAmount) && (
                                          <button onClick={() => openSettlePoModal(po)} className="px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg flex items-center gap-2">
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
                                          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Order Manifest ({po.items.length} lines)</span>
                                       </div>
                                       <button onClick={() => setExpandedPoId(expandedPoId === po.id ? null : po.id)} className="text-[8px] font-black text-blue-400 uppercase tracking-widest border border-blue-500/20 px-2 py-1 hover:bg-blue-600/10 transition-all rounded-lg">
                                          {expandedPoId === po.id ? 'Collapse' : 'Show Items'}
                                       </button>
                                    </div>
                                    {expandedPoId === po.id && (
                                       <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-1 animate-in fade-in slide-in-from-top-1 will-change-contents">
                                          {po.items.map((item, i) => (
                                             <div key={i} className="flex justify-between items-center text-[11px] py-2 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors rounded-lg px-2">
                                                <div className="flex flex-col min-w-0">
                                                   <span className="text-gray-400 font-bold uppercase truncate pr-4">{item.name}</span>
                                                   {item.unitCost > 0 && <span className="text-[8px] text-gray-600 font-black uppercase">Cost: {formatLkr(item.unitCost || 0)}</span>}
                                                </div>
                                                <div className="text-right shrink-0">
                                                   <span className="text-white font-mono">{item.quantity} units</span>
                                                   {item.unitCost > 0 && <p className="text-[9px] text-blue-400 font-mono">{formatLkr((item.unitCost || 0) * item.quantity)}</p>}
                                                </div>
                                             </div>
                                          ))}
                                       </div>
                                    )}
                                 </div>

                                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
                                       <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Items</p>
                                       <p className="text-[12px] font-black text-white">{po.items.length}</p>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
                                       <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Paid So Far</p>
                                       <p className="text-[12px] font-black text-emerald-400 font-mono">{formatLkr(po.paidAmount || 0)}</p>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
                                       <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Remaining</p>
                                       <p className={`text-[12px] font-black font-mono ${po.totalCost - po.paidAmount > 0 ? 'text-red-400' : 'text-gray-600'}`}>{formatLkr(po.totalCost - po.paidAmount)}</p>
                                    </div>
                                    <div className="bg-blue-600/10 p-3 rounded-xl border border-blue-600/20 text-center">
                                       <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Grand Total</p>
                                       <p className="text-[12px] font-black text-white font-mono">{formatLkr(po.totalCost)}</p>
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
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-3 sm:p-4">
               <GlassCard className="w-full max-w-2xl bg-[#0b1121] p-5 sm:p-8 rounded-[2rem] border-2 border-white/10 shadow-3xl animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[92vh]">
                  <div className="flex justify-between items-center gap-3 mb-6 shrink-0">
                     <h3 className="text-base font-black text-white uppercase tracking-widest flex items-center gap-3">
                        <UserPlus size={20} className="text-blue-500" /> {isEditingSupplier ? 'Modify Vendor' : 'New Vendor'}
                     </h3>
                     <button onClick={() => setIsSupplierModalOpen(false)} className="p-3 text-gray-500 hover:text-white bg-white/5 rounded-full"><X size={18} /></button>
                  </div>
                  <form onSubmit={handleSaveSupplier} className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <GlassInput label="Bank Name" value={supplierForm.bankName} onChange={e => setSupplierForm({ ...supplierForm, bankName: e.target.value })} />
                           <GlassInput label="Branch" value={supplierForm.branch} onChange={e => setSupplierForm({ ...supplierForm, branch: e.target.value })} />
                           <GlassInput label="Account Number" value={supplierForm.accountNumber} onChange={e => setSupplierForm({ ...supplierForm, accountNumber: e.target.value })} className="col-span-2" />
                        </div>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr] gap-3 mt-4">
                        <button type="button" onClick={() => setIsSupplierModalOpen(false)} className="py-5 bg-white/5 border border-white/10 text-slate-300 rounded-[1.6rem] text-xs font-black uppercase tracking-[0.22em] shadow-xl hover:bg-white/10 transition-all">
                           Cancel
                        </button>
                        <button type="submit" disabled={isSaving} className="py-5 bg-blue-600 text-white rounded-[1.6rem] text-xs font-black uppercase tracking-[0.22em] shadow-xl hover:bg-blue-500 transition-all">
                           {isSaving ? <Loader2 className="animate-spin mx-auto" /> : 'SAVE PROFILE'}
                        </button>
                     </div>
                  </form>
               </GlassCard>
            </div>
         )}

         {isManualPoModalOpen && (
            <div className="fixed top-0 right-0 bottom-0 left-0 lg:left-[104px] z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-1 sm:p-3">
               <GlassCard className="w-full max-w-[calc(100vw-1rem)] lg:max-w-[calc(100vw-8rem)] bg-[#0b1121] p-4 sm:p-4 rounded-[1.5rem] border-2 border-white/10 shadow-3xl animate-in zoom-in-95 flex flex-col h-[96vh] overflow-hidden relative">
                  <div className="flex justify-between items-center mb-3 shrink-0">
                      <div>
                         <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                            <FileText size={22} className="text-emerald-500" /> Procurement Order
                         </h3>
                         <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.16em] mt-1">Add all supplier items here before confirming.</p>
                      </div>
                      <button type="button" onClick={() => setIsManualPoModalOpen(false)} className="p-3 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-2xl transition-all"><X size={20} /></button>
                   </div>

                  <form onSubmit={handleCreatePO} className="flex-1 flex flex-col overflow-y-auto custom-scrollbar pr-1">
                     <div className="grid grid-cols-1 md:grid-cols-[minmax(18rem,36rem)_1fr] gap-3 mb-3 shrink-0 relative z-[1050]">
                         <div className="relative" ref={poVendorListRef}>
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 mb-2 block">Vendor Selection</label>
                            <input
                               className="w-full glass-input rounded-[1rem] px-4 py-3 text-[12px] font-black uppercase outline-none focus:border-blue-500 transition-all"
                               placeholder="Search Vendor..."
                               value={poVendorSearch}
                               onChange={e => { setPoVendorSearch(e.target.value); setShowPoVendorList(true); }}
                              onFocus={() => setShowPoVendorList(true)}
                           />
                           {showPoVendorList && (
                              <div className="absolute top-full left-0 right-0 mt-2 bg-[#0f172a] border border-white/10 rounded-2xl shadow-3xl max-h-36 overflow-y-auto custom-scrollbar z-50">
                                 {suppliers.filter(s => s.name.toLowerCase().includes(poVendorSearch.toLowerCase())).map(s => (
                                    <div key={s.id} onClick={() => { setPoForm({ ...poForm, supplierId: s.id }); setPoVendorSearch(s.name); setShowPoVendorList(false); }} className="px-4 py-3 hover:bg-blue-600/20 cursor-pointer border-b border-white/5 last:border-0">
                                       <p className="text-[11px] font-black text-white uppercase truncate">{s.name}</p>
                                    </div>
                                 ))}
                              </div>
                           )}
                         </div>
                         <div>
                            <GlassInput label="Advance Payment" type="number" value={poForm.paidAmount || ''} onChange={e => setPoForm({ ...poForm, paidAmount: Number(e.target.value) })} className="py-3 text-[13px]" />
                         </div>
                      </div>

                      {productRequests.length > 0 && (
                         <div className="mb-3 shrink-0 bg-orange-500/5 border border-orange-500/10 rounded-[1.25rem] p-3 relative z-0">
                            <div className="flex items-center justify-between gap-3 mb-2">
                               <div>
                                  <p className="text-[9px] font-black text-orange-300 uppercase tracking-[0.28em]">Customer Requests</p>
                                  <p className="text-[9px] text-slate-500 font-bold mt-0.5">Tap to add not-available items.</p>
                               </div>
                               <span className="text-[10px] font-black text-orange-200 bg-orange-500/10 border border-orange-400/10 px-3 py-1 rounded-full">
                                  {productRequests.length} open
                              </span>
                           </div>
                           <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                              {productRequests.slice(0, 12).map(req => (
                                 <button
                                    key={req.id}
                                    type="button"
                                    onClick={() => addRequestToOrder(req)}
                                     disabled={poRequestIds.includes(req.id)}
                                     className={`min-w-[11rem] text-left p-2.5 rounded-xl border transition-all ${poRequestIds.includes(req.id)
                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                                        : 'bg-black/30 border-white/10 text-white hover:border-orange-400/40 hover:bg-orange-500/10'}`}
                                  >
                                    <p className="text-[11px] font-black uppercase truncate">{req.itemName}</p>
                                    <p className="text-[9px] text-slate-500 font-bold mt-1 truncate">Qty {req.quantity || 1} - {req.customerName || 'Customer'}</p>
                                 </button>
                              ))}
                           </div>
                          </div>
                      )}

                      <div className="flex-1 min-h-[42vh] overflow-y-auto custom-scrollbar mb-3 pr-1 sm:pr-2 bg-white/5 rounded-[1.1rem] p-2.5 border border-white/5 relative z-0">
                         <div className="sticky top-0 z-10 bg-[#151b28]/95 backdrop-blur-xl border border-white/5 rounded-[1rem] p-2.5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-3">
                            <div>
                               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Order Items</span>
                               <p className="text-[9px] text-emerald-400/80 font-bold uppercase tracking-[0.14em] mt-1">Main working area. Type item name, qty, cost, and selling price.</p>
                            </div>
                             <button type="button" onClick={addPoItemRow} className="px-4 py-2.5 bg-blue-600 text-white rounded-[1rem] text-[9px] font-black uppercase tracking-[0.16em] hover:bg-blue-500 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"><PlusIcon size={13} /> Add Item Row</button>
                          </div>
                          {poForm.items.map((item, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2.5 mb-2.5 items-end p-2.5 bg-black/35 border border-white/5 rounded-[1rem]">
                               <div className="col-span-12 lg:col-span-6">
                                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Item {idx + 1}</label>
                                  <input ref={el => { poItemNameRefs.current[idx] = el; }} className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-[13px] leading-none text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30" placeholder="Type item name" value={item.name} onChange={e => { const n = [...poForm.items]; n[idx].name = e.target.value; setPoForm({ ...poForm, items: n }); }} />
                               </div>
                               <div className="col-span-4 lg:col-span-1">
                                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Qty</label>
                                  <input type="number" className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-3 text-[13px] leading-none text-white outline-none text-center focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30" placeholder="Qty" value={item.quantity} onChange={e => { const n = [...poForm.items]; n[idx].quantity = Number(e.target.value); setPoForm({ ...poForm, items: n }); }} />
                               </div>
                               <div className="col-span-4 lg:col-span-2">
                                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Cost</label>
                                  <input type="number" className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-3 text-[13px] leading-none text-white outline-none text-right focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30" placeholder="Cost" value={item.unitCost || ''} onChange={e => { const n = [...poForm.items]; n[idx].unitCost = Number(e.target.value); setPoForm({ ...poForm, items: n }); }} />
                               </div>
                               <div className="col-span-4 lg:col-span-2">
                                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Retail</label>
                                  <input type="number" className="w-full bg-black/60 border border-emerald-500/20 rounded-xl px-3 py-3 text-[13px] leading-none text-emerald-300 outline-none text-right focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30" placeholder="Price" value={item.sellingPrice || ''} onChange={e => { const n = [...poForm.items]; n[idx].sellingPrice = Number(e.target.value); setPoForm({ ...poForm, items: n }); }} onKeyDown={e => handlePoRetailKeyDown(e, idx)} title="Press Enter to add the next item row" />
                               </div>
                               <div className="col-span-12 lg:col-span-1 flex items-end justify-center">
                                  <button type="button" onClick={() => { const n = [...poForm.items]; n.splice(idx, 1); setPoForm({ ...poForm, items: n.length ? n : [blankPoItem()] }); }} className="w-full lg:w-auto p-3 text-red-400/70 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-all"><Trash2 size={15} /></button>
                               </div>
                            </div>
                          ))}
                        <button type="button" onClick={addPoItemRow} className="w-full py-2.5 rounded-[1rem] border border-dashed border-blue-400/30 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20 hover:border-blue-300/50 transition-all text-[9px] font-black uppercase tracking-[0.18em] flex items-center justify-center gap-2">
                           <PlusIcon size={13} /> Add Next Item Row
                        </button>
                     </div>

                      <div className="grid grid-cols-1 md:grid-cols-[13rem_1fr] gap-2 shrink-0 bg-black/30 p-1.5 rounded-[0.9rem] border border-white/5 relative z-0">
                         <div>
                            <GlassInput label="Transport Cost" type="number" value={poForm.transportCost || ''} onChange={e => setPoForm({ ...poForm, transportCost: Number(e.target.value) })} className="py-2 text-[11px]" />
                            <div className="mt-1 flex items-center gap-1.5">
                               <input type="checkbox" checked={poForm.transportPaidExternal} onChange={e => setPoForm({ ...poForm, transportPaidExternal: e.target.checked })} className="rounded border-white/20 bg-black/40" />
                               <span className="text-[7px] font-bold text-gray-500 uppercase tracking-wide">Paid External?</span>
                            </div>
                         </div>
                         <div className="flex flex-col justify-center items-end pr-1">
                            <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.14em] mb-0.5">Estimated Total</p>
                            <p className="text-[20px] font-black text-emerald-400 font-mono tracking-tighter leading-none">
                               LKR {(poForm.items.reduce((sum, i) => sum + ((i.unitCost || 0) * i.quantity), 0) + (poForm.transportPaidExternal ? 0 : (poForm.transportCost || 0))).toLocaleString()}
                            </p>
                         </div>
                      </div>

                      <div className="shrink-0 mt-3 grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-3">
                         <button type="button" onClick={() => setIsManualPoModalOpen(false)} className="py-3 bg-white/5 border border-white/10 text-slate-300 rounded-[1.1rem] text-[10px] font-black uppercase tracking-[0.18em] hover:bg-white/10 hover:text-white transition-all active:scale-95">
                           Cancel
                         </button>
                         <button type="submit" disabled={isSaving} className="py-3 bg-emerald-600 text-white rounded-[1.1rem] text-[10px] font-black uppercase tracking-[0.22em] shadow-xl hover:bg-emerald-500 transition-all active:scale-95 disabled:opacity-60">
                           {isSaving ? <Loader2 className="animate-spin mx-auto" /> : 'Confirm Order'}
                         </button>
                      </div>
                  </form>
               </GlassCard>
            </div>
         )}

         {isReceiptModalOpen && activePoToReceive && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-2 sm:p-4">
               <GlassCard className="w-full max-w-6xl bg-[#0b1121] p-4 sm:p-6 rounded-[2rem] border-2 border-white/10 shadow-3xl overflow-hidden flex flex-col h-[94vh]">
                  <div className="flex justify-between items-center gap-4 mb-5 shrink-0">
                     <div className="flex items-center gap-5">
                        <div className="hidden sm:flex w-16 h-16 bg-blue-600/10 text-blue-500 rounded-2xl items-center justify-center border border-blue-500/20">
                           <PackageCheck size={32} />
                        </div>
                        <div className="min-w-0">
                           <h3 className="text-lg sm:text-2xl font-black text-white uppercase tracking-tighter leading-tight">Inventory Audit & Verification</h3>
                           <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.4em]">Apply Item Discounts & Sync to Main Stock Hub</p>
                        </div>
                     </div>
                     <button onClick={() => { setIsReceiptModalOpen(false); setActivePoToReceive(null); }} className="p-3 sm:p-4 bg-white/5 text-gray-500 hover:text-white rounded-2xl shrink-0"><X size={24} /></button>
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
                           <div key={idx} className="grid grid-cols-12 gap-3 p-4 bg-white/5 rounded-[1.6rem] border border-white/5 items-center group hover:bg-white/10 transition-all">
                              <div className="col-span-3">
                                 <p className="text-[13px] font-black text-white uppercase truncate">{item.name}</p>
                                 <p className="text-[8px] text-gray-700 font-bold uppercase tracking-widest">Ordered: {item.quantity}</p>
                              </div>
                              <div className="col-span-2">
                                 <input
                                    type="number"
                                    className="w-full bg-black/60 border border-emerald-500/20 rounded-xl py-2.5 px-3 text-[11px] font-black text-emerald-400 outline-none text-center"
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
                                    className="w-full bg-black/60 border border-blue-500/20 rounded-xl py-2.5 px-3 text-[11px] font-black text-blue-400 outline-none text-center"
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
                                        className="w-full bg-black/60 border border-orange-500/20 rounded-xl py-2.5 px-3 text-[11px] font-black text-orange-400 outline-none text-center"
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
                                 <p className="text-[13px] font-black text-blue-300 font-mono">LKR {(discountedNet * (item.receivedQuantity || 0)).toLocaleString()}</p>
                                 <p className="text-[7px] text-gray-700 font-black uppercase tracking-tighter">@{discountedNet.toLocaleString()}/u</p>
                              </div>
                              <div className="col-span-2 text-right">
                                 <input
                                    type="number"
                                    className="w-full bg-black/60 border border-emerald-500/20 rounded-xl py-2.5 px-3 text-[11px] font-black text-emerald-400 outline-none text-right"
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

                  <div className="p-3 sm:p-4 bg-blue-600/5 border border-blue-500/10 rounded-[1.4rem] flex flex-col lg:flex-row justify-between items-center gap-4 shrink-0">
                     <div className="flex gap-8 items-center w-full lg:w-auto">
                        <div>
                           <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Adjust Final Bill</p>
                           <div className="relative">
                               <input
                                  type="number"
                                  className="bg-black/40 border border-white/10 rounded-[1rem] py-2.5 px-9 text-[11px] font-black text-red-400 outline-none focus:border-red-500 transition-all"
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
                           <p className="text-[28px] font-black text-white font-mono">
                              LKR {calculateAuditedTotal(activePoToReceive).toLocaleString()}
                           </p>
                        </div>
                     </div>
                     <div className="w-full lg:w-auto grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-3">
                        <button onClick={() => { setIsReceiptModalOpen(false); setActivePoToReceive(null); }} className="px-5 py-3 bg-white/5 border border-white/10 text-slate-300 rounded-[1.1rem] text-[9px] font-black uppercase tracking-[0.18em] shadow-2xl active:scale-95 transition-all">
                           Cancel
                        </button>
                        <button onClick={handleFinalizeReceipt} disabled={isSaving} className="px-6 py-3 bg-blue-600 text-white rounded-[1.1rem] text-[9px] font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all">
                        {isSaving ? <Loader2 className="animate-spin mx-auto" /> : 'VERIFY & SYNC GLOBAL INVENTORY'}
                        </button>
                     </div>
                  </div>
               </GlassCard>
            </div>
         )}

         {isPaymentModalOpen && selectedSupplier && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-4">
               <GlassCard className="w-full max-w-lg bg-[#0b1121] p-6 sm:p-10 lg:p-12 rounded-[2rem] sm:rounded-[4rem] border-2 border-white/10 shadow-3xl animate-in zoom-in-95 max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar">
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
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-4">
               <div className="w-full max-w-2xl animate-in zoom-in-95 duration-300">
                  <AIAdvisor mode="SUPPLIER" contextData={getSupplierContext()} onClose={() => setShowAiModal(false)} />
               </div>
            </div>
         )}

         {showDeliveryTracker && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-4">
               <GlassCard className="w-full max-w-4xl bg-[#0b1121] p-10 rounded-[3rem] border-2 border-white/10 shadow-3xl animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-8 shrink-0">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-600/10 text-purple-500 rounded-2xl flex items-center justify-center border border-purple-500/20">
                           <Truck size={28} />
                        </div>
                        <div>
                           <h3 className="text-xl font-black text-white uppercase tracking-tight">Asset Logistics</h3>
                           <p className="text-[9px] text-gray-600 font-black uppercase tracking-[0.3em]">Carrier Verification Protocol</p>
                        </div>
                     </div>
                     <button onClick={() => setShowDeliveryTracker(false)} className="p-4 bg-white/5 text-gray-500 hover:text-white rounded-2xl transition-all"><X size={24} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                     <div className="space-y-4">
                        {purchaseOrders.filter(po => po.status === 'SHIPPED' || po.status === 'TRANSIT').map(po => (
                           <div key={po.id} className="p-6 bg-white/5 rounded-3xl border border-white/5 flex items-center justify-between group">
                              <div>
                                 <p className="text-xs font-black text-white uppercase">PO #{po.id.slice(-6)} - {po.supplierName}</p>
                                 <p className="text-[9px] text-gray-500 font-black uppercase mt-1">Dispatched: {new Date(po.date).toLocaleDateString()}</p>
                              </div>
                              <button onClick={() => { setActivePoToReceive(po); setIsReceiptModalOpen(true); }} className="px-5 py-2.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">Initiate Reception</button>
                           </div>
                        ))}
                        {purchaseOrders.filter(po => po.status === 'SHIPPED' || po.status === 'TRANSIT').length === 0 && (
                           <div className="text-center py-20">
                              <Loader2 size={48} className="text-gray-800 mx-auto mb-4 animate-spin" />
                              <p className="text-gray-600 font-black uppercase text-xs tracking-widest">No Active Shipments Detected</p>
                           </div>
                        )}
                     </div>
                  </div>
               </GlassCard>
            </div>
         )}
      </div>
   );
};
