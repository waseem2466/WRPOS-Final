
import React, { useState, useEffect, useRef } from 'react';
import { GlassCard } from './ui/GlassCard';
import { GlassInput } from './ui/GlassInput';
import { db } from '../services/mockDb';
import { BusinessSettings, AIConfig } from '../types';
import { generateCSV, generateSystemBackup } from '../services/utils';
import { loadAIConfig, saveAIConfig } from '../services/ai';
import {
  Save, Building, CheckCircle, Loader2,
  FileText, Image as ImageIcon,
  Database, Download, FileSpreadsheet,
  HardDrive, Activity, ShieldCheck, ShieldAlert,
  Trash2, Terminal, FileJson, Users, ShoppingCart, Package, Wallet,
  UploadCloud, RefreshCw, Smartphone
} from 'lucide-react';
import { WhatsAppBotUI } from './WhatsAppBotUI';
import { smsService } from '../services/smsService';

export const SettingsManager: React.FC = () => {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSettings();
    const config = loadAIConfig();
    setAiConfig(config);

    // Sync with backend persistent config
    window.electronAPI?.waGetBotConfig?.().then((botConfig: any) => {
      if (botConfig && botConfig.aiProvider) {
        setAiConfig(prev => prev ? ({ ...prev, provider: botConfig.aiProvider }) : null);
      }
    });
  }, []);

  const handleProviderChange = async (provider: string) => {
    if (!aiConfig) return;
    const newConfig = { ...aiConfig, provider: provider as any };
    setAiConfig(newConfig);
    saveAIConfig(newConfig);
    // Update background bot provider
    await window.electronAPI?.waSetBotProvider?.(provider);
  };

  const loadSettings = async () => {
    const s = await db.settings.get();
    setSettings(s);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setIsSaving(true);
    try {
      await db.settings.update(settings);
      if (aiConfig) saveAIConfig(aiConfig);

      // Save SMS Gateway config
      await smsService.saveConfig({
        url: settings.smsGatewayUrl || '',
        token: settings.smsGatewayToken || '',
        globalToken: settings.smsGatewayGlobalToken || ''
      });

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: settings }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReportDownload = async (type: 'SALES' | 'INVENTORY' | 'CUSTOMERS' | 'EXPENSES') => {
    setIsExporting(type);
    try {
      let data: any[] = [];
      let filename = '';

      switch (type) {
        case 'SALES':
          const bills = await db.bills.getAll(false);
          data = bills.map(b => ({
            Invoice: b.invoiceNumber,
            Date: new Date(b.date).toLocaleDateString(),
            Time: new Date(b.date).toLocaleTimeString(),
            Customer: b.customerName,
            Total: b.total,
            Profit: b.totalProfit,
            Status: b.paymentType,
            Items_Count: b.items.length
          }));
          filename = 'WR_Sales_Report';
          break;

        case 'INVENTORY':
          const products = await db.products.getAll();
          data = products.map(p => ({
            Name: p.name,
            Category: p.category,
            SKU: p.sku || '',
            Stock_Qty: p.stock,
            Unit_Cost: p.totalCost,
            Retail_Price: p.price,
            Total_Stock_Value: p.stock * p.price,
            Margin_Percent: p.marginValue + '%'
          }));
          filename = 'WR_Inventory_Report';
          break;

        case 'CUSTOMERS':
          const customers = await db.customers.getAll();
          data = customers.map(c => ({
            Name: c.name,
            Phone: c.phone,
            Address: c.address || '',
            Total_Purchased: c.totalPaid,
            Current_Debt: c.balanceDue,
            NIC: c.nic || ''
          }));
          filename = 'WR_Customer_Ledger';
          break;

        case 'EXPENSES':
          const expenses = await db.expenses.getAll();
          data = expenses.map(e => ({
            Date: new Date(e.date).toLocaleDateString(),
            Category: e.category,
            Amount: e.amount,
            Note: e.note
          }));
          filename = 'WR_Expense_Report';
          break;
      }

      if (data.length === 0) {
        alert("No data available for this report.");
      } else {
        generateCSV(data, filename);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
      }

    } catch (e: any) {
      console.error("Export Error:", e);
      alert("Failed to generate report: " + e.message);
    } finally {
      setIsExporting(null);
    }
  };

  const handleFullBackup = async () => {
    if (!confirm("Create a Full System Restore Point (JSON)?\n\nThis will download a file containing ALL your business data (Customers, Inventory, Bills, History).")) return;
    setIsBackingUp(true);
    try {
      // Use the new High-Speed Backup method
      const backup = await db.system.getBackupData();
      generateSystemBackup(backup);

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (e: any) {
      console.error("Backup failed", e);
      alert("System Backup Failed: " + e.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("CRITICAL WARNING: You are about to Restore Data.\n\nThis process will:\n1. Attempt to merge backup data with current data.\n2. Update existing records (e.g. stock counts).\n3. Restore missing bills/customers.\n\nAre you absolutely sure?")) {
      e.target.value = '';
      return;
    }

    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);

        if (!json.data) throw new Error("Invalid Backup File Structure.");

        // Use the new Smart Restore Engine
        await db.system.restoreBackupData(json);

        alert("System Restore Operation Completed Successfully.\n\nPage will now reload to reflect changes.");
        window.location.reload();
      } catch (err: any) {
        console.error("Restore Error", err);
        alert("Restore Failed: " + err.message);
      } finally {
        setIsRestoring(false);
        if (restoreInputRef.current) restoreInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const downloadBatchScript = (type: 'BACKUP' | 'CLEANUP') => {
    let content = '';
    let filename = '';

    if (type === 'BACKUP') {
      filename = 'daily_backup.bat';
      content = `@echo off
:: --- WR POS AUTO-BACKUP ---
SET PG_PATH=C:\\Program Files\\PostgreSQL\\16\\bin
SET DB_NAME=local_pos_db
SET DB_USER=postgres
SET BACKUP_PATH=C:\\Backups
SET PGPASSWORD=YourPasswordHere

:: --- Generate Filename with Date ---
SET FILENAME=pos_backup_%date:~10,4%-%date:~4,2%-%date:~7,2%.sql

if not exist "%BACKUP_PATH%" mkdir "%BACKUP_PATH%"

echo Backing up %DB_NAME% to %FILENAME%...
"%PG_PATH%\\pg_dump" -U %DB_USER% -f "%BACKUP_PATH%\\%FILENAME%" %DB_NAME%

echo Backup Complete!
timeout /t 5`;
    } else {
      filename = 'cleanup_backups.bat';
      content = `@echo off
:: --- WR POS BACKUP CLEANUP ---
SET BACKUP_PATH=C:\\Backups
SET DAYS_TO_KEEP=30

echo Cleaning backups older than %DAYS_TO_KEEP% days in %BACKUP_PATH%...
forfiles /p "%BACKUP_PATH%" /s /m *.sql /d -%DAYS_TO_KEEP% /c "cmd /c del @path"

echo Cleanup Complete! Disk space reclaimed.
timeout /t 5`;
    }

    const blob = new Blob([content], { type: 'application/x-bat' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!settings) return (
    <div className="flex flex-col items-center justify-center p-24 gap-4">
      <Loader2 className="animate-spin text-blue-500" size={32} />
      <div className="text-blue-500 font-black uppercase tracking-widest text-xs">Synchronizing Core...</div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto custom-scrollbar animate-in fade-in duration-700">
      <div className="max-w-5xl mx-auto space-y-8 p-4 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column - Branding & Status */}
          <div className="lg:col-span-4 space-y-6">
            <GlassCard className="border-blue-500/10 p-8 rounded-[2.5rem] bg-[#0b1121]/90">
              <div className="text-center mb-8">
                <div className="relative inline-block group cursor-pointer">
                  <div className="w-32 h-32 bg-white rounded-[2rem] mx-auto overflow-hidden border border-white/10 shadow-2xl relative">
                    <img
                      src={settings.logoUrl || "https://res.cloudinary.com/wrsmile/image/upload/v1765617036/wr_smile_supplies_products/yses6ycpqormspldap12.jpg"}
                      className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform duration-700"
                      alt="Business Logo"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ImageIcon className="text-white" size={24} />
                    </div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-blue-600 rounded-xl p-2 shadow-xl border border-white/10">
                    <ShieldCheck className="text-white" size={16} />
                  </div>
                </div>
                <h3 className="mt-6 text-lg font-black text-white uppercase tracking-tight">{settings.businessName}</h3>
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-1">Local Node Active</p>
              </div>

              <div className="space-y-3 pt-6 border-t border-white/5">
                <div className="flex items-center gap-4 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                  <HardDrive size={18} className="text-blue-400" />
                  <div>
                    <span className="text-[10px] font-black uppercase text-blue-400 block">Storage Mode</span>
                    <span className="text-[9px] text-blue-400/60 font-bold uppercase">Unlimited (Localhost)</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                  <Activity size={18} className="text-emerald-500" />
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-500 block">Database Latency</span>
                    <span className="text-[9px] text-emerald-500/60 font-bold uppercase">0.1ms (Direct)</span>
                  </div>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="border-orange-500/10 bg-gradient-to-br from-orange-600/5 to-transparent p-6 rounded-[2rem]">
              <div className="flex items-center gap-3 mb-4">
                <ShieldAlert size={20} className="text-orange-500" />
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Backup Policy</h3>
              </div>
              <p className="text-[11px] text-gray-500 font-medium uppercase leading-relaxed tracking-wider">
                You are responsible for daily backups. Use the automation scripts provided to schedule Windows Tasks.
              </p>
            </GlassCard>
          </div>

          {/* Right Column - Main Configuration */}
          <div className="lg:col-span-8 space-y-6">
            <GlassCard className="border-white/5 bg-[#0b1121]/60 p-8 md:p-10 rounded-[3rem] shadow-2xl">
              <form onSubmit={handleSave} className="space-y-10">

                {/* Section: Data Exports (EXCEL) - MOVED TO TOP */}
                <section className="space-y-6">
                  <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                    <div className="w-12 h-12 bg-emerald-600/20 text-emerald-500 rounded-xl flex items-center justify-center border border-emerald-500/10">
                      <FileSpreadsheet size={24} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white uppercase tracking-tight">Excel Data Center</h3>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Download Reports (View in Excel)</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => handleReportDownload('SALES')}
                      disabled={!!isExporting}
                      className="p-6 bg-blue-600/10 border border-blue-500/20 rounded-[2rem] flex items-center justify-between group hover:bg-blue-600 hover:text-white transition-all shadow-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform">
                          {isExporting === 'SALES' ? <Loader2 size={24} className="animate-spin" /> : <ShoppingCart size={24} />}
                        </div>
                        <div className="text-left">
                          <h4 className="text-sm font-black uppercase tracking-widest">Sales Report</h4>
                          <p className="text-[9px] font-bold opacity-60 mt-1">Full Sales History</p>
                        </div>
                      </div>
                      <Download size={20} className="opacity-50 group-hover:opacity-100" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReportDownload('INVENTORY')}
                      disabled={!!isExporting}
                      className="p-6 bg-purple-600/10 border border-purple-500/20 rounded-[2rem] flex items-center justify-between group hover:bg-purple-600 hover:text-white transition-all shadow-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform">
                          {isExporting === 'INVENTORY' ? <Loader2 size={24} className="animate-spin" /> : <Package size={24} />}
                        </div>
                        <div className="text-left">
                          <h4 className="text-sm font-black uppercase tracking-widest">Inventory Report</h4>
                          <p className="text-[9px] font-bold opacity-60 mt-1">Stock & Value</p>
                        </div>
                      </div>
                      <Download size={20} className="opacity-50 group-hover:opacity-100" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReportDownload('CUSTOMERS')}
                      disabled={!!isExporting}
                      className="p-6 bg-emerald-600/10 border border-emerald-500/20 rounded-[2rem] flex items-center justify-between group hover:bg-emerald-600 hover:text-white transition-all shadow-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform">
                          {isExporting === 'CUSTOMERS' ? <Loader2 size={24} className="animate-spin" /> : <Users size={24} />}
                        </div>
                        <div className="text-left">
                          <h4 className="text-sm font-black uppercase tracking-widest">Customer Ledger</h4>
                          <p className="text-[9px] font-bold opacity-60 mt-1">Clients & Debts</p>
                        </div>
                      </div>
                      <Download size={20} className="opacity-50 group-hover:opacity-100" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReportDownload('EXPENSES')}
                      disabled={!!isExporting}
                      className="p-6 bg-orange-600/10 border border-orange-500/20 rounded-[2rem] flex items-center justify-between group hover:bg-orange-600 hover:text-white transition-all shadow-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform">
                          {isExporting === 'EXPENSES' ? <Loader2 size={24} className="animate-spin" /> : <Wallet size={24} />}
                        </div>
                        <div className="text-left">
                          <h4 className="text-sm font-black uppercase tracking-widest">Expense Report</h4>
                          <p className="text-[9px] font-bold opacity-60 mt-1">Operational Costs</p>
                        </div>
                      </div>
                      <Download size={20} className="opacity-50 group-hover:opacity-100" />
                    </button>
                  </div>
                </section>

                {/* Section: Business Identity */}
                <section className="space-y-6">
                  <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                    <div className="w-12 h-12 bg-blue-600/20 text-blue-500 rounded-xl flex items-center justify-center border border-blue-500/10">
                      <Building size={24} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white uppercase tracking-tight">Identity & Reach</h3>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Public Terminal Branding</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <GlassInput label="Legal Business Name" value={settings.businessName} onChange={e => setSettings({ ...settings, businessName: e.target.value })} className="text-sm" />
                    <GlassInput label="Official Contact" value={settings.contactPhone} onChange={e => setSettings({ ...settings, contactPhone: e.target.value })} className="text-sm" />
                  </div>
                  <GlassInput label="Physical Headquarters Address" value={settings.address} onChange={e => setSettings({ ...settings, address: e.target.value })} className="text-sm" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <GlassInput label="Base ISO Currency" value={settings.currency} onChange={e => setSettings({ ...settings, currency: e.target.value })} className="text-sm" />
                    <GlassInput label="Branding Image (URL)" value={settings.logoUrl} onChange={e => setSettings({ ...settings, logoUrl: e.target.value })} className="text-sm" />
                  </div>
                </section>

                {/* Section: System Backups & Scripts */}
                <section className="space-y-6">
                  <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                    <div className="w-12 h-12 bg-gray-600/20 text-gray-400 rounded-xl flex items-center justify-center border border-gray-500/10">
                      <Database size={24} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white uppercase tracking-tight">System Restoration</h3>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Technical Backups & Maintenance</p>
                    </div>
                  </div>

                  {/* Backup & Restore Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <button
                      type="button"
                      onClick={handleFullBackup}
                      disabled={isBackingUp}
                      className="p-4 bg-white/5 border border-white/10 rounded-[1.5rem] flex items-center gap-4 hover:bg-white/10 transition-all group text-left"
                    >
                      <div className="w-10 h-10 bg-gray-600/20 text-gray-400 rounded-xl flex items-center justify-center border border-gray-500/10">
                        {isBackingUp ? <Loader2 size={18} className="animate-spin" /> : <FileJson size={18} />}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Download Backup</h4>
                        <p className="text-[8px] text-gray-500 font-medium mt-0.5">Save system state to file</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => restoreInputRef.current?.click()}
                      disabled={isRestoring}
                      className="p-4 bg-red-600/5 border border-red-500/10 rounded-[1.5rem] flex items-center gap-4 hover:bg-red-600/10 transition-all group text-left"
                    >
                      <div className="w-10 h-10 bg-red-600/20 text-red-400 rounded-xl flex items-center justify-center border border-red-500/20">
                        {isRestoring ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-red-400 uppercase tracking-widest">Restore Data</h4>
                        <p className="text-[8px] text-red-500/50 font-medium mt-0.5">Upload JSON Backup File</p>
                      </div>
                    </button>
                    <input
                      type="file"
                      ref={restoreInputRef}
                      className="hidden"
                      accept=".json"
                      onChange={handleRestoreFile}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => downloadBatchScript('BACKUP')}
                      className="p-4 bg-white/5 border border-white/5 rounded-[1.5rem] flex flex-col items-center text-center gap-3 hover:bg-white/10 hover:border-white/10 transition-all group"
                    >
                      <div className="w-10 h-10 bg-gray-700/20 text-gray-400 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Terminal size={18} />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Backup Script (.bat)</h4>
                        <p className="text-[8px] text-gray-600 font-medium mt-1">For IT Admin / Task Scheduler</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadBatchScript('CLEANUP')}
                      className="p-4 bg-white/5 border border-white/5 rounded-[1.5rem] flex flex-col items-center text-center gap-3 hover:bg-white/10 hover:border-white/10 transition-all group"
                    >
                      <div className="w-10 h-10 bg-orange-600/20 text-orange-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Trash2 size={18} />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Cleanup Script (.bat)</h4>
                        <p className="text-[8px] text-gray-600 font-medium mt-1">Auto-delete old backups</p>
                      </div>
                    </button>
                  </div>
                </section>

                {/* Section: WhatsApp Cloud API */}
                <section className="space-y-6">
                  <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                    <div className="w-12 h-12 bg-blue-600/20 text-blue-500 rounded-xl flex items-center justify-center border border-blue-500/10">
                      <Smartphone size={24} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white uppercase tracking-tight">WhatsApp Cloud API</h3>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Official Business Integration</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <GlassInput
                      label="Cloud API Access Token"
                      type="password"
                      value={settings.waAccessToken || ''}
                      onChange={e => setSettings({ ...settings, waAccessToken: e.target.value })}
                      className="text-sm"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <GlassInput
                        label="Phone Number ID"
                        value={settings.waPhoneNumberId || ''}
                        onChange={e => setSettings({ ...settings, waPhoneNumberId: e.target.value })}
                        className="text-sm"
                      />
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await (await import('../services/whatsapp')).whatsappService.verifyConnection(settings);
                            alert(ok ? "WhatsApp Connection Success! Test message sent." : "WhatsApp Connection Failed. Check credentials.");
                          }}
                          className="w-full py-3.5 bg-blue-600/10 border border-blue-500/30 text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all"
                        >
                          Test Cloud API
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-6">
                  <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                    <div className="w-12 h-12 bg-emerald-600/20 text-emerald-500 rounded-xl flex items-center justify-center border border-emerald-500/10">
                      <Smartphone size={24} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white uppercase tracking-tight">AI WhatsApp Assistant</h3>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Connect your mobile for AI Chat</p>
                    </div>
                  </div>
                  <WhatsAppBotUI />
                </section>

                {/* Section: Traccar SMS Gateway */}
                <section className="space-y-6">
                  <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                    <div className="w-12 h-12 bg-amber-600/20 text-amber-500 rounded-xl flex items-center justify-center border border-amber-500/10">
                      <Smartphone size={24} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white uppercase tracking-tight">Traccar SMS Gateway</h3>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Global & Local SMS Integration</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <GlassInput
                      label="Gateway Endpoint (URL)"
                      placeholder="http://192.168.8.149:8082"
                      value={settings.smsGatewayUrl || ''}
                      onChange={e => setSettings({ ...settings, smsGatewayUrl: e.target.value })}
                      className="text-sm"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <GlassInput
                        label="Local Access Token"
                        type="password"
                        value={settings.smsGatewayToken || ''}
                        onChange={e => setSettings({ ...settings, smsGatewayToken: e.target.value })}
                        className="text-sm"
                      />
                      <GlassInput
                        label="Global Token (FCM)"
                        type="password"
                        value={settings.smsGatewayGlobalToken || ''}
                        onChange={e => setSettings({ ...settings, smsGatewayGlobalToken: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await smsService.verifyConnection(settings);
                          alert(ok ? "SMS Gateway Connection Success! Test message sent." : "SMS Gateway Connection Failed. Check credentials/URL.");
                        }}
                        className="w-full md:w-auto px-8 py-3.5 bg-amber-600/10 border border-amber-500/30 text-amber-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 hover:text-white transition-all"
                      >
                        Test SMS Gateway
                      </button>
                    </div>
                  </div>
                </section>

                {/* Section: AI Intelligence (New) */}
                <section className="space-y-6">
                  <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                    <div className="w-12 h-12 bg-purple-600/20 text-purple-500 rounded-xl flex items-center justify-center border border-purple-500/10">
                      <Terminal size={24} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white uppercase tracking-tight">AI Intelligence Core</h3>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Configure Brain Power</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest ml-1">AI Provider</label>
                      <select
                        value={aiConfig?.provider || 'gemini'}
                        onChange={e => handleProviderChange(e.target.value)}
                        className="w-full bg-[#0b1121] border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                      >
                        <option value="gemini">Google Gemini (Cloud)</option>
                        <option value="local-phi">Local Phi-3 (Ollama)</option>
                        <option value="ollama-cloud">Ollama Cloud (ollama.com)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest ml-1">Model Name</label>
                      <div className="relative">
                        <input
                          type="text"
                          list="ai-models"
                          placeholder={'default'}
                          value={aiConfig?.model || ''}
                          onChange={e => setAiConfig(prev => prev ? ({ ...prev, model: e.target.value }) : null)}
                          className="w-full bg-[#0b1121] border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        <datalist id="ai-models">

                          <option value="gpt-oss:120b-cloud" />
                        </datalist>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] text-gray-500 font-bold uppercase">
                          CUSTOMIZABLE
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                    <p className="text-[10px] text-blue-400">
                      <strong>Note:</strong> AI Settings are saved locally on this device. All providers are cloud-based web services. Set API keys in your .env file.
                    </p>
                  </div>
                </section>

                {/* Action Bar */}
                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-3 h-10">
                    {showSuccess && (
                      <div className="text-emerald-400 text-xs font-black uppercase animate-in slide-in-from-left-4 flex items-center gap-2">
                        <CheckCircle size={18} /> Operation Successful
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full md:w-auto px-16 py-4 rounded-2xl bg-blue-600 text-white uppercase text-xs font-black tracking-[0.3em] shadow-2xl shadow-blue-600/30 active:scale-95 hover:bg-blue-500 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}
                    {isSaving ? 'APPLYING...' : 'COMMIT CHANGES'}
                  </button>
                </div>
              </form>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
};
