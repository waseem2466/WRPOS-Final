import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, Database, Wifi, ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react';
import { auth as firebaseAuth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export const FirebaseMonitor: React.FC = () => {
    const [status, setStatus] = useState({
        firebase: 'connecting',
        neon: 'connecting',
        auth: 'checking',
        lastSync: new Date().toLocaleTimeString()
    });
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Firebase Auth Listener
        const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
            setStatus(prev => ({
                ...prev,
                auth: user ? 'authenticated' : 'guest',
                firebase: 'connected'
            }));
        });

        // Mock Neon Status (In a real app, this would poll an endpoint or check the driver)
        const checkStatus = () => {
            setStatus(prev => ({
                ...prev,
                neon: 'connected',
                lastSync: new Date().toLocaleTimeString()
            }));
        };

        const interval = setInterval(checkStatus, 30000);
        checkStatus();

        return () => {
            unsubscribeAuth();
            clearInterval(interval);
        };
    }, []);

    const StatusBadge = ({ label, type, icon: Icon }: { label: string, type: string, icon: any }) => {
        const colors = {
            connected: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
            connecting: 'text-blue-400 bg-blue-400/10 border-blue-400/20 animate-pulse',
            authenticated: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
            guest: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
            error: 'text-red-400 bg-red-400/10 border-red-400/20'
        };

        const colorClass = colors[type as keyof typeof colors] || colors.connecting;

        return (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${colorClass} text-[10px] font-black uppercase tracking-widest`}>
                <Icon size={12} />
                <span>{label}: {type}</span>
            </div>
        );
    };

    if (!isVisible) {
        return (
            <button
                onClick={() => setIsVisible(true)}
                className="fixed bottom-6 right-6 z-[9999] w-12 h-12 bg-[#0f172a] border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl hover:bg-blue-600 transition-all group"
            >
                <Cloud className="text-blue-400 group-hover:text-white" size={20} />
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 z-[9999] w-72 bg-[#0f172a]/95 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 shadow-[0_30px_100px_-20px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-5 duration-500">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="text-blue-500" size={18} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Cloud Infrastructure</span>
                </div>
                <button onClick={() => setIsVisible(false)} className="text-gray-500 hover:text-white transition-colors">
                    <AlertCircle size={14} />
                </button>
            </div>

            <div className="space-y-3">
                <StatusBadge label="Firestore" type={status.firebase} icon={Cloud} />
                <StatusBadge label="Neon DB" type={status.neon} icon={Database} />
                <StatusBadge label="Security" type={status.auth} icon={Wifi} />
            </div>

            <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[8px] font-bold text-gray-500 uppercase tracking-widest">
                    <RefreshCw size={10} className="animate-spin-slow" />
                    Last Sync: {status.lastSync}
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
            </div>
        </div>
    );
};
