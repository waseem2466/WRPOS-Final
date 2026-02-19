
import React, { useEffect, useState } from 'react';
import { Sun, Moon, Zap, Sunset } from 'lucide-react';

type Theme = 'default' | 'neon' | 'sunset' | 'day';

export const ThemeToggle: React.FC = () => {
    const [theme, setTheme] = useState<Theme>((localStorage.getItem('app-theme') as Theme) || 'default');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('app-theme', theme);
    }, [theme]);

    const themes: { id: Theme; icon: any; color: string; label: string }[] = [
        { id: 'default', icon: Moon, color: 'bg-slate-800', label: 'Obsidian' },
        { id: 'neon', icon: Zap, color: 'bg-indigo-600', label: 'Neon' },
        { id: 'sunset', icon: Sunset, color: 'bg-orange-600', label: 'Sunset' },
        { id: 'day', icon: Sun, color: 'bg-blue-400', label: 'Day' },
    ];

    return (
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl p-1.5 rounded-2xl border border-white/5 shadow-2xl">
            {themes.map((t) => (
                <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`relative p-2 rounded-xl transition-all duration-500 group ${theme === t.id ? `${t.color} text-white shadow-lg scale-110` : 'text-slate-500 hover:bg-white/5'
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
