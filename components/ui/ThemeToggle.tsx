
import React, { useEffect, useState } from 'react';
import { Sun, Moon, Zap, Sunset } from 'lucide-react';
import { audioService } from '../../services/audio';

type Theme = 'dark' | 'neon' | 'sunset' | 'day';

export const ThemeToggle: React.FC = () => {
    const [theme, setTheme] = useState<Theme>((localStorage.getItem('app-theme') as Theme) || 'dark');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('app-theme', theme);
        if (theme !== (localStorage.getItem('app-theme') as Theme)) {
            audioService.playNotification();
        }
    }, [theme]);

    const themes: { id: Theme; icon: any; color: string; label: string }[] = [
        { id: 'dark', icon: Moon, color: 'bg-slate-800', label: 'Dark' },
        { id: 'neon', icon: Zap, color: 'bg-indigo-600', label: 'Neon' },
        { id: 'sunset', icon: Sunset, color: 'bg-orange-600', label: 'Sunset' },
        { id: 'day', icon: Sun, color: 'bg-blue-400', label: 'Day' },
    ];

    return (
        <div className="flex items-center gap-1.5 liquid-shell p-1.5 rounded-[1.45rem]">
            {themes.map((t) => (
                <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`relative p-2.5 rounded-[1.05rem] transition-all duration-500 group ${theme === t.id ? `${t.color} text-white shadow-lg scale-105` : 'text-slate-400 hover:bg-white/10 hover:text-white'
                        }`}
                    title={t.label}
                >
                    <t.icon size={16} className={theme === t.id ? 'animate-pulse' : ''} />
                    {theme === t.id && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping" />
                    )}
                </button>
            ))}
        </div>
    );
};
