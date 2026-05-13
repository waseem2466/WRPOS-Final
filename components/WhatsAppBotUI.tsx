import React, { useEffect, useState, useRef } from 'react';
import { Smartphone, CheckCircle, AlertCircle, RefreshCw, LogOut, MessageSquare, Bot, QrCode, Cloud, Key, Save, Send, ToggleLeft, ToggleRight, Sparkles, Terminal, Activity, Wifi, Zap, Reply, Check, CheckCheck } from 'lucide-react';
import { GlassCard } from './ui/GlassCard';



interface LogItem {
    id: string;
    type: 'incoming' | 'outgoing' | 'system' | 'error';
    source: 'cloud' | 'qr';
    text: string;
    from?: string;
    timestamp: number;
    status?: string;
    isAI?: boolean;
}

const normalizeNumber = (from: string) => {
    if (!from) return '';
    const raw = from.includes('@') ? from.split('@')[0] : from;
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) return `94${digits.slice(1)}`;
    return digits;
};


export const WhatsAppBotUI: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'qr' | 'cloud'>('qr');
    const [status, setStatus] = useState<{ state: string; qr: string | null; error?: string | null }>({
        state: 'LOGGED_OUT',
        qr: null,
        error: null
    });
    const [loading, setLoading] = useState(true);
    const qrRequestSent = useRef(false);

    // Cloud API State
    const [cloudConfig, setCloudConfig] = useState({ token: '', phoneNumberId: '' });
    const [isSavingCloud, setIsSavingCloud] = useState(false);

    // Unified State
    const [logs, setLogs] = useState<LogItem[]>([]);
    const [manualMsg, setManualMsg] = useState('');
    const [targetNumber, setTargetNumber] = useState('');
    const [isBotActive, setIsBotActive] = useState(false);
    const [publicUrl, setPublicUrl] = useState<string>('');
    const logsEndRef = useRef<HTMLDivElement>(null);
    const msgInputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Initial load: Sync with persistent backend state
    useEffect(() => {
        window.electronAPI?.waGetBotConfig?.().then((config: any) => {
            if (config) {
                setIsBotActive(config.isBotEnabled);
                localStorage.setItem('wa_cloud_bot_active', String(config.isBotEnabled));
            }
        });
    }, []);

    const toggleBot = async () => {
        setIsBotActive(true);
        localStorage.setItem('wa_cloud_bot_active', 'true');
        await window.electronAPI?.waSetBotState?.(true);
        addLog({ type: 'system', source: activeTab, text: 'AI Autopilot is always on.' });
    };

    const addLog = (item: Partial<LogItem> & Omit<LogItem, 'id' | 'timestamp'>) => {
        setLogs((prev: LogItem[]) => [...prev.slice(-99), {
            id: item.id || Math.random().toString(36).substring(7),
            type: item.type,
            source: item.source,
            text: item.text,
            from: item.from,
            status: item.status,
            isAI: item.isAI,
            timestamp: Date.now()
        } as LogItem]);
    };

    useEffect(() => {
        // Load Cloud Config first to prevent race conditions
        window.electronAPI?.waCloudGet?.().then((c: any) => {
            if (c) {
                setCloudConfig(c);
                loadHistory(c.phoneNumberId);
            }
        });

        // Initial status fetch
        window.electronAPI?.waGetStatus?.().then((s: any) => {
            if (s) {
                setStatus(s);
                if (typeof s.isBotEnabled === 'boolean') setIsBotActive(s.isBotEnabled);
            }
            setLoading(false);
        });

        // Load Public Webhook URL
        window.electronAPI?.waGetWebhookUrl?.().then((url: string) => {
            if (url) setPublicUrl(url);
        });

        // --- Listeners ---
        const cleanStatus = window.electronAPI?.onWaStatusUpdate?.((s: any) => {
            setStatus(s);
            if (typeof s.isBotEnabled === 'boolean') setIsBotActive(s.isBotEnabled);
            if (s.state === 'LINKED') addLog({ type: 'system', source: 'qr', text: 'Device Linked Successfully' });
            if (s.state === 'LOGGED_OUT') addLog({ type: 'system', source: 'qr', text: 'Device Disconnected' });
            if (s.error) addLog({ type: 'error', source: 'qr', text: s.error });
        });

        const cleanCloud = window.electronAPI?.onWaCloudMessage?.((data: any) => {
            if (!data.from) return;
            addLog({ type: 'incoming', source: 'cloud', text: data.text, from: data.from });
        });

        const cleanQr = window.electronAPI?.onWaQrMessage?.((data: any) => {
            addLog({ type: 'incoming', source: 'qr', text: data.text, from: data.from });
        });

        const cleanBot = window.electronAPI?.onWaBotReply?.((data: any) => {
            addLog({
                id: data.id,
                type: 'outgoing',
                source: data.method,
                text: data.text,
                from: 'WR POS AI',
                isAI: true
            });
        });

        const cleanStatusMsg = window.electronAPI?.onWaMessageStatus?.((data: any) => {
            setLogs((prev: LogItem[]) =>
                prev.map((l: LogItem) =>
                    l.id === data.id ? { ...l, status: data.status } : l
                )
            );
        });

        return () => {
            cleanStatus?.();
            cleanCloud?.();
            cleanQr?.();
            cleanBot?.();
            cleanStatusMsg?.();
        };

    }, []);

    useEffect(() => {
        if (activeTab === 'qr' && !loading && !qrRequestSent.current && status.state === 'LOGGED_OUT') {
            qrRequestSent.current = true;
            const requestQr = async () => {
                addLog({ type: 'system', source: 'qr', text: 'Opening AI Agent: generating WhatsApp QR code...' });
                const res = await window.electronAPI?.waLink?.();
                if (!res?.success) {
                    addLog({ type: 'error', source: 'qr', text: `QR generation failed: ${res?.error || 'unknown error'}` });
                    qrRequestSent.current = false;
                } else {
                    addLog({ type: 'system', source: 'qr', text: 'QR generation initiated. Please scan the QR code when it appears.' });
                }
            };
            requestQr();
        }
    }, [activeTab, loading, status.state]);

    const loadHistory = (phoneNumberId: string) => {
        window.electronAPI?.waCloudGetHistory?.({ limit: 50 }).then((history: any) => {
            if (history && history.length > 0) {
                const historyLogs = history.map((m: any) => {
                    const isMe =
                        m.type === 'outgoing' ||
                        m.from === 'me' ||
                        m.from === 'system' ||
                        (phoneNumberId && m.from === phoneNumberId);

                    return {
                        id: m.id,
                        type: isMe ? 'outgoing' : 'incoming',
                        source: m.method === 'cloud' ? 'cloud' : 'qr',
                        text: m.text,
                        from: isMe ? 'Me' : m.from,
                        timestamp: new Date(m.timestamp).getTime()
                    };
                });
                setLogs(historyLogs);
                addLog({ type: 'system', source: 'cloud', text: `Restored ${history.length} messages from Neural Cache` });
            }
        });
    }

    const handleLink = async () => {
        setLoading(true);
        addLog({ type: 'system', source: 'qr', text: 'Generating QR Code...' });
        const res = await window.electronAPI?.waLink?.();
        if (!res?.success) {
            addLog({ type: 'error', source: 'qr', text: `Failed to generate QR: ${res?.error || 'unknown error'}` });
            alert(`Unable to generate QR code: ${res?.error || 'Please check the console for details.'}`);
        }
        setLoading(false);
    };

    const handleLogout = async () => {
        if (confirm('Disconnect WhatsApp on this PC but keep the saved login session?')) {
            await window.electronAPI?.waLogout?.();
        }
    };

    const handleDeepReset = async () => {
        if (confirm('DEEP RESET: This will remove the saved WhatsApp login session and require a new QR scan. Use only if the session is broken. Proceed?')) {
            await window.electronAPI?.waResetSession?.();
            qrRequestSent.current = false;
        }
    };

    const handleReply = (from: string) => {
        setTargetNumber(normalizeNumber(from));
        msgInputRef.current?.focus();
    };

    const handleSendMessage = async () => {
        if (!manualMsg.trim()) return;
        const target = normalizeNumber(targetNumber.trim());
        if (!target) {
            alert('Please enter a valid target phone number');
            return;
        }

        try {
            const tempId = Date.now().toString();
            addLog({ id: tempId, type: 'outgoing', source: activeTab, text: manualMsg, from: 'Me' });

            if (activeTab === 'cloud') {
                const cloudResponse = await window.electronAPI?.waCloudSend?.({ to: target, message: manualMsg, id: tempId });
                if (!cloudResponse?.success) {
                    throw new Error(cloudResponse?.error || 'Cloud send failed');
                }
            } else {
                if (status.state !== 'LINKED') throw new Error('QR not linked');
                const qrResponse = await window.electronAPI?.waQrSend?.({ to: target, message: manualMsg, id: tempId });
                if (!qrResponse?.success) {
                    throw new Error(qrResponse?.error || 'QR send failed');
                }
            }
            setManualMsg('');
        } catch (e: any) {
            addLog({ type: 'error', source: activeTab, text: `Send Failed: ${e.message}` });
        }
    };

    const handleSaveCloud = async () => {
        setIsSavingCloud(true);
        const response = await window.electronAPI?.waCloudSave?.({
            token: cloudConfig.token.trim(),
            phoneNumberId: cloudConfig.phoneNumberId.trim()
        });
        setIsSavingCloud(false);
        if (!response?.success) {
            addLog({ type: 'error', source: 'cloud', text: response?.error || 'Unable to save cloud configuration' });
            return;
        }
        addLog({ type: 'system', source: 'cloud', text: 'Cloud configuration saved successfully' });
    };

    return (
        <GlassCard className="p-0 border-blue-500/20 bg-black/20 backdrop-blur-2xl overflow-hidden flex flex-col h-full relative">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-5 border-b border-white/5 bg-white/5">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-[1rem] bg-blue-500/20 flex items-center justify-center border border-blue-500/30 shadow-[0_16px_36px_rgba(59,130,246,0.18)]">
                        <Bot className="text-blue-500" size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-white uppercase tracking-wider">AI Communication Hub</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.24em] mt-1">Liquid messaging terminal</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('qr')}
                        className={`px-4 py-2.5 premium-chip tap-lift rounded-[1rem] text-[10px] font-black uppercase tracking-[0.22em] transition-all gap-2 flex items-center whitespace-nowrap ${activeTab === 'qr'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-white/5 text-slate-400 hover:bg-white/10'
                            }`}
                    >
                        <QrCode size={14} /> Personal (QR)
                    </button>
                    <button
                        onClick={() => setActiveTab('cloud')}
                        className={`px-4 py-2.5 premium-chip tap-lift rounded-[1rem] text-[10px] font-black uppercase tracking-[0.22em] transition-all gap-2 flex items-center whitespace-nowrap ${activeTab === 'cloud'
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                            : 'bg-white/5 text-slate-400 hover:bg-white/10'
                            }`}
                    >
                        <Cloud size={14} /> Business (Cloud)
                    </button>
                </div>
            </div>

            {/* Top Config Area (Dynamic but Unified) */}
            <div className="p-5 bg-white/5 border-b border-white/5">
                {activeTab === 'qr' ? (
                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-4 bg-black/35 p-4 rounded-[2rem] border border-white/5">
                        <div className="flex items-center gap-4 min-w-0">
                            {status.state === 'QR_READY' && status.qr ? (
                                <div className="p-4 bg-white rounded-[1.8rem] shadow-xl shrink-0">
                                    <img src={status.qr} alt="QR" className="w-40 h-40 md:w-56 md:h-56 object-contain" />
                                </div>
                            ) : (
                                <div className={`w-14 h-14 rounded-[1rem] flex items-center justify-center shrink-0 ${status.state === 'LINKED' ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-slate-500/20 border-slate-500/30'} border`}>
                                    {status.state === 'LINKED' ? <CheckCircle className="text-emerald-500" /> : <Smartphone className="text-slate-500" />}
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Baileys Status</p>
                                <p className={`text-sm font-black uppercase ${status.state === 'LINKED' ? 'text-emerald-500' : (status.state === 'RECONNECTING' ? 'text-orange-500' : (status.state === 'QR_READY' ? 'text-blue-400' : 'text-slate-400'))}`}>
                                    {status.state.replace('_', ' ')}
                                </p>
                                {status.state !== 'LINKED' && status.state !== 'QR_READY' && (
                                    <p className="mt-2 text-[10px] text-slate-400 max-w-[220px]">
                                        No QR is available yet. Click "Link Personal Device" to generate a new WhatsApp login QR.
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 xl:justify-end">
                            {status.state === 'LINKED' ? (
                                <div className="flex gap-2">
                                    <button
                                        onClick={async () => {
                                            if (!targetNumber) {
                                                alert('Please enter a phone number in the "Number..." field first.');
                                                return;
                                            }
                                            const res = await (window as any).electronAPI.waQrTest({ to: targetNumber });
                                            if (res.success) alert('Test signal sent! Check your phone.');
                                            else alert('Test failed: ' + res.error);
                                        }}
                                        className="px-4 py-2.5 premium-chip tap-lift bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-[0.22em] border border-emerald-500/30 transition-all flex items-center gap-2"
                                    >
                                        <Zap size={14} /> Test
                                    </button>
                                    <button onClick={handleLogout} title="Stops the connection but keeps your saved WhatsApp login." className="px-4 py-2.5 premium-chip tap-lift bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-[0.22em] border border-red-500/30 transition-all flex items-center gap-2">
                                        <LogOut size={14} /> Stop Only
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    {status.state === 'QR_READY' && (
                                        <button 
                                            onClick={handleDeepReset} 
                                            title="Deep Reset: Wipes all session data and starts fresh if you are experiencing disconnection issues." 
                                            className="px-3 py-2 premium-chip tap-lift bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl border border-red-500/20 transition-all flex items-center gap-2 group"
                                        >
                                            <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                                            <span className="text-[9px] font-black uppercase">Deep Reset</span>
                                        </button>
                                    )}
                                    {status.error && (
                                        <div className="flex items-center gap-2 text-red-500 bg-red-500/10 px-4 py-2 rounded-xl border border-red-500/20 animate-in fade-in zoom-in duration-300">
                                            <AlertCircle size={16} /> 
                                            <span className="text-[10px] font-black uppercase tracking-tight">{status.error}</span>
                                        </div>
                                    )}
                                    {status.state === 'RECONNECTING' && (
                                        <div className="flex items-center gap-2 text-orange-500 bg-orange-500/10 px-3 py-1 rounded-lg border border-orange-500/20 animate-pulse">
                                            <Activity size={12} /> <span className="text-[10px] font-bold uppercase tracking-tighter">Retrying Connection...</span>
                                        </div>
                                    )}
                                    <button onClick={handleLink} className="px-4 py-2.5 premium-chip tap-lift bg-blue-500 text-white rounded-[1rem] text-[10px] font-black uppercase tracking-[0.22em] hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
                                        <Smartphone size={14} className={loading ? 'animate-spin' : ''} /> {loading ? 'Initializing Brain...' : (status.state === 'QR_READY' ? 'Get New QR' : 'Link Personal Device')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="bg-black/40 p-4 rounded-[1.6rem] border border-white/5">
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Access Token</label>
                                <input
                                    type="password"
                                    value={cloudConfig.token}
                                    onChange={(e) => setCloudConfig(prev => ({ ...prev, token: e.target.value }))}
                                    className="w-full bg-transparent border-none text-white text-xs focus:ring-0 p-0 font-mono placeholder:text-slate-600"
                                    placeholder="EAAMD..."
                                />
                            </div>
                            <div className="bg-black/40 p-4 rounded-[1.6rem] border border-white/5">
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Phone ID</label>
                                <input
                                    type="text"
                                    value={cloudConfig.phoneNumberId}
                                    onChange={(e) => setCloudConfig(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                                    className="w-full bg-transparent border-none text-white text-xs focus:ring-0 p-0 placeholder:text-slate-600"
                                    placeholder="9629..."
                                />
                            </div>
                        </div>
                        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    onClick={toggleBot}
                                    className={`px-4 py-2.5 premium-chip tap-lift rounded-[1rem] text-[10px] font-black uppercase tracking-[0.22em] transition-all flex items-center gap-2 ${isBotActive
                                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                                        : 'bg-white/5 text-slate-400 border border-white/10'
                                        }`}
                                >
                                    <Bot size={14} />
                                    AI Autopilot: ALWAYS ON
                                </button>
                                {publicUrl && (
                                    <div className="px-3 py-2 bg-black/40 rounded-xl border border-white/5 flex items-center gap-2 text-[10px] text-slate-500 font-black uppercase tracking-widest">
                                        <Wifi size={12} className="text-blue-500" /> {publicUrl.replace('http://', '')}
                                    </div>
                                )}
                            </div>
                            <button onClick={handleSaveCloud} disabled={isSavingCloud} className="px-4 py-2.5 premium-chip tap-lift bg-purple-600 text-white rounded-[1rem] text-[10px] font-black uppercase tracking-[0.22em] hover:bg-purple-700 shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2">
                                {isSavingCloud ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />} Save Cloud Config
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Shared Chat Interface (Parity) */}
            <div className="flex-1 flex flex-col min-h-0 bg-black/10">
                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-6 space-y-4">
                    {logs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4">
                            <MessageSquare size={48} className="text-slate-700" />
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">No Transmission Records Found</p>
                        </div>
                    ) : (
                        logs.map((log) => (
                            <div
                                key={log.id}
                                className={`flex flex-col ${log.type === 'outgoing' ? 'items-end' : 'items-start'}`}
                            >
                                <div className={`max-w-[90%] md:max-w-[80%] rounded-[1.4rem] p-4 border tap-lift transition-all hover:bg-black/30 shadow-[0_18px_36px_rgba(2,6,23,0.18)] ${log.type === 'incoming'
                                    ? 'bg-blue-600/10 border-blue-500/20 rounded-tl-none'
                                    : log.type === 'outgoing'
                                        ? 'bg-emerald-600/10 border-emerald-500/20 rounded-tr-none'
                                        : 'bg-slate-800/40 border-white/5 text-center mx-auto w-full'
                                    }`}>
                                    <div className="flex items-center justify-between gap-4 mb-2">
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${log.source === 'cloud' ? 'text-purple-400' : 'text-blue-400'
                                            }`}>
                                            {log.source === 'cloud' ? 'Business App' : 'Personal WA'} • {new Date(log.timestamp).toLocaleTimeString()}
                                        </span>
                                        {log.isAI && (
                                            <span className="bg-blue-500/20 px-2 py-0.5 rounded text-[8px] text-blue-400 font-black border border-blue-500/30 uppercase">AI REPLIED</span>
                                        )}
                                    </div>
                                    <p className="text-white text-xs leading-relaxed font-medium">{log.text}</p>

                                    <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2">
                                            {log.from && (
                                                <button
                                                    onClick={() => handleReply(log.from!)}
                                                    className="text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-blue-400 transition-colors"
                                                >
                                                    ID: {log.from}
                                                </button>
                                            )}
                                        </div>
                                        {log.type === 'outgoing' && log.status && (
                                            <div className="flex items-center gap-1">
                                                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{log.status}</span>
                                                {log.status === 'read' ? <CheckCheck size={12} className="text-blue-500" /> :
                                                    log.status === 'delivered' ? <CheckCheck size={12} className="text-slate-500" /> :
                                                        <Check size={12} className="text-slate-500" />}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>

                {/* Input Area (Shared across both modes) */}
                <div className="p-4 md:p-5 bg-black/40 border-t border-white/5 backdrop-blur-xl">
                    <div className="flex gap-3 items-end max-w-5xl mx-auto w-full">
                        <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 px-3">
                                <span className={`w-2 h-2 rounded-full animate-pulse ${activeTab === 'cloud' ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`} />
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                    Transmitting via {activeTab === 'cloud' ? 'Business Cloud' : 'Personal Baileys'}
                                </span>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 bg-white/5 rounded-[1.6rem] border border-white/10 p-2 focus-within:border-blue-500/30 transition-all">
                                <input
                                    type="text"
                                    value={targetNumber}
                                    onChange={(e) => setTargetNumber(e.target.value)}
                                    className="sm:w-36 bg-transparent sm:border-r border-white/10 text-current text-xs px-3 py-2 focus:ring-0 placeholder-slate-600 font-bold"
                                    placeholder="Number..."
                                />
                                <input
                                    ref={msgInputRef}
                                    type="text"
                                    value={manualMsg}
                                    onChange={(e) => setManualMsg(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    className="flex-1 bg-transparent border-none text-current text-xs px-3 py-2 focus:ring-0 placeholder-slate-600 font-medium"
                                    placeholder="Type your message to send via active channel..."
                                />
                                <button
                                    onClick={handleSendMessage}
                                    className={`w-full sm:w-12 h-12 rounded-[1rem] flex items-center justify-center tap-lift transition-all ${manualMsg.trim() ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-slate-600'
                                        }`}
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </GlassCard >
    );
}

