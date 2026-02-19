
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/mockDb';
import { Customer, Bill } from '../types';
import { cleanPhone } from '../services/utils';
import { GlassCard } from './ui/GlassCard';
import { generateAiContent } from '../services/ai';
import {
   Send, Users, MessageSquare, Sparkles, Zap, CheckCircle2,
   Loader2, Filter, Trash2, Search, ArrowRight, UserCheck,
   Target, Award, AlertCircle, Wand2, Play, Pause, SkipForward, X,
   History, Bookmark, Save, Clock, Calendar, Phone, FileText,
   Briefcase, Star, TrendingUp, ChevronRight, AlertTriangle
} from 'lucide-react';
import { whatsappService } from '../services/whatsapp';
import { BusinessSettings } from '../types';

interface QueueItem {
   id: string;
   name: string;
   phone: string;
   message: string;
   status: 'PENDING' | 'SENT' | 'SKIPPED';
}

interface Template {
   id: string;
   name: string;
   content: string;
   category: 'Recovery' | 'Promo' | 'Update';
}

interface CampaignLog {
   id: string;
   date: string;
   message: string;
   targetCount: number;
   segment: string;
}

interface CRMNote {
   id: string;
   customerId: string;
   type: 'CALL' | 'NOTE' | 'MEETING';
   content: string;
   date: string;
}

const DEFAULT_TEMPLATES: Template[] = [
   { id: 't1', name: 'Gentle Reminder', category: 'Recovery', content: "Hi {name}, friendly reminder that your balance of LKR {balance} is due. Please settle via bank transfer to BOC: 95733864 or HNB: 174020112495 (N K W Khan). Join our updates: https://chat.whatsapp.com/K7ALigMk9ad4SBlcRUqoxX?mode=wwt" },
   { id: 't2', name: 'VIP Exclusive', category: 'Promo', content: "Hello {name}! As a valued VIP, we have a special offer waiting for you at the store. Show this text for 5% off!" },
   { id: 't3', name: 'Stock Update', category: 'Update', content: "Hi {name}, new arrivals are here! Check out our latest collection this weekend." }
];

export const MarketingHub: React.FC = () => {
   const [customers, setCustomers] = useState<Customer[]>([]);
   const [bills, setBills] = useState<Bill[]>([]);
   const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
   const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);

   const [message, setMessage] = useState('');
   const [isGenerating, setIsGenerating] = useState(false);
   const [search, setSearch] = useState('');
   const [filterType, setFilterType] = useState<'all' | 'debt' | 'loyal' | 'dormant'>('all');
   const [activeTab, setActiveTab] = useState<'directory' | 'history'>('directory');
   const [settings, setSettings] = useState<BusinessSettings | null>(null);
   const [transmissionLogs, setTransmissionLogs] = useState<{ name: string, status: 'ok' | 'fail', time: string }[]>([]);

   // Campaign State
   const [isCampaignActive, setIsCampaignActive] = useState(false);
   const [campaignQueue, setCampaignQueue] = useState<QueueItem[]>([]);
   const [currentIndex, setCurrentIndex] = useState(0);
   const [autoPlay, setAutoPlay] = useState(false);

   // Extras & CRM
   const [showTemplates, setShowTemplates] = useState(false);
   const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
   const [history, setHistory] = useState<CampaignLog[]>([]);
   const [crmNotes, setCrmNotes] = useState<CRMNote[]>([]);
   const [newNote, setNewNote] = useState('');

   useEffect(() => {
      loadData();
      const savedTemplates = localStorage.getItem('wr_pos_templates');
      if (savedTemplates) setTemplates(JSON.parse(savedTemplates));

      const savedHistory = localStorage.getItem('wr_pos_campaign_history');
      if (savedHistory) setHistory(JSON.parse(savedHistory));

      const savedNotes = localStorage.getItem('wr_pos_crm_notes');
      if (savedNotes) setCrmNotes(JSON.parse(savedNotes));

      db.settings.get().then(setSettings);
   }, []);

   // Auto-play effect
   useEffect(() => {
      let timer: ReturnType<typeof setTimeout>;
      if (isCampaignActive && autoPlay && currentIndex < campaignQueue.length) {
         timer = setTimeout(() => {
            handleSendCurrent();
         }, 2500);
      }
      return () => clearTimeout(timer);
   }, [isCampaignActive, autoPlay, currentIndex, campaignQueue]);

   const loadData = async () => {
      const [allCustomers, allBills] = await Promise.all([
         db.customers.getAll(),
         db.bills.getAll()
      ]);
      setCustomers(allCustomers);
      setBills(allBills);
   };

   const getLastSeen = (customerId: string) => {
      const customerBills = bills.filter(b => b.customerId === customerId && !b.archived);
      if (!customerBills.length) return null;
      return customerBills.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date;
   };

   const getEngagementScore = (c: Customer) => {
      // 0-100 score based on totalPaid and Recency
      let score = 0;
      const maxPaid = 200000; // Benchmark
      score += Math.min((c.totalPaid / maxPaid) * 60, 60); // Up to 60 pts for volume

      const lastSeen = getLastSeen(c.id);
      if (lastSeen) {
         const daysAgo = (Date.now() - new Date(lastSeen).getTime()) / (1000 * 3600 * 24);
         if (daysAgo < 30) score += 40;
         else if (daysAgo < 60) score += 20;
         else if (daysAgo < 90) score += 10;
      }
      return Math.round(score);
   };

   const filteredCustomers = useMemo(() => {
      return customers.filter(c => {
         const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search);
         const lastSeen = getLastSeen(c.id);
         const isDormant = lastSeen ? (new Date().getTime() - new Date(lastSeen).getTime()) > (30 * 24 * 60 * 60 * 1000) : true;

         const matchesFilter =
            filterType === 'all' ? true :
               filterType === 'debt' ? c.balanceDue > 0 :
                  filterType === 'loyal' ? c.totalPaid > 50000 :
                     filterType === 'dormant' ? isDormant : true;

         return matchesSearch && matchesFilter;
      }).sort((a, b) => getEngagementScore(b) - getEngagementScore(a)); // Sort by score
   }, [customers, search, filterType, bills]);

   const targetedValue = useMemo(() => {
      const targets = customers.filter(c => selectedIds.has(c.id));
      if (filterType === 'debt') return targets.reduce((sum, c) => sum + c.balanceDue, 0);
      return targets.reduce((sum, c) => sum + c.totalPaid, 0);
   }, [customers, selectedIds, filterType]);

   const handleSelectAll = () => {
      if (selectedIds.size === filteredCustomers.length) {
         setSelectedIds(new Set());
      } else {
         setSelectedIds(new Set(filteredCustomers.map(c => c.id)));
      }
      setActiveCustomerId(null); // Clear focus when selecting multiple
   };

   const handleToggle = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedIds(next);

      // If only one selected, maybe set active? No, let's keep click-to-focus separate.
      if (next.size > 1) setActiveCustomerId(null);
   };

   const handleRowClick = (id: string) => {
      setActiveCustomerId(id);
      // Optional: Clear multi-selection if focusing on one
      // setSelectedIds(new Set()); 
   };

   const addCrmNote = (type: 'CALL' | 'NOTE') => {
      if (!activeCustomerId || !newNote) return;
      const note: CRMNote = {
         id: Date.now().toString(),
         customerId: activeCustomerId,
         type,
         content: newNote,
         date: new Date().toISOString()
      };
      const updated = [note, ...crmNotes];
      setCrmNotes(updated);
      localStorage.setItem('wr_pos_crm_notes', JSON.stringify(updated));
      setNewNote('');
   };

   // ... (Keep existing Campaign Functions: handleAiDraft, prepareCampaign, handleSendCurrent etc.)
   const handleAiDraft = async () => {
      setIsGenerating(true);
      try {
         const promptMap = {
            'debt': "Write a professional, polite, yet firm WhatsApp message (under 30 words) reminding a customer named '{name}' about their pending balance of '{balance}'. Include a call to action to settle. Do not include placeholders other than {name} and {balance}.",
            'loyal': "Write a warm, appreciative WhatsApp message (under 30 words) to a loyal customer named '{name}'. Thank them for their continued business volume of '{balance}' and mention they are a valued VIP.",
            'all': "Write a generic seasonal sale announcement WhatsApp message (under 30 words) for a customer named '{name}'. Use emojis.",
            'dormant': "Write a 'We miss you' WhatsApp message (under 30 words) for a customer named '{name}' who hasn't visited in a while. Offer a small incentive to return."
         };

         const prompt = promptMap[filterType] || promptMap['all'];
         const text = await generateAiContent(prompt);
         setMessage(text.replace(/"/g, ''));
      } catch (e) {
         console.error(e);
      } finally {
         setIsGenerating(false);
      }
   };

   const prepareCampaign = () => {
      if (selectedIds.size === 0 || !message) return;
      const queue: QueueItem[] = Array.from(selectedIds).map(id => {
         const c = customers.find(cust => cust.id === id);
         if (!c) return null;
         return {
            id: c.id,
            name: c.name,
            phone: cleanPhone(c.phone),
            message: message.replace(/{name}/gi, c.name).replace(/{balance}/gi, c.balanceDue.toLocaleString()),
            status: 'PENDING'
         };
      }).filter(Boolean) as QueueItem[];
      setCampaignQueue(queue);
      setTransmissionLogs([]);
      setCurrentIndex(0);
      setIsCampaignActive(true);
      setAutoPlay(false);
   };

   const handleSendCurrent = async () => {
      if (currentIndex >= campaignQueue.length || !settings) return;
      const item = campaignQueue[currentIndex];

      try {
         await whatsappService.sendDirect(settings, item.phone, item.message);
         setTransmissionLogs(prev => [{ name: item.name, status: 'ok' as const, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
         setCampaignQueue(prev => { const next = [...prev]; next[currentIndex].status = 'SENT'; return next; });
      } catch (e) {
         console.error("Failed to dispatch message:", e);
         setTransmissionLogs(prev => [{ name: item.name, status: 'fail' as const, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
         setCampaignQueue(prev => { const next = [...prev]; next[currentIndex].status = 'SKIPPED'; return next; });
      }

      setCurrentIndex(prev => prev + 1);
   };

   const handleSkipCurrent = () => {
      if (currentIndex >= campaignQueue.length) return;
      setCampaignQueue(prev => { const next = [...prev]; next[currentIndex].status = 'SKIPPED'; return next; });
      setCurrentIndex(prev => prev + 1);
   };

   const closeCampaign = () => {
      const sentCount = campaignQueue.filter(i => i.status === 'SENT').length;
      if (sentCount > 0) {
         const newLog: CampaignLog = { id: Date.now().toString(), date: new Date().toISOString(), message: message, targetCount: sentCount, segment: filterType };
         const updatedHistory = [newLog, ...history];
         setHistory(updatedHistory);
         localStorage.setItem('wr_pos_campaign_history', JSON.stringify(updatedHistory));
      }
      setIsCampaignActive(false);
      setCampaignQueue([]);
      setCurrentIndex(0);
      setAutoPlay(false);
      setSelectedIds(new Set());
   };

   const saveTemplate = () => {
      if (!message) return;
      const name = prompt("Template Name:");
      if (name) {
         const newT: Template = { id: Date.now().toString(), name, content: message, category: 'Promo' };
         const updated = [...templates, newT];
         setTemplates(updated);
         localStorage.setItem('wr_pos_templates', JSON.stringify(updated));
      }
   };

   const completedCount = campaignQueue.filter(i => i.status !== 'PENDING').length;
   const progress = campaignQueue.length > 0 ? (completedCount / campaignQueue.length) * 100 : 0;

   // Active Customer for Focus Mode
   const activeCustomer = activeCustomerId ? customers.find(c => c.id === activeCustomerId) : null;

   return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-700 h-full min-h-0 relative">

         {/* Campaign Overlay - Same as before */}
         {isCampaignActive && (
            <div className="absolute inset-0 z-[100] bg-[#0b1121]/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in zoom-in-95 duration-300">
               {/* ... (Existing Campaign UI) ... */}
               <GlassCard className="w-full max-w-2xl bg-black/40 border-2 border-white/10 p-8 rounded-[3rem] shadow-3xl flex flex-col h-[600px]">
                  <div className="flex justify-between items-center mb-8 shrink-0">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 animate-pulse">
                           <Zap size={24} className="text-white" />
                        </div>
                        <div>
                           <h3 className="text-lg font-black text-white uppercase tracking-tight">Power Broadcaster</h3>
                           <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                              Target {currentIndex + 1} of {campaignQueue.length}
                           </p>
                        </div>
                     </div>
                     <button onClick={closeCampaign} className="p-3 bg-white/5 text-gray-500 hover:text-white rounded-xl transition-all">
                        <X size={20} />
                     </button>
                  </div>

                  {currentIndex < campaignQueue.length ? (
                     <div className="flex-1 flex flex-col items-center justify-center space-y-8 text-center relative">
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden absolute top-0">
                           <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>

                        <div className="space-y-2">
                           <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full mx-auto flex items-center justify-center text-2xl font-black text-white shadow-2xl mb-4">
                              {campaignQueue[currentIndex].name.charAt(0)}
                           </div>
                           <h2 className="text-3xl font-black text-white uppercase tracking-tight">{campaignQueue[currentIndex].name}</h2>
                           <p className="text-sm font-bold text-gray-500 font-mono tracking-widest">{campaignQueue[currentIndex].phone}</p>
                        </div>

                        <div className="w-full bg-white/5 border border-white/5 rounded-2xl p-6 text-left relative overflow-hidden group">
                           <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Payload Preview</p>
                           <p className="text-sm font-medium text-gray-300 leading-relaxed whitespace-pre-wrap">
                              {campaignQueue[currentIndex].message}
                           </p>
                        </div>

                        <div className="flex items-center gap-4 w-full">
                           <button onClick={handleSkipCurrent} className="p-4 bg-white/5 text-gray-500 hover:text-white rounded-2xl border border-white/5 transition-all">
                              <SkipForward size={24} />
                           </button>
                           <button
                              onClick={handleSendCurrent}
                              className="flex-1 py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl text-sm font-black uppercase tracking-[0.3em] shadow-2xl shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                           >
                              <Send size={20} /> DISPATCH
                           </button>
                           <button
                              onClick={() => setAutoPlay(!autoPlay)}
                              className={`p-4 rounded-2xl border transition-all ${autoPlay ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' : 'bg-white/5 text-gray-500 border-white/5'}`}
                           >
                              {autoPlay ? <Pause size={24} /> : <Play size={24} />}
                           </button>
                        </div>

                        {/* Transmission Logs */}
                        <div className="w-full mt-4 flex-1 min-h-0 flex flex-col">
                           <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 flex justify-between">
                              <span>Transmission Log</span>
                              {autoPlay && <span className="text-blue-400 animate-pulse">Auto-Relay Active</span>}
                           </p>
                           <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                              {transmissionLogs.length === 0 ? (
                                 <p className="text-[9px] text-gray-700 text-center mt-10 italic">Awaiting first dispatch...</p>
                              ) : (
                                 transmissionLogs.map((log, i) => (
                                    <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5 animate-in slide-in-from-bottom-2 duration-300">
                                       <div className="flex items-center gap-3">
                                          {log.status === 'ok' ? (
                                             <div className="w-6 h-6 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-500"><CheckCircle2 size={14} /></div>
                                          ) : (
                                             <div className="w-6 h-6 bg-red-500/20 rounded-lg flex items-center justify-center text-red-500"><AlertTriangle size={14} /></div>
                                          )}
                                          <span className="text-[10px] font-bold text-white uppercase">{log.name}</span>
                                       </div>
                                       <div className="text-right">
                                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${log.status === 'ok' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                             {log.status === 'ok' ? 'Delivered' : 'Failed'}
                                          </span>
                                          <p className="text-[7px] text-gray-600 mt-0.5">{log.time}</p>
                                       </div>
                                    </div>
                                 ))
                              )}
                           </div>
                        </div>
                     </div>
                  ) : (
                     <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-3xl animate-bounce">
                           <CheckCircle2 size={48} className="text-white" />
                        </div>
                        <div>
                           <h2 className="text-3xl font-black text-white uppercase tracking-tight">Campaign Complete</h2>
                           <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-2">{campaignQueue.length} Messages Processed</p>
                        </div>
                        <button onClick={closeCampaign} className="px-10 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-xs font-black uppercase tracking-widest">
                           Return to Hub
                        </button>
                     </div>
                  )}
               </GlassCard>
            </div>
         )}

         {/* Left Panel: Directory & History */}
         <div className="lg:col-span-8 flex flex-col h-[calc(100vh-160px)]">
            <GlassCard className="bg-[#0b1121]/40 border-white/5 flex flex-col h-full p-0 overflow-hidden">
               <div className="p-6 border-b border-white/5 bg-black/20 shrink-0">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600/10 text-blue-500 rounded-2xl flex items-center justify-center border border-blue-500/10">
                           <Users size={24} />
                        </div>
                        <div>
                           <h3 className="text-sm font-black text-white uppercase tracking-widest">Sprout CRM</h3>
                           <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                              {activeTab === 'directory' ? `${filteredCustomers.length} Leads Found` : `${history.length} Past Campaigns`}
                           </p>
                        </div>
                     </div>
                     <div className="flex gap-2 bg-black/40 p-1 rounded-xl border border-white/10">
                        <button onClick={() => setActiveTab('directory')} className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'directory' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>
                           <Users size={12} /> Leads
                        </button>
                        <button onClick={() => setActiveTab('history')} className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-white'}`}>
                           <History size={12} /> Logs
                        </button>
                     </div>
                  </div>

                  {activeTab === 'directory' && (
                     <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700" size={14} />
                           <input
                              className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-[10px] font-black text-white uppercase tracking-widest outline-none focus:border-blue-500 transition-all placeholder-gray-800"
                              placeholder="SEARCH DATABASE..."
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                           />
                        </div>
                        <div className="flex gap-1 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
                           {['all', 'debt', 'loyal', 'dormant'].map(type => (
                              <button
                                 key={type}
                                 onClick={() => setFilterType(type as any)}
                                 className={`px-4 py-2.5 rounded-xl text-[8px] font-black uppercase transition-all border ${filterType === type ? 'bg-blue-600 text-white border-blue-500' : 'bg-white/5 text-gray-500 border-white/5 hover:border-white/20'}`}
                              >
                                 {type}
                              </button>
                           ))}
                        </div>
                     </div>
                  )}
               </div>

               <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-2">
                  {activeTab === 'directory' ? (
                     <>
                        <div className="flex justify-between items-center px-4 mb-2">
                           <div className="flex items-center gap-4">
                              <button onClick={handleSelectAll} className="text-[10px] font-black text-blue-400 uppercase tracking-widest hover:text-white transition-colors">
                                 {selectedIds.size === filteredCustomers.length && filteredCustomers.length > 0 ? 'Deselect All' : 'Select Visible'}
                              </button>
                              {selectedIds.size > 0 && <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded">{selectedIds.size} For Bulk Action</span>}
                           </div>
                           <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Select checkbox to blast • Click card for details</span>
                        </div>
                        {filteredCustomers.map(c => {
                           const lastSeen = getLastSeen(c.id);
                           const daysSince = lastSeen ? Math.floor((new Date().getTime() - new Date(lastSeen).getTime()) / (1000 * 3600 * 24)) : null;
                           const score = getEngagementScore(c);

                           return (
                              <div
                                 key={c.id}
                                 onClick={() => handleRowClick(c.id)}
                                 className={`p-4 rounded-2xl border transition-all flex justify-between items-center group relative overflow-hidden cursor-pointer ${activeCustomerId === c.id ? 'bg-white/10 border-blue-500 shadow-xl' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}
                              >
                                 {/* Selection Checkbox */}
                                 <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center z-10" onClick={(e) => handleToggle(c.id, e)}>
                                    <div className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${selectedIds.has(c.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-600 hover:border-white'}`}>
                                       {selectedIds.has(c.id) && <CheckCircle2 size={10} className="text-white" />}
                                    </div>
                                 </div>

                                 <div className="flex items-center gap-4 pl-10">
                                    <div className="relative">
                                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-colors ${selectedIds.has(c.id) ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-500'}`}>
                                          {c.name.charAt(0)}
                                       </div>
                                       {/* Score Ring */}
                                       <svg className="absolute -inset-1 w-12 h-12 rotate-[-90deg]" viewBox="0 0 36 36">
                                          <path className="text-gray-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" />
                                          <path className={`${score > 70 ? 'text-emerald-500' : score > 40 ? 'text-yellow-500' : 'text-red-500'}`} strokeDasharray={`${score}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" />
                                       </svg>
                                    </div>
                                    <div>
                                       <p className="text-[11px] font-black text-white uppercase flex items-center gap-2">
                                          {c.name}
                                          {c.totalPaid > 50000 && <Award size={12} className="text-yellow-500" />}
                                       </p>
                                       <div className="flex items-center gap-2 mt-0.5">
                                          <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">{c.phone}</p>
                                          {daysSince !== null && daysSince > 30 && <span className="text-[7px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded uppercase font-black">Dormant {daysSince}d</span>}
                                       </div>
                                    </div>
                                 </div>
                                 <div className="text-right pr-4">
                                    {c.balanceDue > 0 && <p className="text-[9px] font-black text-red-400 uppercase tracking-tighter">Due: LKR {c.balanceDue.toLocaleString()}</p>}
                                    <div className="flex items-center justify-end gap-2 mt-1">
                                       <span className="text-[8px] text-gray-700 font-black uppercase">Vol: {c.totalPaid.toLocaleString()}</span>
                                       {activeCustomerId === c.id && <ChevronRight size={14} className="text-blue-500 animate-pulse" />}
                                    </div>
                                 </div>
                              </div>
                           )
                        })}
                     </>
                  ) : (
                     <div className="space-y-4">
                        {history.length === 0 ? (
                           <div className="text-center py-20 text-gray-600">
                              <History size={48} className="mx-auto mb-4 opacity-20" />
                              <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Campaign History</p>
                           </div>
                        ) : (
                           history.map(log => (
                              <div key={log.id} className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-3">
                                 <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                       <div className="p-2 bg-emerald-600/10 text-emerald-500 rounded-lg">
                                          <CheckCircle2 size={16} />
                                       </div>
                                       <div>
                                          <p className="text-[10px] font-black text-white uppercase tracking-widest">Batch #{log.id.slice(-6)}</p>
                                          <p className="text-[8px] text-gray-500 font-bold uppercase">{new Date(log.date).toLocaleString()} • Segment: {log.segment}</p>
                                       </div>
                                    </div>
                                    <span className="px-3 py-1 bg-blue-600/10 text-blue-400 rounded-lg text-[9px] font-black uppercase">
                                       {log.targetCount} Sent
                                    </span>
                                 </div>
                                 <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-[10px] text-gray-400 italic">
                                    "{log.message}"
                                 </div>
                              </div>
                           ))
                        )}
                     </div>
                  )}
               </div>
            </GlassCard>
         </div>

         {/* Right Panel: Hybrid (Campaign Composer OR CRM Profile) */}
         <div className="lg:col-span-4 space-y-6 flex flex-col h-[calc(100vh-160px)]">
            {activeCustomer ? (
               // INDIVIDUAL CRM MODE
               <GlassCard className="bg-[#0b1121]/90 p-8 rounded-[2.5rem] border-white/5 shadow-2xl flex-1 flex flex-col min-h-0 animate-in slide-in-from-right duration-300">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] flex items-center gap-2">
                        <Target size={14} /> CRM Focus Mode
                     </h3>
                     <button onClick={() => setActiveCustomerId(null)} className="p-2 bg-white/5 rounded-lg text-gray-500 hover:text-white"><X size={14} /></button>
                  </div>

                  <div className="text-center mb-8">
                     <div className="w-20 h-20 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-2xl font-black text-white shadow-xl shadow-blue-600/20 mb-4">
                        {activeCustomer.name.charAt(0)}
                     </div>
                     <h2 className="text-xl font-black text-white uppercase tracking-tight">{activeCustomer.name}</h2>
                     <p className="text-[10px] text-gray-500 font-bold font-mono tracking-widest mt-1">{activeCustomer.phone}</p>

                     <div className="flex justify-center gap-3 mt-4">
                        <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                           <p className="text-[7px] font-black text-gray-600 uppercase">Lifetime Value</p>
                           <p className="text-xs font-black text-emerald-400 font-mono">LKR {activeCustomer.totalPaid.toLocaleString()}</p>
                        </div>
                        <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                           <p className="text-[7px] font-black text-gray-600 uppercase">Debt Risk</p>
                           <p className={`text-xs font-black font-mono ${activeCustomer.balanceDue > 0 ? 'text-red-400' : 'text-gray-400'}`}>LKR {activeCustomer.balanceDue.toLocaleString()}</p>
                        </div>
                     </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1">
                     {/* Actions */}
                     <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => addCrmNote('CALL')} className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl text-[9px] font-black text-blue-400 uppercase hover:bg-blue-600 hover:text-white transition-all flex flex-col items-center gap-1">
                           <Phone size={16} /> Log Call
                        </button>
                        <button onClick={() => window.open(`https://api.whatsapp.com/send?phone=${cleanPhone(activeCustomer.phone)}`, '_blank')} className="p-3 bg-emerald-600/10 border border-emerald-500/20 rounded-xl text-[9px] font-black text-emerald-400 uppercase hover:bg-emerald-600 hover:text-white transition-all flex flex-col items-center gap-1">
                           <MessageSquare size={16} /> WhatsApp
                        </button>
                     </div>

                     {/* Quick Note Input */}
                     <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <textarea
                           className="w-full bg-transparent text-[10px] text-gray-300 outline-none placeholder-gray-600 resize-none min-h-[60px]"
                           placeholder="Add internal note or meeting summary..."
                           value={newNote}
                           onChange={(e) => setNewNote(e.target.value)}
                           onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addCrmNote('NOTE'); } }}
                        />
                        <div className="flex justify-end mt-2">
                           <button onClick={() => addCrmNote('NOTE')} disabled={!newNote} className="text-[8px] font-black text-blue-400 uppercase hover:text-white flex items-center gap-1">
                              <Save size={10} /> Save Note
                           </button>
                        </div>
                     </div>

                     {/* Activity Log */}
                     <div>
                        <h4 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Activity Timeline</h4>
                        <div className="space-y-3">
                           {crmNotes.filter(n => n.customerId === activeCustomer.id).length === 0 && (
                              <p className="text-[9px] text-gray-600 italic text-center py-4">No recent interactions logged.</p>
                           )}
                           {crmNotes.filter(n => n.customerId === activeCustomer.id).map(note => (
                              <div key={note.id} className="flex gap-3">
                                 <div className="flex flex-col items-center">
                                    <div className={`w-2 h-2 rounded-full ${note.type === 'CALL' ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
                                    <div className="w-px h-full bg-white/5 my-1"></div>
                                 </div>
                                 <div className="pb-4">
                                    <p className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">{note.type} • {new Date(note.date).toLocaleDateString()}</p>
                                    <p className="text-[10px] text-gray-300 leading-snug">{note.content}</p>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </GlassCard>
            ) : (
               // BULK CAMPAIGN MODE (Default)
               <GlassCard className="bg-[#0b1121]/90 p-8 rounded-[2.5rem] border-white/5 shadow-2xl flex-1 flex flex-col min-h-0 relative overflow-hidden">
                  {/* Template Drawer */}
                  {showTemplates && (
                     <div className="absolute inset-0 z-20 bg-[#0b1121] p-6 animate-in slide-in-from-right flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                           <h3 className="text-xs font-black text-white uppercase tracking-[0.3em] flex items-center gap-2">
                              <Bookmark size={14} className="text-purple-500" /> Templates
                           </h3>
                           <button onClick={() => setShowTemplates(false)} className="p-2 bg-white/5 text-gray-500 hover:text-white rounded-lg"><X size={16} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                           {templates.map(t => (
                              <div key={t.id} onClick={() => { setMessage(t.content); setShowTemplates(false); }} className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 cursor-pointer transition-all group">
                                 <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-black text-white uppercase">{t.name}</span>
                                    <span className="text-[8px] font-bold text-purple-400 uppercase bg-purple-500/10 px-2 py-0.5 rounded">{t.category}</span>
                                 </div>
                                 <p className="text-[9px] text-gray-500 line-clamp-2">{t.content}</p>
                              </div>
                           ))}
                        </div>
                     </div>
                  )}

                  <div className="flex items-center gap-4 mb-8 shrink-0">
                     <div className="w-10 h-10 bg-emerald-600/10 text-emerald-500 rounded-xl flex items-center justify-center border border-emerald-500/10">
                        <Sparkles size={20} />
                     </div>
                     <div>
                        <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">Campaign Hub</h3>
                        <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">
                           Target: {filterType === 'debt' ? 'Recovery' : filterType === 'dormant' ? 'Re-engagement' : 'Engagement'}
                        </p>
                     </div>
                  </div>

                  <div className="space-y-6 flex-1 flex flex-col min-h-0">
                     <div className="flex flex-col gap-2 flex-1 min-h-0">
                        <div className="flex justify-between items-center">
                           <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                              Payload Message
                           </label>
                           <div className="flex gap-2">
                              <button
                                 onClick={() => setShowTemplates(true)}
                                 className="p-1.5 bg-white/5 text-purple-400 rounded-lg hover:bg-purple-600 hover:text-white transition-all"
                                 title="Load Template"
                              >
                                 <Bookmark size={12} />
                              </button>
                              <button
                                 onClick={handleAiDraft}
                                 disabled={isGenerating}
                                 className="flex items-center gap-1 text-[9px] font-black text-blue-400 uppercase hover:text-white transition-colors disabled:opacity-50"
                              >
                                 {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                                 {isGenerating ? 'AI Draft' : 'Magic Draft'}
                              </button>
                           </div>
                        </div>
                        <textarea
                           className="glass-input rounded-2xl px-5 py-4 text-xs font-medium text-gray-300 outline-none flex-1 resize-none leading-relaxed"
                           placeholder="Hello {name}, ..."
                           value={message}
                           onChange={(e) => setMessage(e.target.value)}
                        />
                        <div className="flex justify-between items-center mt-1">
                           <div className="flex gap-1 flex-wrap">
                              {['{name}', '{balance}'].map(tag => (
                                 <button
                                    key={tag}
                                    onClick={() => setMessage(m => m + tag)}
                                    className="px-2 py-1 bg-white/5 border border-white/5 rounded-lg text-[8px] font-black text-blue-400 uppercase hover:bg-blue-600 hover:text-white transition-all"
                                 >
                                    + {tag}
                                 </button>
                              ))}
                           </div>
                           <button onClick={saveTemplate} className="text-[8px] font-bold text-gray-600 hover:text-white flex items-center gap-1"><Save size={10} /> Save as Template</button>
                        </div>
                     </div>

                     <div className="p-4 bg-blue-600/5 border border-blue-500/10 rounded-2xl flex flex-col gap-2 shrink-0">
                        <div className="flex justify-between items-center">
                           <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Target Volume</span>
                           <span className={`text-xs font-black font-mono ${filterType === 'debt' ? 'text-red-400' : 'text-emerald-400'}`}>LKR {targetedValue.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[8px] font-bold text-gray-600">
                           <AlertCircle size={10} />
                           <span>Sends via browser relay. Keep window open.</span>
                        </div>
                     </div>

                     <div className="shrink-0">
                        <button
                           onClick={prepareCampaign}
                           disabled={selectedIds.size === 0 || !message}
                           className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-20 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-[0.4em] shadow-3xl active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                           <Zap size={18} /> Launch Broadcast
                        </button>
                     </div>
                  </div>
               </GlassCard>
            )}
         </div>
      </div>
   );
};
