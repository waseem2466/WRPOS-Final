import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Stats } from './components/Stats';
import { ProductManager } from './components/ProductManager';
import { BillingPOS } from './components/BillingPOS';
import { CustomerManager } from './components/CustomerManager';
import { SupplierManager } from './components/SupplierManager';
import { ExpenseManager } from './components/ExpenseManager';
import { SystemExplorer } from './components/SystemExplorer';
import { SettingsManager } from './components/SettingsManager';
import { MarketingHub } from './components/MarketingHub';
import { WhatsAppBotUI } from './components/WhatsAppBotUI';
import { Login } from './components/Login';
import { db } from './services/mockDb';
import { BusinessSettings } from './types';
import {
  LayoutDashboard, ShoppingCart, Package, Users, Truck, LogOut,
  Settings, Loader2, Menu, X,
  Database, Send, Wallet, Wifi, WifiOff,
  Bot, ChevronRight, Wand2
} from 'lucide-react';


import { ActionProvider, useAction } from './context/ActionContext';
import { GlobalCommander } from './components/GlobalCommander';
import { AutoResponder } from './components/AutoResponder';
import { FirebaseMonitor } from './components/FirebaseMonitor';
import { ThemeToggle } from './components/ui/ThemeToggle';



type View = 'dashboard' | 'billing' | 'products' | 'customers' | 'suppliers' | 'expenses' | 'marketing' | 'system' | 'settings' | 'whatsapp';


const viewTitles: Record<View, string> = {
  dashboard: "Insights",
  billing: "Terminal",
  products: "Inventory",
  customers: "Customers",
  suppliers: "Supply Chain",
  expenses: "Expenditure",
  marketing: "Marketing",
  system: "Database",
  settings: "Settings",
  whatsapp: "AI Agent"
};


const SHOP_LOGO = "https://res.cloudinary.com/wrsmile/image/upload/v1765617036/wr_smile_supplies_products/yses6ycpqormspldap12.jpg";

const Logo = ({ settings, isOffline, hideText }: { settings: BusinessSettings | null, isOffline: boolean, hideText?: boolean }) => (
  <div className={`flex items-center gap-2 p-2 rounded-xl ${hideText ? 'justify-center' : ''}`}>
    <div className="relative">
      <div className="w-8 h-8 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg flex items-center justify-center shadow-lg border border-white/10">
        <img src={SHOP_LOGO} alt="Logo" className="w-full h-full object-contain p-1 rounded-lg" />
      </div>
      <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#0f172a] ${isOffline ? 'bg-orange-500' : 'bg-emerald-500'}`}></div>
    </div>
    {!hideText && (
      <div className="flex flex-col">
        <h1 className="text-sm font-black text-white leading-tight uppercase tracking-tight">
          {settings?.businessName || 'WR POS'}
        </h1>
        <p className="text-[8px] text-slate-500 font-bold tracking-widest uppercase">v6.0</p>
      </div>
    )}
  </div>
);

const NavItem = ({ view, icon: Icon, label, currentView, onClick }: { view: View, icon: any, label: string, currentView: View, onClick: () => void }) => {
  const titles: Record<string, string> = {
    dashboard: 'Insights',
    billing: 'Terminal',
    products: 'Inventory',
    customers: 'Customers',
    whatsapp: 'AI Agent',
    suppliers: 'Supply Chain',
    expenses: 'Expenditure',
    marketing: 'Marketing'
  };


  return (
    <button
      onClick={onClick}
      title={!label ? titles[view] : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group ${!label ? 'justify-center' : ''} ${currentView === view
        ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]'
        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
        }`}
    >
      <Icon size={16} className="shrink-0" />
      {label && <span className="font-bold text-[9px] uppercase tracking-widest whitespace-nowrap overflow-hidden">{label}</span>}
    </button>
  );
};

const AppContent = () => {
  const { user, logout, loading } = useAuth();
  const [isDbReady, setIsDbReady] = useState(false);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isNavExpanded, setIsNavExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('wr-nav-expanded');
    return saved !== null ? saved === 'true' : window.innerWidth >= 1024;
  });
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const { lastAction, clearAction } = useAction();

  // Helper for reactive navigation
  const handleNavClick = (view: View) => {
    setCurrentView(view);
    if (window.innerWidth < 1024) {
      setIsNavExpanded(false);
    }
  };

  // Handle Global AI Actions
  useEffect(() => {
    if (lastAction?.type === 'NAVIGATE') {
      const view = lastAction.payload.view;
      const validViews: View[] = ['dashboard', 'billing', 'products', 'customers', 'suppliers', 'expenses', 'marketing', 'system', 'settings', 'whatsapp'];
      if (validViews.includes(view as View)) {
        handleNavClick(view as View);
        clearAction();
      }
    }
  }, [lastAction, clearAction]);

  useEffect(() => {
    if (user) {
      db.setAuthToken('valid_session');
      initApp();
    }
  }, [user]);

  // Window Resize Reactivity
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsNavExpanded(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Persistence for Sidebar State
  useEffect(() => {
    localStorage.setItem('wr-nav-expanded', String(isNavExpanded));
  }, [isNavExpanded]);

  const initApp = async () => {
    try {
      await db.init();
      const settings = await db.settings.get();
      setBusinessSettings(settings);
      setIsDbReady(true);
    } catch (err) {
      setIsDbReady(true);
      setIsOffline(true);
    }
  };

  const toggleSidebar = () => {
    setIsNavExpanded(!isNavExpanded);
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Stats />;
      case 'billing': return <BillingPOS />;
      case 'products': return <ProductManager />;
      case 'customers': return <CustomerManager />;
      case 'suppliers': return <SupplierManager />;
      case 'expenses': return <ExpenseManager />;
      case 'marketing': return <MarketingHub />;
      case 'system': return <SystemExplorer />;
      case 'settings': return <SettingsManager />;
      case 'whatsapp': return <WhatsAppBotUI />;
      default: return <Stats />;
    }

  };

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-slate-500" size={48} /></div>;
  if (!user) return <Login />;
  if (!isDbReady) return <div className="min-h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={48} /></div>;

  const isNavVisible = isNavExpanded;

  return (
    <div className="h-screen w-screen flex text-slate-200 relative overflow-hidden bg-[#020617]">
      {/* --- SIDEBAR --- */}
      <aside
        className={`fixed inset-y-0 left-0 z-[500] border-r border-white/10 p-5 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] bg-gradient-to-b from-[#0b1121] to-[#020617] shadow-[25px_0_80px_rgba(0,0,0,0.9)] md:relative ${isNavVisible ? 'w-64' : 'w-20'}`}
      >
        <div className={`mb-8 flex items-center ${isNavVisible ? 'justify-between' : 'justify-center'}`}>
          <Logo settings={businessSettings} isOffline={isOffline} hideText={!isNavVisible} />
          {isNavVisible && (
            <button
              onClick={() => setIsNavExpanded(false)}
              className="text-slate-400 p-2 hover:bg-white/10 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="space-y-8 flex-1 overflow-y-auto custom-scrollbar pr-2 leading-none">
          <div>
            {isNavVisible && <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 px-1">Core Operations</p>}
            <nav className="space-y-2">
              <NavItem view="dashboard" icon={LayoutDashboard} label={isNavVisible ? "Insights" : ""} currentView={currentView} onClick={() => handleNavClick('dashboard')} />
              <NavItem view="billing" icon={ShoppingCart} label={isNavVisible ? "Terminal" : ""} currentView={currentView} onClick={() => handleNavClick('billing')} />
              <NavItem view="products" icon={Package} label={isNavVisible ? "Inventory" : ""} currentView={currentView} onClick={() => handleNavClick('products')} />
              <NavItem view="customers" icon={Users} label={isNavVisible ? "Customers" : ""} currentView={currentView} onClick={() => handleNavClick('customers')} />
              <NavItem view="whatsapp" icon={Bot} label={isNavVisible ? "AI Agent" : ""} currentView={currentView} onClick={() => handleNavClick('whatsapp')} />
            </nav>

          </div>

          <div>
            {isNavVisible && <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 px-1">Management</p>}
            <nav className="space-y-2">
              <NavItem view="suppliers" icon={Truck} label={isNavVisible ? "Supply Chain" : ""} currentView={currentView} onClick={() => handleNavClick('suppliers')} />
              <NavItem view="expenses" icon={Wallet} label={isNavVisible ? "Expenditure" : ""} currentView={currentView} onClick={() => handleNavClick('expenses')} />
              <NavItem view="marketing" icon={Send} label={isNavVisible ? "Marketing" : ""} currentView={currentView} onClick={() => handleNavClick('marketing')} />
            </nav>
          </div>
        </div>

        <div className="mt-auto pt-6 border-t border-white/10 space-y-2">
          <button
            onClick={() => handleNavClick('system')}
            title={!isNavVisible ? 'Database' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${currentView === 'system' ? 'bg-white/5 text-white' : 'text-slate-500 hover:text-white'} ${isNavVisible ? '' : 'justify-center'}`}
          >
            <Database size={16} />{isNavVisible && <span className="font-bold text-[9px] tracking-widest uppercase">Database</span>}
          </button>
          <button
            onClick={() => handleNavClick('settings')}
            title={!isNavVisible ? 'Settings' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${currentView === 'settings' ? 'bg-white/5 text-white' : 'text-slate-500 hover:text-white'} ${isNavVisible ? '' : 'justify-center'}`}
          >
            <Settings size={16} />{isNavVisible && <span className="font-bold text-[9px] tracking-widest uppercase">Settings</span>}
          </button>
          <button
            onClick={logout}
            title={!isNavVisible ? 'Sign Out' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:text-red-300 font-bold text-[9px] uppercase tracking-widest hover:bg-red-500/5 rounded-xl transition-all ${isNavVisible ? '' : 'justify-center'}`}
          >
            <LogOut size={16} />{isNavVisible && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 h-screen relative z-10 flex flex-col transition-all duration-300 bg-transparent overflow-hidden">
        {/* Liquid Background */}
        <div className="liquid-bg opacity-30 pointer-events-none">
          <div className="liquid-blob blob-1"></div>
          <div className="liquid-blob blob-2"></div>
          <div className="liquid-blob blob-3"></div>
        </div>

        {/* Top Header */}
        <header className="flex justify-between items-end p-6 pb-2 shrink-0 z-[400] relative bg-gradient-to-r from-blue-600/5 via-transparent to-indigo-600/5 bg-animate-gradient border-b border-white/5 shadow-2xl backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSidebar}
              className={`p-2 text-white bg-blue-600/20 border border-blue-500/30 rounded-xl hover:bg-blue-600/40 transition-all shadow-lg active:scale-95 group ${isNavVisible ? 'md:opacity-0 md:pointer-events-none' : 'opacity-100'}`}
            >
              <Menu size={20} className={`transition-transform duration-300 ${isNavVisible ? 'rotate-90' : ''}`} />
            </button>

            <div className="flex flex-col">
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-none tracking-tight text-glow">
                {viewTitles[currentView]}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[8px] font-black uppercase tracking-[0.2em] ${isOffline ? 'text-orange-500' : 'text-blue-400'}`}>
                  {isOffline ? <WifiOff size={8} /> : <Wifi size={8} />} {isOffline ? 'Offline' : 'Cloud Secure'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
              <p className="text-[9px] font-black text-blue-400 font-mono uppercase tracking-tight">{user?.email}</p>
            </div>
            <ThemeToggle />
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-white/10 flex items-center justify-center text-white font-black shadow-xl text-sm">
              {user?.name?.charAt(0) || 'A'}
            </div>
          </div>
        </header>

        {/* Dynamic View Content Area */}
        <div className="flex-1 min-h-0 flex flex-col p-4 pt-2 overflow-y-auto custom-scrollbar pb-24 relative z-10">
          {renderView()}
        </div>

        <GlobalCommander />
        <AutoResponder />
        <FirebaseMonitor />
      </main>

    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ActionProvider>
        <AppContent />
      </ActionProvider>
    </AuthProvider>
  );
}
