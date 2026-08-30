import React, { useState, useEffect, useRef } from 'react';
import { GlassCard } from './ui/GlassCard';
import { GlassInput } from './ui/GlassInput';
import { tmHubService, TMHubRechargeResponse } from '../services/tmHubService';
import { reloadPackagesService, ReloadPackage } from '../services/reloadPackagesService';
import { whatsappService } from '../services/whatsapp';
import { db } from '../services/mockDb';
import {
  Zap, Smartphone, RefreshCw, CheckCircle2, AlertCircle,
  Loader2, DollarSign, History, Send, ShieldCheck, Check, MessageSquare, ExternalLink,
  Package, Plus, Trash2, Edit3, X, SlidersHorizontal, Info, Search, Printer, Sparkles, TrendingUp,
  Download, Users, Copy, AlertTriangle, Layers, UserCheck, PieChart, FileSpreadsheet, Tv, Wifi,
  BarChart3, ChevronRight, CheckCircle, Clock, Sparkle, ArrowUpRight, RotateCw
} from 'lucide-react';

interface RechargeHistoryItem {
  id: string;
  mobile: string;
  amount: number;
  provider: string;
  orderId: string;
  refId?: string;
  status: string;
  date: string;
  remark?: string;
  waSent?: boolean;
}

interface SavedContact {
  id: string;
  name: string;
  mobile: string;
  provider: string;
}

interface NetworkCarrier {
  name: string;
  badgeColor: string;
  glowColor: string;
  gradient: string;
  code: string;
  providerId: string;
  commissionRate: number; // e.g. 0.078 for 7.80%
  type: string;
  prefixes: string[];
}

const NETWORKS: NetworkCarrier[] = [
  { name: 'Mobitel', badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', glowColor: 'hover:shadow-cyan-500/20', gradient: 'from-blue-600 via-cyan-600 to-indigo-700', code: 'MOBITEL', providerId: '104', commissionRate: 0.078, type: 'PREPAID', prefixes: ['071', '070'] },
  { name: 'Airtel', badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30', glowColor: 'hover:shadow-pink-500/20', gradient: 'from-red-600 via-pink-600 to-rose-700', code: 'AIRTEL', providerId: '105', commissionRate: 0.069, type: 'PREPAID', prefixes: ['075'] },
  { name: 'Hutch', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30', glowColor: 'hover:shadow-amber-500/20', gradient: 'from-amber-500 via-orange-600 to-red-600', code: 'HUTCH', providerId: '106', commissionRate: 0.069, type: 'PREPAID', prefixes: ['078', '072'] },
  { name: 'Dialog Mobile', badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30', glowColor: 'hover:shadow-red-500/20', gradient: 'from-red-600 via-amber-600 to-orange-600', code: 'DIALOG', providerId: '101', commissionRate: 0.022, type: 'PREPAID', prefixes: ['077', '076', '074'] },
  { name: 'Dialog Broadband', badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30', glowColor: 'hover:shadow-orange-500/20', gradient: 'from-amber-600 to-orange-700', code: 'DHBB', providerId: '102', commissionRate: 0.022, type: 'PREPAID', prefixes: [] },
  { name: 'Dialog TV', badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30', glowColor: 'hover:shadow-rose-500/20', gradient: 'from-rose-600 to-red-800', code: 'DTV', providerId: '103', commissionRate: 0.022, type: 'PREPAID', prefixes: [] },
  { name: 'SLT Broadband', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', glowColor: 'hover:shadow-emerald-500/20', gradient: 'from-emerald-600 via-teal-600 to-cyan-700', code: 'SLT', providerId: '107', commissionRate: 0.022, type: 'PREPAID', prefixes: ['011', '031', '081', '021', '025', '026', '027', '032', '033', '034', '035', '036', '037', '038', '041', '045', '047', '051', '052', '054', '055', '057', '063', '065', '066', '067'] },
];

const PRESET_AMOUNTS = [50, 100, 200, 350, 500, 1000, 1499, 2000];

export const TMHubRecharge: React.FC = () => {
  const [mobile, setMobile] = useState('');
  const [amount, setAmount] = useState('');
  const [provider, setProvider] = useState('MOBITEL');
  const [autoDetected, setAutoDetected] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<TMHubRechargeResponse | null>(null);
  const [history, setHistory] = useState<RechargeHistoryItem[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [autoWhatsApp, setAutoWhatsApp] = useState(true);
  const [waSending, setWaSending] = useState(false);
  const [waNotice, setWaNotice] = useState<{ success: boolean; message: string; rawMsg?: string } | null>(null);
  const [checkingStatusId, setCheckingStatusId] = useState<string | null>(null);
  const [isSyncingAllPending, setIsSyncingAllPending] = useState(false);
  const [providerStatuses, setProviderStatuses] = useState<Record<string, 'ACTIVE' | 'DISABLED' | 'CHECKING'>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Frequent Contacts State
  const [savedContacts, setSavedContacts] = useState<SavedContact[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');

  // Bulk Batch Reload State
  const [showBulkMode, setShowBulkMode] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [bulkAmount, setBulkAmount] = useState('100');
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; activeMobile?: string } | null>(null);
  const [bulkResults, setBulkResults] = useState<{ mobile: string; status: string; message: string }[]>([]);

  // Low Balance Warning Threshold
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState(1000);

  // History Filter & Search state
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED'>('ALL');

  // Network Packages state
  const [networkPackages, setNetworkPackages] = useState<ReloadPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<ReloadPackage | null>(null);
  const [showPackageManager, setShowPackageManager] = useState(false);
  const [newPkgForm, setNewPkgForm] = useState({
    name: '',
    amount: '',
    description: '',
    category: 'COMBO' as ReloadPackage['category'],
    validityDays: '30',
  });

  const historyRef = useRef(history);
  historyRef.current = history;

  useEffect(() => {
    setApiKey(tmHubService.getApiKey());
    fetchBalance();
    loadHistory();
    loadSavedContacts();
    loadNetworkPackages(provider);
    checkAllProviderStatuses();
  }, []);

  useEffect(() => {
    loadNetworkPackages(provider);
    setSelectedPackage(null);
  }, [provider]);

  // 🔄 Automatic Background Status Poller for Pending Reloads (Every 8 seconds)
  useEffect(() => {
    const pollerInterval = setInterval(() => {
      const pendingItems = historyRef.current.filter(
        (h) => h.status === 'PENDING' || h.status === 'PROCESSING' || h.status === 'ACCEPTED'
      );

      if (pendingItems.length > 0) {
        syncPendingOrders(pendingItems);
      }
    }, 8000);

    return () => clearInterval(pollerInterval);
  }, []);

  // Automatic Carrier Detector
  const handleMobileChange = (val: string) => {
    setMobile(val);
    const cleanNum = val.replace(/[^0-9]/g, '');
    if (cleanNum.length >= 3) {
      const prefix3 = cleanNum.slice(0, 3);
      const matched = NETWORKS.find((net) => net.prefixes.includes(prefix3));
      if (matched) {
        setProvider(matched.code);
        setAutoDetected(matched.name);
        return;
      }
    }
    setAutoDetected(null);
  };

  const loadNetworkPackages = (provCode: string) => {
    const pkgs = reloadPackagesService.getPackagesByProvider(provCode);
    setNetworkPackages(pkgs);
  };

  const loadSavedContacts = () => {
    try {
      const saved = localStorage.getItem('tm_hub_saved_contacts');
      if (saved) {
        setSavedContacts(JSON.parse(saved));
      } else {
        const defaults: SavedContact[] = [
          { id: '1', name: 'Cashier Main', mobile: '0771234567', provider: 'DIALOG' },
          { id: '2', name: 'Store Staff', mobile: '0719876543', provider: 'MOBITEL' },
        ];
        setSavedContacts(defaults);
        localStorage.setItem('tm_hub_saved_contacts', JSON.stringify(defaults));
      }
    } catch (e) {}
  };

  const saveContact = (name: string, mob: string, prov: string) => {
    if (!name || !mob) return;
    const cleanMob = mob.replace(/[^0-9]/g, '');
    const updated = [{ id: `CNT_${Date.now()}`, name, mobile: cleanMob, provider: prov }, ...savedContacts];
    setSavedContacts(updated);
    localStorage.setItem('tm_hub_saved_contacts', JSON.stringify(updated));
    setNewContactName('');
    setShowAddContact(false);
  };

  const deleteContact = (id: string) => {
    const updated = savedContacts.filter((c) => c.id !== id);
    setSavedContacts(updated);
    localStorage.setItem('tm_hub_saved_contacts', JSON.stringify(updated));
  };

  const selectContact = (c: SavedContact) => {
    setMobile(c.mobile);
    setProvider(c.provider);
    setAutoDetected(c.provider);
  };

  const checkAllProviderStatuses = async () => {
    const statuses: Record<string, 'ACTIVE' | 'DISABLED' | 'CHECKING'> = {};
    for (const net of NETWORKS) {
      statuses[net.code] = 'CHECKING';
    }
    setProviderStatuses({ ...statuses });

    for (const net of NETWORKS) {
      try {
        const res = await tmHubService.checkProviderStatus(net.code);
        statuses[net.code] = res.providerStatus || (res.success ? 'ACTIVE' : 'ACTIVE');
      } catch (e) {
        statuses[net.code] = 'ACTIVE';
      }
    }
    setProviderStatuses({ ...statuses });
  };

  const fetchBalance = async () => {
    setIsBalanceLoading(true);
    try {
      const res = await tmHubService.getBalance();
      setBalance(res.balance ?? 0);
    } finally {
      setIsBalanceLoading(false);
    }
  };

  const loadHistory = () => {
    try {
      const saved = localStorage.getItem('tm_hub_recharge_history');
      if (saved) setHistory(JSON.parse(saved));
    } catch (e) {
      console.warn('Failed to load reload history', e);
    }
  };

  const saveHistoryItem = (item: RechargeHistoryItem) => {
    const updated = [item, ...historyRef.current].slice(0, 100);
    setHistory(updated);
    localStorage.setItem('tm_hub_recharge_history', JSON.stringify(updated));
  };

  const handleSaveApiKey = () => {
    tmHubService.setApiKey(apiKey.trim());
    setShowConfig(false);
    fetchBalance();
  };

  const handleSelectPackage = (pkg: ReloadPackage) => {
    setSelectedPackage(pkg);
    setAmount(String(pkg.amount));
  };

  const handleSaveCustomPackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPkgForm.name || !newPkgForm.amount || parseFloat(newPkgForm.amount) <= 0) return;

    reloadPackagesService.savePackage({
      providerCode: provider,
      name: newPkgForm.name,
      amount: parseFloat(newPkgForm.amount),
      description: newPkgForm.description || `${provider} Rs. ${newPkgForm.amount} Offer`,
      category: newPkgForm.category,
      validityDays: newPkgForm.validityDays ? parseInt(newPkgForm.validityDays) : undefined,
    });

    setNewPkgForm({ name: '', amount: '', description: '', category: 'COMBO', validityDays: '30' });
    loadNetworkPackages(provider);
  };

  const handleDeletePackage = (id: string) => {
    if (!confirm('Are you sure you want to remove this package offer?')) return;
    reloadPackagesService.deletePackage(id);
    loadNetworkPackages(provider);
  };

  const handleResetPackages = () => {
    if (!confirm('Reset all network reload packages to default system offers?')) return;
    reloadPackagesService.resetToDefaults();
    loadNetworkPackages(provider);
  };

  const handleCheckLiveStatus = async (item: RechargeHistoryItem) => {
    setCheckingStatusId(item.id);
    try {
      const res = await tmHubService.checkStatus(item.orderId);
      if (res.status) {
        const updated = historyRef.current.map((h) =>
          h.id === item.id
            ? {
                ...h,
                status: res.status || h.status,
                remark: res.remark || res.message || h.remark,
                refId: res.ref || h.refId,
              }
            : h
        );
        setHistory(updated);
        localStorage.setItem('tm_hub_recharge_history', JSON.stringify(updated));
        if (res.status === 'SUCCESS') {
          fetchBalance();
        }
      }
    } finally {
      setCheckingStatusId(null);
    }
  };

  // Sync All Pending Orders Routine
  const syncPendingOrders = async (targetPending?: RechargeHistoryItem[]) => {
    const listToScan = targetPending || historyRef.current.filter((h) => h.status === 'PENDING' || h.status === 'PROCESSING');
    if (listToScan.length === 0) return;

    setIsSyncingAllPending(true);
    let hasUpdated = false;
    let currentList = [...historyRef.current];

    for (const item of listToScan) {
      try {
        const res = await tmHubService.checkStatus(item.orderId);
        if (res.status && res.status !== item.status) {
          hasUpdated = true;
          currentList = currentList.map((h) =>
            h.id === item.id
              ? {
                  ...h,
                  status: res.status || h.status,
                  remark: res.remark || res.message || h.remark,
                  refId: res.ref || h.refId,
                }
              : h
          );
        }
      } catch (e) {}
    }

    if (hasUpdated) {
      setHistory(currentList);
      localStorage.setItem('tm_hub_recharge_history', JSON.stringify(currentList));
      fetchBalance();
    }
    setIsSyncingAllPending(false);
  };

  const sendWhatsAppReceipt = async (targetMobile: string, numAmount: number, targetProvider: string, orderId: string, status: string) => {
    setWaSending(true);
    setWaNotice(null);
    try {
      const settings = await db.settings.get();
      const message = whatsappService.generateReloadReceiptMessage(
        targetMobile,
        numAmount,
        targetProvider,
        orderId,
        status,
        settings
      );

      const res = await whatsappService.sendDirect(settings, targetMobile, message);

      if (res.success) {
        setWaNotice({ success: true, message: `WhatsApp receipt sent successfully to ${targetMobile}` });
      } else {
        setWaNotice({
          success: false,
          message: res.error || 'Direct WhatsApp send unavailable. Click below to open in WhatsApp Web.',
          rawMsg: message,
        });
      }
    } catch (err: any) {
      setWaNotice({
        success: false,
        message: `Failed to send WhatsApp message: ${err.message || String(err)}`,
      });
    } finally {
      setWaSending(false);
    }
  };

  const handleCopyReceiptText = (item: RechargeHistoryItem) => {
    const text = `WR POS RELOAD RECEIPT\nDate: ${item.date}\nOrder ID: ${item.orderId}\nNetwork: ${item.provider}\nMobile: ${item.mobile}\nAmount: LKR ${item.amount.toFixed(2)}\nStatus: ${item.status}\nRef: ${item.refId || 'N/A'}\nJoin WhatsApp Offers: https://chat.whatsapp.com/G2sFie5DaUHL4XyY2oGEbP`;
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrintSlip = (item: RechargeHistoryItem) => {
    const printWin = window.open('', '_blank', 'width=400,height=600');
    if (!printWin) return;

    printWin.document.write(`
      <html>
        <head>
          <title>Reload Receipt - ${item.orderId}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; text-align: center; font-size: 13px; }
            h2 { margin: 0 0 5px 0; font-size: 18px; text-transform: uppercase; }
            .line { border-bottom: 1px dashed #000; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin: 5px 0; }
            .bold { font-weight: bold; }
            .amount { font-size: 20px; font-weight: bold; margin: 10px 0; }
            .footer { font-size: 10px; margin-top: 15px; color: #555; }
          </style>
        </head>
        <body>
          <h2>WR POS RELOAD</h2>
          <div>Instant Mobile Recharge</div>
          <div class="line"></div>
          <div class="row"><span>Date:</span><span>${item.date}</span></div>
          <div class="row"><span>Order ID:</span><span>${item.orderId}</span></div>
          <div class="row"><span>Network:</span><span class="bold">${item.provider}</span></div>
          <div class="row"><span>Mobile:</span><span class="bold">${item.mobile}</span></div>
          <div class="amount">Rs. ${item.amount.toFixed(2)}</div>
          <div class="row"><span>Status:</span><span class="bold">${item.status}</span></div>
          ${item.refId ? `<div class="row"><span>Ref:</span><span>${item.refId}</span></div>` : ''}
          <div class="line"></div>
          <div>Join WhatsApp Group for Offers:</div>
          <div style="font-size: 9px; word-break: break-all; margin-top: 4px;">https://chat.whatsapp.com/G2sFie5DaUHL4XyY2oGEbP</div>
          <div class="footer">Thank you for your business!</div>
          <script>window.print(); setTimeout(() => window.close(), 1000);</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const handleExportCSV = () => {
    if (history.length === 0) return;

    const headers = ['Order ID', 'Date', 'Mobile', 'Provider', 'Amount LKR', 'Status', 'Ref ID', 'Remark'];
    const rows = history.map((item) => [
      item.orderId,
      `"${item.date}"`,
      `"${item.mobile}"`,
      item.provider,
      item.amount,
      item.status,
      `"${item.refId || ''}"`,
      `"${(item.remark || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TM_Hub_Reloads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmitRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile || !amount || parseFloat(amount) <= 0) return;

    setIsSubmitting(true);
    setLastResult(null);
    setWaNotice(null);

    try {
      const cleanMobile = mobile.replace(/[^0-9]/g, '');
      const numAmount = parseFloat(amount);
      const activeCarrier = NETWORKS.find(n => n.code === provider) || NETWORKS[0];

      const res = await tmHubService.requestRecharge({
        mobile: cleanMobile,
        amount: numAmount,
        providerCode: activeCarrier.providerId || activeCarrier.code,
      });

      setLastResult(res);

      if (res.success || res.status === 'PENDING') {
        const historyItem: RechargeHistoryItem = {
          id: `RECHARGE_${Date.now()}`,
          mobile: cleanMobile,
          amount: numAmount,
          provider: activeCarrier.code,
          orderId: res.orderId || `ORD_${Date.now()}`,
          refId: res.ref || res.reqId,
          status: res.status || 'PENDING',
          date: new Date().toLocaleString(),
          remark: selectedPackage ? `${selectedPackage.name} - ${res.message || res.remark || ''}` : (res.message || res.remark),
          waSent: autoWhatsApp,
        };
        saveHistoryItem(historyItem);
        fetchBalance();

        // ⏱️ Auto Status Re-check after 3s and 8s for pending orders
        if (historyItem.status === 'PENDING' || historyItem.status === 'PROCESSING') {
          setTimeout(() => handleCheckLiveStatus(historyItem), 3000);
          setTimeout(() => handleCheckLiveStatus(historyItem), 8000);
        }

        if (autoWhatsApp) {
          sendWhatsAppReceipt(cleanMobile, numAmount, activeCarrier.code, historyItem.orderId, historyItem.status);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk Batch Processing Routine
  const handleRunBulkBatch = async () => {
    const rawNumbers = bulkInput
      .split(/[\n,;]+/)
      .map((n) => n.trim().replace(/[^0-9]/g, ''))
      .filter((n) => n.length >= 9);

    if (rawNumbers.length === 0) return;

    const numAmt = parseFloat(bulkAmount);
    if (isNaN(numAmt) || numAmt <= 0) return;

    setBulkResults([]);
    setBulkProgress({ current: 0, total: rawNumbers.length });

    const results: { mobile: string; status: string; message: string }[] = [];

    for (let i = 0; i < rawNumbers.length; i++) {
      const mob = rawNumbers[i];
      setBulkProgress({ current: i + 1, total: rawNumbers.length, activeMobile: mob });

      const prefix3 = mob.slice(0, 3);
      const matched = NETWORKS.find((net) => net.prefixes.includes(prefix3)) || NETWORKS[0];

      try {
        const res = await tmHubService.requestRecharge({
          mobile: mob,
          amount: numAmt,
          providerCode: matched.providerId || matched.code,
        });

        const statusStr = res.status || (res.success ? 'SUCCESS' : 'FAILED');
        results.push({ mobile: mob, status: statusStr, message: res.message || res.remark || (res.success ? 'Success' : 'Failed') });

        if (res.success || res.status === 'PENDING') {
          const item: RechargeHistoryItem = {
            id: `RECHARGE_${Date.now()}_${i}`,
            mobile: mob,
            amount: numAmt,
            provider: matched.code,
            orderId: res.orderId || `ORD_${Date.now()}_${i}`,
            refId: res.ref || res.reqId,
            status: statusStr,
            date: new Date().toLocaleString(),
            remark: `Bulk Batch Reload - ${matched.name}`,
          };
          saveHistoryItem(item);
          if (item.status === 'PENDING') {
            setTimeout(() => handleCheckLiveStatus(item), 4000);
          }
        }
      } catch (err: any) {
        results.push({ mobile: mob, status: 'FAILED', message: err.message || 'Error' });
      }

      await new Promise((r) => setTimeout(r, 400));
    }

    setBulkResults(results);
    setBulkProgress(null);
    fetchBalance();
  };

  // Filtered History Calculation
  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      item.mobile.includes(historySearch) ||
      item.orderId.toLowerCase().includes(historySearch.toLowerCase()) ||
      item.provider.toLowerCase().includes(historySearch.toLowerCase());
    const matchesStatus = historyFilter === 'ALL' || item.status === historyFilter;
    return matchesSearch && matchesStatus;
  });

  // Today's Stats & Exact Carrier Commission Profit Calculation
  const todayStr = new Date().toLocaleDateString();
  const todayItems = history.filter((item) => new Date(item.date).toLocaleDateString() === todayStr);
  const totalTodayAmount = todayItems.reduce((sum, item) => sum + item.amount, 0);

  const estimatedCommission = todayItems.reduce((sum, item) => {
    const carrier = NETWORKS.find((n) => n.code === item.provider || n.providerId === item.provider);
    const rate = carrier ? carrier.commissionRate : 0.025;
    return sum + item.amount * rate;
  }, 0);

  const pendingCount = history.filter((i) => i.status === 'PENDING' || i.status === 'PROCESSING').length;

  // Carrier Share Distribution for Today
  const providerStats = NETWORKS.map((net) => {
    const netItems = todayItems.filter((i) => i.provider === net.code || i.provider === net.providerId);
    const count = netItems.length;
    const amount = netItems.reduce((s, i) => s + i.amount, 0);
    return { name: net.name, code: net.code, rate: (net.commissionRate * 100).toFixed(1), count, amount };
  });

  const cleanMobileDigits = mobile.replace(/[^0-9]/g, '');
  const isValidSriLankaNum = cleanMobileDigits.length === 10 || cleanMobileDigits.length === 9;
  const isLowBalance = balance !== null && balance < lowBalanceThreshold;

  const currentCarrier = NETWORKS.find((n) => n.code === provider) || NETWORKS[0];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1500px] mx-auto min-h-screen text-slate-100 font-sans selection:bg-cyan-500 selection:text-black">
      
      {/* 🌟 Ultra-Premium Glowing Command Glass Header */}
      <div className="relative overflow-hidden p-6 md:p-8 rounded-[2.5rem] bg-gradient-to-r from-slate-900/90 via-indigo-950/80 to-slate-900/90 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-[0_0_30px_rgba(6,182,212,0.4)] border border-cyan-300/30">
              <Zap size={34} className="animate-pulse text-cyan-200" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight uppercase" style={{ fontFamily: 'var(--font-display)' }}>
                  TM Hub Reload & Commission Hub
                </h1>
                <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-black tracking-widest uppercase shadow-sm flex items-center gap-1.5">
                  <RotateCw size={11} className="animate-spin text-cyan-400" /> Auto-Status Poller Active
                </span>
              </div>
              <p className="text-xs md:text-sm font-semibold text-slate-300/90 tracking-wide">
                Sri Lankan Mobile & Utility Reloads • Highest Reseller Profit Margins • Automatic Status Verification
              </p>
            </div>
          </div>

          {/* Reseller Stats & Live API Balance Grid */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Sales & Profit Widget */}
            <div className="flex items-center gap-3.5 bg-gradient-to-r from-emerald-950/40 to-teal-950/40 p-3.5 px-5 rounded-2xl border border-emerald-500/30 shadow-lg">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-emerald-300/80 tracking-wider">Today Earnings</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-black text-white font-mono">Rs. {totalTodayAmount.toLocaleString('en-LK')}</span>
                  <span className="text-xs font-black text-emerald-400 font-mono">+Rs. {estimatedCommission.toFixed(2)} Profit</span>
                </div>
              </div>
            </div>

            {/* TM Hub Live Balance Card */}
            <div className={`flex items-center gap-4 p-3.5 px-6 rounded-2xl border transition-all duration-300 shadow-xl ${
              isLowBalance ? 'bg-gradient-to-r from-amber-950/60 to-red-950/60 border-amber-500/50 animate-pulse' : 'bg-white/5 border-white/10 hover:border-cyan-500/30'
            }`}>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1 justify-end">
                  {isLowBalance && <AlertTriangle size={12} className="text-amber-400" />} TM Hub API Balance
                </p>
                <p className={`text-2xl font-black font-mono tracking-tight ${isLowBalance ? 'text-amber-400' : 'text-cyan-400'}`}>
                  {balance !== null ? `Rs. ${balance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}` : 'Rs. --.--'}
                </p>
              </div>
              <button
                onClick={fetchBalance}
                disabled={isBalanceLoading}
                className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-all border border-cyan-500/30 hover:scale-105 active:scale-95 shadow-lg shadow-cyan-500/10"
                title="Refresh TM Hub Balance"
              >
                <RefreshCw size={20} className={isBalanceLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Carrier Commission Ticker Bar */}
        <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-bold">
            <PieChart size={16} className="text-cyan-400" /> Carrier Commission Margins:
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {NETWORKS.map((net) => (
              <div
                key={net.code}
                className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-2 backdrop-blur-md transition-all ${
                  provider === net.code ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-md shadow-cyan-500/20 scale-105' : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${net.gradient}`} />
                <span>{net.name}</span>
                <span className="font-mono font-black text-cyan-300">{(net.commissionRate * 100).toFixed(1)}% Profit</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Low Balance Warning Banner */}
      {isLowBalance && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/80 via-orange-950/70 to-red-950/80 border border-amber-500/50 text-amber-200 text-xs font-bold flex items-center justify-between gap-4 shadow-xl backdrop-blur-xl animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <AlertTriangle size={22} />
            </div>
            <div>
              <p className="text-sm font-extrabold text-white">Low TM Hub Balance Warning!</p>
              <p className="text-slate-300 mt-0.5">Your TM Hub account balance (Rs. {balance?.toFixed(2)}) is below the warning limit of Rs. {lowBalanceThreshold}. Top up on the TM portal to avoid reload rejections.</p>
            </div>
          </div>
          <a
            href="https://hub.tmrecharge.lk"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs hover:from-amber-400 hover:to-orange-400 transition-all shrink-0 flex items-center gap-2 shadow-lg shadow-amber-500/20"
          >
            Portal Top-Up <ExternalLink size={14} />
          </a>
        </div>
      )}

      {/* Main Mode Toggle Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-2 rounded-2xl border border-white/10 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkMode(false)}
            className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2.5 ${
              !showBulkMode
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30 font-bold scale-[1.02]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Smartphone size={16} /> Instant Single Reload
          </button>
          <button
            onClick={() => setShowBulkMode(true)}
            className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2.5 ${
              showBulkMode
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-600/30 font-bold scale-[1.02]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers size={16} /> Multi-Number Bulk Batch
          </button>
        </div>

        {/* Quick Config Button */}
        <div className="flex items-center gap-3 pr-2">
          <button
            type="button"
            onClick={() => setShowPackageManager(!showPackageManager)}
            className="px-3.5 py-2 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <SlidersHorizontal size={14} /> {showPackageManager ? 'Close Offers' : 'Manage Offers'}
          </button>
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className="px-3.5 py-2 rounded-xl bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 text-xs font-bold transition-all"
          >
            {showConfig ? 'Hide Config' : 'API Settings'}
          </button>
        </div>
      </div>

      {/* Main Container Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Primary Section: Single Reload Form / Bulk Reload Mode */}
        <div className="lg:col-span-7 space-y-6">
          {!showBulkMode ? (
            <GlassCard className="p-6 md:p-8 rounded-[2.5rem] border-white/10 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
              <form onSubmit={handleSubmitRecharge} className="space-y-7">
                
                {/* Section Title */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2.5">
                    <Smartphone className="text-cyan-400" size={22} /> Select Network Carrier & Provider Code
                  </h2>
                  <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
                    TM Hub API Active
                  </span>
                </div>

                {/* API Key & Threshold Drawer */}
                {showConfig && (
                  <div className="p-5 rounded-2xl bg-black/50 border border-cyan-500/30 space-y-4 animate-fade-in backdrop-blur-md">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-extrabold text-slate-300">TM Hub Secret API Key</label>
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="e6aeaa..."
                          className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs mt-1 font-mono focus:border-cyan-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-extrabold text-slate-300">Low Balance Limit (LKR)</label>
                        <input
                          type="number"
                          value={lowBalanceThreshold}
                          onChange={(e) => setLowBalanceThreshold(parseFloat(e.target.value) || 1000)}
                          className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs mt-1 font-mono focus:border-cyan-400 outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveApiKey}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-cyan-600/30"
                    >
                      Save Settings & Re-sync Balance
                    </button>
                  </div>
                )}

                {/* Network Carrier Selection Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {NETWORKS.map((net) => {
                    const isSelected = provider === net.code;
                    const isAuto = autoDetected === net.name;
                    const provStatus = providerStatuses[net.code];
                    const commPct = (net.commissionRate * 100).toFixed(1);

                    return (
                      <button
                        key={net.code}
                        type="button"
                        onClick={() => { setProvider(net.code); setAutoDetected(null); }}
                        className={`p-4 rounded-2xl border relative flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-extrabold ${
                          isSelected
                            ? `bg-gradient-to-b ${net.gradient} border-white text-white shadow-2xl scale-[1.03] shadow-cyan-500/20`
                            : `bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white ${net.glowColor}`
                        }`}
                      >
                        {isAuto && (
                          <span className="absolute -top-2.5 bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-lg tracking-wider">
                            Auto-Detected
                          </span>
                        )}

                        <div className="flex items-center gap-2">
                          <span className={`w-3.5 h-3.5 rounded-full bg-gradient-to-r ${net.gradient} border border-white/20`} />
                          <span className="text-xs font-black tracking-wide">{net.name}</span>
                        </div>

                        <div className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md border ${isSelected ? 'bg-black/30 text-white border-white/20' : 'bg-black/20 text-cyan-300 border-cyan-500/20'}`}>
                          Code {net.providerId} • {commPct}% Profit
                        </div>

                        {provStatus === 'DISABLED' && (
                          <span className="text-[9px] font-black text-rose-400 uppercase">Offline</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Active Network Packages Grid */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <Package size={16} className="text-yellow-400 animate-pulse" /> Active {currentCarrier.name} Packages ({ (currentCarrier.commissionRate * 100).toFixed(1) }% Profit Margin)
                    </label>
                    <span className="text-[10px] font-bold text-slate-400">Click to Select</span>
                  </div>

                  {networkPackages.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center text-xs text-slate-400 font-semibold">
                      No custom packages saved for {currentCarrier.name}. Custom talktime reloads apply.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[240px] overflow-y-auto pr-1">
                      {networkPackages.map((pkg) => (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => handleSelectPackage(pkg)}
                          className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                            selectedPackage?.id === pkg.id || amount === String(pkg.amount)
                              ? 'bg-gradient-to-r from-cyan-900/60 via-indigo-900/60 to-purple-900/60 border-cyan-400 text-white shadow-xl scale-[1.01]'
                              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-xs font-black text-white leading-snug">{pkg.name}</span>
                            <span className="text-xs font-black text-cyan-300 font-mono shrink-0 bg-cyan-500/20 px-2.5 py-0.5 rounded-lg border border-cyan-500/30">
                              Rs.{pkg.amount}
                            </span>
                          </div>
                          <p className="text-[10px] font-medium text-slate-400 mt-1 line-clamp-2">{pkg.description}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Frequent Speed-Dial Contacts */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Users size={14} className="text-cyan-400" /> Frequent Customer Contacts
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddContact(!showAddContact)}
                      className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      <Plus size={13} /> {showAddContact ? 'Cancel' : 'Save Current Number'}
                    </button>
                  </div>

                  {showAddContact && (
                    <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 flex flex-wrap gap-2.5 animate-fade-in backdrop-blur-md">
                      <input
                        type="text"
                        placeholder="Contact Name (e.g. John Store)"
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs flex-1 min-w-[140px] focus:border-cyan-400 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => saveContact(newContactName, mobile, provider)}
                        className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-extrabold transition-all shadow-md shadow-cyan-600/30"
                      >
                        Save Speed Dial
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {savedContacts.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-400/50 hover:bg-white/10 transition-all text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => selectContact(c)}
                          className="font-bold text-slate-200 hover:text-cyan-300 flex items-center gap-1.5"
                        >
                          <UserCheck size={13} className="text-cyan-400" /> {c.name} <span className="font-mono text-slate-400">({c.mobile})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteContact(c.id)}
                          className="text-slate-500 hover:text-rose-400 ml-1 transition-colors"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mobile Number Input with Auto-Carrier Detector */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      Customer Mobile / Account Number
                    </label>
                    {cleanMobileDigits.length > 0 && (
                      <span className={`text-[11px] font-mono font-bold ${isValidSriLankaNum ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {isValidSriLankaNum ? '✓ Valid Sri Lankan Format' : `${cleanMobileDigits.length} Digits`}
                      </span>
                    )}
                  </div>
                  <GlassInput
                    type="text"
                    placeholder="e.g. 0771234567 or account no..."
                    value={mobile}
                    onChange={(e) => handleMobileChange(e.target.value)}
                    className="text-xl font-mono tracking-widest text-cyan-300 p-4 font-bold"
                    required
                  />
                </div>

                {/* Amount Selection & Calculated Reseller Profit Preview */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-300">
                      Recharge Amount (LKR)
                    </label>
                    {parseFloat(amount) > 0 && (
                      <span className="text-xs font-black text-emerald-400 font-mono bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                        Net Profit: +Rs. {(parseFloat(amount) * currentCarrier.commissionRate).toFixed(2)} ({(currentCarrier.commissionRate * 100).toFixed(1)}%)
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-2">
                    {PRESET_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => { setAmount(String(amt)); setSelectedPackage(null); }}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all font-mono ${
                          amount === String(amt) && !selectedPackage
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/20 scale-105'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        Rs.{amt}
                      </button>
                    ))}
                  </div>
                  <GlassInput
                    type="number"
                    placeholder="Enter custom amount..."
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setSelectedPackage(null); }}
                    className="text-2xl font-black text-white font-mono p-4"
                    required
                  />
                </div>

                {/* WhatsApp Auto Receipt Toggle */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-slate-900/50 border border-emerald-500/30 shadow-lg">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
                      <MessageSquare size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-white">Auto-Send Customer WhatsApp Receipt</p>
                      <p className="text-[10px] text-slate-400 font-medium">Includes transaction details, package offer info & store WhatsApp group link</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoWhatsApp}
                    onChange={(e) => setAutoWhatsApp(e.target.checked)}
                    className="w-5 h-5 accent-emerald-500 cursor-pointer rounded-lg"
                  />
                </div>

                {/* Submit Reload Action Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || !mobile || !amount}
                  className="w-full py-5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl shadow-cyan-500/30 transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={22} className="animate-spin text-cyan-200" /> Processing TM Hub API Recharge...
                    </>
                  ) : (
                    <>
                      <Send size={22} /> Process TM Hub Recharge (Rs. {amount || '0'})
                    </>
                  )}
                </button>
              </form>
            </GlassCard>
          ) : (
            /* Bulk Multi-Number Batch Reload Panel */
            <GlassCard className="p-6 md:p-8 rounded-[2.5rem] border-white/10 shadow-2xl space-y-6 backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2.5">
                  <Layers className="text-purple-400" size={22} /> Bulk Multi-Number Reload Engine
                </h2>
                <span className="text-xs text-purple-300 font-bold bg-purple-500/20 px-3.5 py-1 rounded-full border border-purple-500/30">
                  Sequential Execution Mode
                </span>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Enter Mobile Numbers (Separated by Newlines, Commas or Spaces)
                </label>
                <textarea
                  rows={6}
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder="0771234567&#10;0719876543&#10;0781112223..."
                  className="w-full p-4 rounded-2xl bg-black/50 border border-white/10 text-white text-xs font-mono tracking-wider focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Default Reload Amount per Number (LKR)
                </label>
                <GlassInput
                  type="number"
                  value={bulkAmount}
                  onChange={(e) => setBulkAmount(e.target.value)}
                  className="text-xl font-bold text-white font-mono p-4"
                />
              </div>

              {bulkProgress && (
                <div className="p-4 rounded-2xl bg-purple-950/50 border border-purple-500/40 space-y-2.5 animate-fade-in">
                  <div className="flex justify-between text-xs font-bold text-purple-300">
                    <span>Reloading {bulkProgress.activeMobile}...</span>
                    <span>{bulkProgress.current} / {bulkProgress.total} Complete</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-300"
                      style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleRunBulkBatch}
                disabled={!!bulkProgress || !bulkInput.trim()}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl shadow-purple-600/30 transition-all disabled:opacity-50"
              >
                {bulkProgress ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />} Execute Multi-Number Batch Reloads
              </button>

              {/* Bulk Batch Results Execution Summary */}
              {bulkResults.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-white/10">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">Batch Execution Log</h4>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 text-xs font-mono">
                    {bulkResults.map((r, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5">
                        <span>{r.mobile}</span>
                        <span className={r.status === 'SUCCESS' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                          {r.status}: {r.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>
          )}

          {/* Manage Packages Offer Drawer */}
          {showPackageManager && (
            <GlassCard className="p-6 rounded-[2.5rem] border-emerald-500/30 space-y-4 animate-fade-in backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-black uppercase text-emerald-400 flex items-center gap-2">
                  <Edit3 size={18} /> Manage Custom {currentCarrier.name} Packages
                </h3>
                <button
                  onClick={handleResetPackages}
                  className="text-[11px] font-extrabold text-amber-400 hover:text-amber-300 underline"
                >
                  Reset Defaults
                </button>
              </div>

              {/* Form to Add Custom Package */}
              <form onSubmit={handleSaveCustomPackage} className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-black/50 border border-white/10">
                <input
                  type="text"
                  placeholder="Package Name (e.g. 10GB Data Pack)"
                  value={newPkgForm.name}
                  onChange={(e) => setNewPkgForm({ ...newPkgForm, name: e.target.value })}
                  className="px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs"
                  required
                />
                <input
                  type="number"
                  placeholder="Amount LKR (e.g. 345)"
                  value={newPkgForm.amount}
                  onChange={(e) => setNewPkgForm({ ...newPkgForm, amount: e.target.value })}
                  className="px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono"
                  required
                />
                <input
                  type="text"
                  placeholder="Description (e.g. 10GB Anytime Data 30 Days)"
                  value={newPkgForm.description}
                  onChange={(e) => setNewPkgForm({ ...newPkgForm, description: e.target.value })}
                  className="px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs sm:col-span-2"
                />
                <button
                  type="submit"
                  className="sm:col-span-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/30"
                >
                  <Plus size={15} /> Save New {currentCarrier.name} Package Offer
                </button>
              </form>

              {/* Package List */}
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {networkPackages.map((pkg) => (
                  <div key={pkg.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 text-xs">
                    <div>
                      <p className="font-black text-white">{pkg.name} — <span className="text-cyan-300 font-mono">Rs.{pkg.amount}</span></p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{pkg.description}</p>
                    </div>
                    <button
                      onClick={() => handleDeletePackage(pkg.id)}
                      className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-all"
                      title="Delete Package"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Last Result & WhatsApp Dispatch Card */}
          {lastResult && (
            <div className="space-y-4">
              <GlassCard className={`p-6 rounded-3xl border backdrop-blur-2xl ${lastResult.success ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-rose-500/50 bg-rose-950/20'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {lastResult.success ? (
                      <CheckCircle2 size={36} className="text-emerald-400 shrink-0 mt-1" />
                    ) : (
                      <AlertCircle size={36} className="text-rose-400 shrink-0 mt-1" />
                    )}
                    <div className="space-y-1">
                      <h3 className={`text-base font-black uppercase tracking-wider ${lastResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {lastResult.success ? 'Recharge Request Processed!' : 'Recharge Request Failed'}
                      </h3>
                      <p className="text-xs text-slate-200 font-medium">{lastResult.message || lastResult.remark || lastResult.error}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono text-slate-400 mt-2">
                        {lastResult.orderId && <span>Order ID: <strong className="text-white">{lastResult.orderId}</strong></span>}
                        {lastResult.reqId && <span>Req ID: <strong className="text-cyan-300">{lastResult.reqId}</strong></span>}
                        {lastResult.ref && <span>Ref: <strong className="text-emerald-300">{lastResult.ref}</strong></span>}
                      </div>
                    </div>
                  </div>

                  {lastResult.success && (
                    <button
                      onClick={() => sendWhatsAppReceipt(mobile, parseFloat(amount), provider, lastResult.orderId || `ORD_${Date.now()}`, lastResult.status || 'SUCCESS')}
                      disabled={waSending}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 text-xs font-black flex items-center gap-2 shrink-0 transition-all shadow-lg"
                    >
                      {waSending ? <Loader2 size={15} className="animate-spin" /> : <MessageSquare size={15} />}
                      Resend WhatsApp Receipt
                    </button>
                  )}
                </div>
              </GlassCard>

              {/* WhatsApp Dispatch Alert Banner */}
              {waNotice && (
                <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold shadow-lg ${
                  waNotice.success ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <MessageSquare size={18} />
                    <span>{waNotice.message}</span>
                  </div>
                  {waNotice.rawMsg && (
                    <button
                      onClick={() => whatsappService.openDirectWhatsApp(mobile, waNotice.rawMsg!)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center gap-2 hover:bg-emerald-500 transition-all shrink-0 shadow-md"
                    >
                      Open WhatsApp Web <ExternalLink size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Secondary Section: Reload Transaction History & Automatic Status Sync */}
        <div className="lg:col-span-5">
          <GlassCard className="p-6 rounded-[2.5rem] h-full space-y-5 border-white/10 backdrop-blur-2xl shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2.5">
                <History className="text-cyan-400" size={20} /> Reload History & Status
              </h3>
              <div className="flex items-center gap-2">
                {pendingCount > 0 && (
                  <button
                    onClick={() => syncPendingOrders()}
                    disabled={isSyncingAllPending}
                    className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-extrabold flex items-center gap-1 hover:bg-amber-500/30 transition-all animate-pulse shadow-sm"
                    title="Check all pending reloads now"
                  >
                    <RefreshCw size={12} className={isSyncingAllPending ? 'animate-spin' : ''} />
                    Sync {pendingCount} Pending
                  </button>
                )}
                <button
                  onClick={handleExportCSV}
                  disabled={history.length === 0}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-extrabold flex items-center gap-1.5 hover:bg-emerald-600/30 transition-all disabled:opacity-40 shadow-sm"
                  title="Export History to CSV File"
                >
                  <FileSpreadsheet size={14} /> Export CSV
                </button>
              </div>
            </div>

            {/* Filter Pills & Live Search Input */}
            <div className="space-y-3">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search mobile, order ID or carrier..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white text-xs focus:border-cyan-400 outline-none"
                />
              </div>

              <div className="flex gap-2 text-xs font-extrabold">
                {(['ALL', 'SUCCESS', 'PENDING', 'FAILED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setHistoryFilter(st)}
                    className={`px-3 py-1.5 rounded-xl border transition-all ${
                      historyFilter === st
                        ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-black shadow-lg shadow-cyan-500/20'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Reload History Items List */}
            {filteredHistory.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs font-semibold">
                No reload transaction history matching active filters.
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[560px] overflow-y-auto pr-1">
                {filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 transition-all space-y-3 shadow-md"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-black text-white">{item.mobile}</span>
                          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            {item.provider}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">{item.date}</p>
                        {item.remark && <p className="text-[10px] text-emerald-400/90 line-clamp-1 mt-0.5">{item.remark}</p>}
                      </div>

                      <div className="text-right">
                        <p className="text-base font-black text-cyan-400 font-mono">Rs. {item.amount}</p>
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md flex items-center gap-1 justify-end ${
                          item.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : item.status === 'PENDING' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {item.status === 'PENDING' && <Clock size={10} className="animate-spin" />}
                          {item.status}
                        </span>
                      </div>
                    </div>

                    {/* Action Bar per Item */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-white/5 text-[11px]">
                      <span className="text-slate-400 font-mono">ID: {item.orderId}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopyReceiptText(item)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/10 flex items-center gap-1 transition-all"
                          title="Copy Receipt Text"
                        >
                          {copiedId === item.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          {copiedId === item.id ? 'Copied' : 'Copy'}
                        </button>
                        <button
                          onClick={() => handleCheckLiveStatus(item)}
                          disabled={checkingStatusId === item.id}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 border border-cyan-500/20 flex items-center gap-1 transition-all"
                          title="Verify Live Status from TM Hub"
                        >
                          <RefreshCw size={12} className={checkingStatusId === item.id ? 'animate-spin' : ''} /> Status
                        </button>
                        <button
                          onClick={() => handlePrintSlip(item)}
                          className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/20 flex items-center gap-1 transition-all"
                          title="Print Thermal Slip"
                        >
                          <Printer size={12} /> Print
                        </button>
                        <button
                          onClick={() => sendWhatsAppReceipt(item.mobile, item.amount, item.provider, item.orderId, item.status)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 flex items-center gap-1 transition-all"
                          title="Send WhatsApp Receipt"
                        >
                          <MessageSquare size={12} /> WA
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
