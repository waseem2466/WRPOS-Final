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

// FIX #3: Normalize numbers safely
const normalizeNumber = (from: string) => {
    if (!from) return '';
    return from.includes('@') ? from.split('@')[0] : from;
};


export const WhatsAppBotUI: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'qr' | 'cloud'>('qr');
    const [status, setStatus] = useState<{ state: string; qr: string | null }>({
        state: 'LOGGED_OUT',
        qr: null
    });
    const [loading, setLoading] = useState(true);

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
        const newState = !isBotActive;
        setIsBotActive(newState);
        localStorage.setItem('wa_cloud_bot_active', String(newState));
        await window.electronAPI?.waSetBotState?.(newState);
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

    const loadHistory = (phoneNumberId: string) => {
        window.electronAPI?.waCloudGetHistory?.({ limit: 50 }).then((history: any) => {
            if (history && history.length > 0) {
                const historyLogs = history.map((m: any) => {
                    const isMe =
                        m.direction === 'outgoing' ||
                        m.from === 'me' ||
                        (phoneNumberId && m.from === phoneNumberId);

                    return {
                        id: m.id,
                        type: isMe ? 'outgoing' : 'incoming',
                        source: m.method,
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
        await window.electronAPI?.waLink?.();
        setLoading(false);
    };

    const handleLogout = async () => {
        if (confirm('Are you sure you want to disconnect?')) {
            await window.electronAPI?.waLogout?.();
        }
    };

    const handleReply = (from: string) => {
        setTargetNumber(normalizeNumber(from));
        msgInputRef.current?.focus();
    };

    const handleSendMessage = async () => {
        if (!manualMsg.trim()) return;
        const target = targetNumber.trim();
        if (!target) {
            alert('Please enter a target phone number');
            return;
        }

        try {
            const tempId = Date.now().toString();
            addLog({ id: tempId, type: 'outgoing', source: activeTab, text: manualMsg, from: 'Me' });

            if (activeTab === 'cloud') {
                await window.electronAPI?.waCloudSend?.({ to: target, message: manualMsg, id: tempId });
            } else {
                if (status.state !== 'LINKED') throw new Error('QR not linked');
                await window.electronAPI?.waQrSend?.({ to: target, message: manualMsg, id: tempId });
            }
            setManualMsg('');
        } catch (e: any) {
            addLog({ type: 'error', source: activeTab, text: `Send Failed: ${e.message}` });
        }
    };

    const handleSaveCloud = async () => {
        setIsSavingCloud(true);
        await window.electronAPI?.waCloudSave?.(cloudConfig);
        setIsSavingCloud(false);
        addLog({ type: 'system', source: 'cloud', text: 'Cloud Configuration Saved' });
    };

    return (
        <GlassCard className="p-0 border-blue-500/20 bg-black/20 backdrop-blur-2xl overflow-hidden flex flex-col h-full relative">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                        <Bot className="text-blue-500" size={18} />
                    </div>
                    <h2 className="text-sm font-black text-white uppercase tracking-wider">AI Communication Hub</h2>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab('qr')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all gap-2 flex items-center ${activeTab === 'qr'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-white/5 text-slate-400 hover:bg-white/10'
                            }`}
                    >
                        <QrCode size={14} /> Personal (QR)
                    </button>
                    <button
                        onClick={() => setActiveTab('cloud')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all gap-2 flex items-center ${activeTab === 'cloud'
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                            : 'bg-white/5 text-slate-400 hover:bg-white/10'
                            }`}
                    >
                        <Cloud size={14} /> Business (Cloud)
                    </button>
                </div>
            </div>

            {/* Top Config Area (Dynamic but Unified) */}
            <div className="p-4 bg-white/5 border-b border-white/5">
                {activeTab === 'qr' ? (
                    <div className="flex items-center justify-between bg-black/40 p-4 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-4">
                            {status.state === 'QR_READY' && status.qr ? (
                                <div className="p-4 bg-white rounded-2xl shadow-xl">
                                    <img src={status.qr} alt="QR" className="w-64 h-64 object-contain" />
                                </div>
                            ) : (
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${status.state === 'LINKED' ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-slate-500/20 border-slate-500/30'} border`}>
                                    {status.state === 'LINKED' ? <CheckCircle className="text-emerald-500" /> : <Smartphone className="text-slate-500" />}
                                </div>
                            )}
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Baileys Status</p>
                                <p className={`text-xs font-black uppercase ${status.state === 'LINKED' ? 'text-emerald-500' : (status.state === 'RECONNECTING' ? 'text-orange-500' : (status.state === 'QR_READY' ? 'text-blue-400' : 'text-slate-400'))}`}>
                                    {status.state.replace('_', ' ')}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {status.state === 'LINKED' ? (
                                <div className="flex gap-2">
                                    <button
                                        onClick={async () => {
                                            const phone = prompt('Enter phone number for test (e.g. 94712345678):');
                                            if (phone) {
                                                const res = await (window as any).electronAPI.waQrTest({ to: phone });
                                                if (res.success) alert('Test signal sent! Check your phone.');
                                                else alert('Test failed: ' + res.error);
                                            }
                                        }}
                                        className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-500/30 transition-all flex items-center gap-2"
                                    >
                                        <Zap size={14} /> Test
                                    </button>
                                    <button onClick={handleLogout} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/30 transition-all flex items-center gap-2">
                                        <LogOut size={14} /> Disconnect
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    {status.state === 'QR_READY' && (
                                        <button onClick={handleLogout} title="Clear Session & Reset" className="p-2 bg-white/5 hover:bg-red-500/20 text-slate-500 hover:text-red-500 rounded-xl border border-white/5 transition-all">
                                            <RefreshCw size={14} />
                                        </button>
                                    )}
                                    {status.state === 'RECONNECTING' && (
                                        <div className="flex items-center gap-2 text-orange-500 bg-orange-500/10 px-3 py-1 rounded-lg border border-orange-500/20 animate-pulse">
                                            <Activity size={12} /> <span className="text-[10px] font-bold uppercase tracking-tighter">Retrying Connection...</span>
                                        </div>
                                    )}
                                    <button onClick={handleLink} className="px-4 py-2 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
                                        <Smartphone size={14} className={loading ? 'animate-spin' : ''} /> {loading ? 'Initializing...' : (status.state === 'QR_READY' ? 'Refresh QR' : 'Link Device')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Access Token</label>
                                <input
                                    type="password"
                                    value={cloudConfig.token}
                                    onChange={(e) => setCloudConfig(prev => ({ ...prev, token: e.target.value }))}
                                    className="w-full bg-transparent border-none text-white text-xs focus:ring-0 p-0 font-mono"
                                    placeholder="EAAMD..."
                                />
                            </div>
                            <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Phone ID</label>
                                <input
                                    type="text"
                                    value={cloudConfig.phoneNumberId}
                                    onChange={(e) => setCloudConfig(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                                    className="w-full bg-transparent border-none text-white text-xs focus:ring-0 p-0"
                                    placeholder="9629..."
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={toggleBot}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${isBotActive
                                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                                        : 'bg-white/5 text-slate-400 border border-white/10'
                                        }`}
                                >
                                    <Bot size={14} />
                                    AI Autopilot: {isBotActive ? 'ON' : 'OFF'}
                                </button>
                                {publicUrl && (
                                    <div className="px-3 py-2 bg-black/40 rounded-xl border border-white/5 flex items-center gap-2 text-[10px] text-slate-500 font-black uppercase tracking-widest">
                                        <Wifi size={12} className="text-blue-500" /> {publicUrl.replace('http://', '')}
                                    </div>
                                )}
                            </div>
                            <button onClick={handleSaveCloud} disabled={isSavingCloud} className="px-4 py-2 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2">
                                {isSavingCloud ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />} Save Cloud Config
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Shared Chat Interface (Parity) */}
            <div className="flex-1 flex flex-col min-h-0 bg-black/10">
                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
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
                                <div className={`max-w-[80%] rounded-2xl p-4 border transition-all hover:bg-black/30 ${log.type === 'incoming'
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
                <div className="p-4 bg-black/40 border-t border-white/5 backdrop-blur-xl">
                    <div className="flex gap-3 items-end max-w-5xl mx-auto w-full">
                        <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 px-3">
                                <span className={`w-2 h-2 rounded-full animate-pulse ${activeTab === 'cloud' ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`} />
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                    Transmitting via {activeTab === 'cloud' ? 'Business Cloud' : 'Personal Baileys'}
                                </span>
                            </div>
                            <div className="flex gap-2 bg-white/5 rounded-2xl border border-white/10 p-2 focus-within:border-blue-500/30 transition-all">
                                <input
                                    type="text"
                                    value={targetNumber}
                                    onChange={(e) => setTargetNumber(e.target.value)}
                                    className="w-32 bg-transparent border-r border-white/10 text-current text-xs px-2 focus:ring-0 placeholder-slate-600 font-bold"
                                    placeholder="Number..."
                                />
                                <input
                                    ref={msgInputRef}
                                    type="text"
                                    value={manualMsg}
                                    onChange={(e) => setManualMsg(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    className="flex-1 bg-transparent border-none text-current text-xs px-2 focus:ring-0 placeholder-slate-600 font-medium"
                                    placeholder="Type your message to send via active channel..."
                                />
                                <button
                                    onClick={handleSendMessage}
                                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${manualMsg.trim() ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-slate-600'
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

