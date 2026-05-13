import React, { Suspense, lazy, useState, useEffect } from 'react';
import './index.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { db } from './services/mockDb';
import { BusinessSettings } from './types';
import {
  LayoutDashboard, ShoppingCart, Package, Users, Truck, LogOut,
  Settings, Loader2, Menu, X,
  Database, Send, Wallet, Wifi, WifiOff,
  Bot, ChevronRight, Wand2, ShieldCheck
} from 'lucide-react';


import { ActionProvider, useAction } from './context/ActionContext';
import { ThemeToggle } from './components/ui/ThemeToggle';

const Stats = lazy(() => import('./components/Stats').then((module) => ({ default: module.Stats })));
const ProductManager = lazy(() => import('./components/ProductManager').then((module) => ({ default: module.ProductManager })));
const BillingPOS = lazy(() => import('./components/BillingPOS').then((module) => ({ default: module.BillingPOS })));
const CustomerManager = lazy(() => import('./components/CustomerManager').then((module) => ({ default: module.CustomerManager })));
const SupplierManager = lazy(() => import('./components/SupplierManager').then((module) => ({ default: module.SupplierManager })));
const SettingsManager = lazy(() => import('./components/SettingsManager').then((module) => ({ default: module.SettingsManager })));
const MarketingHub = lazy(() => import('./components/MarketingHub').then((module) => ({ default: module.MarketingHub })));
const WarrantyManager = lazy(() => import('./components/WarrantyManager').then((module) => ({ default: module.WarrantyManager })));
const CRMDashboard = lazy(() => import('./components/CRMDashboard').then((module) => ({ default: module.CRMDashboard })));
const WhatsAppBotUI = lazy(() => import('./components/WhatsAppBotUI').then((module) => ({ default: module.WhatsAppBotUI })));
const ExpenseManager = lazy(() => import('./components/ExpenseManager').then((module) => ({ default: module.ExpenseManager })));
const SystemExplorer = lazy(() => import('./components/SystemExplorer').then((module) => ({ default: module.SystemExplorer })));
const GlobalCommander = lazy(() => import('./components/GlobalCommander').then((module) => ({ default: module.GlobalCommander })));
const AutoResponder = lazy(() => import('./components/AutoResponder').then((module) => ({ default: module.AutoResponder })));
const FirebaseMonitor = lazy(() => import('./components/FirebaseMonitor').then((module) => ({ default: module.FirebaseMonitor })));


type View = 'dashboard' | 'billing' | 'products' | 'customers' | 'crm' | 'suppliers' | 'expenses' | 'marketing' | 'warranty' | 'system' | 'settings' | 'whatsapp';


const viewTitles: Record<View, string> = {
  dashboard: "Insights",
  billing: "Terminal",
  products: "Inventory",
  customers: "Customers",
  crm: "CRM",
  suppliers: "Supply Chain",
  expenses: "Expenditure",
  marketing: "Marketing",
  warranty: "Warranty",
  system: "Database",
  settings: "Settings",
  whatsapp: "AI Agent"
};


const SHOP_LOGO = "https://res.cloudinary.com/wrsmile/image/upload/v1776608268/ChatGPT_Image_Apr_19_2026_07_38_26_PM_rn2v9r.png";

const Logo = ({ settings, isOffline, hideText }: { settings: BusinessSettings | null, isOffline: boolean, hideText?: boolean }) => (
  <div className={`flex items-center gap-2 p-2 rounded-xl ${hideText ? 'justify-center' : ''}`}>
    <div className="relative">
      <div className="w-11 h-11 bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md rounded-[1rem] flex items-center justify-center shadow-[0_18px_45px_rgba(0,0,0,0.35)] border border-white/15 overflow-hidden">
        <img src={SHOP_LOGO} alt="Logo" className="w-full h-full object-contain p-1" />
      </div>
      <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#0f172a] ${isOffline ? 'bg-orange-500' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`}></div>
    </div>
    {!hideText && (
      <div className="flex flex-col">
        <h1 className="text-sm font-black text-white leading-tight uppercase tracking-tight text-glow" style={{ fontFamily: 'var(--font-display)' }}>
          {settings?.businessName || 'WR POS'}
        </h1>
        <p className="text-[8px] text-blue-300/75 font-extrabold tracking-[0.24em] uppercase">Premium Edition v6.0</p>
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
    crm: 'CRM',
    whatsapp: 'AI Agent',
    suppliers: 'Supply Chain',
    expenses: 'Expenditure',
    marketing: 'Marketing',
    warranty: 'Warranty'
  };


  return (
    <button
      onClick={onClick}
      title={!label ? titles[view] : undefined}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-[1.15rem] tap-lift duration-300 group ${!label ? 'justify-center' : ''} ${currentView === view
        ? 'nav-liquid-active'
        : 'nav-liquid-idle'
        }`}
    >
      <Icon size={16} className="shrink-0" />
      {label && <span className="font-extrabold text-[10px] uppercase tracking-[0.22em] whitespace-nowrap overflow-hidden">{label}</span>}
    </button>
  );
};

const ViewLoader = () => (
  <div className="min-h-[320px] flex items-center justify-center rounded-[2rem] border border-white/10 bg-black/20">
    <div className="flex items-center gap-3 text-slate-300">
      <Loader2 className="animate-spin text-blue-400" size={20} />
      <span className="text-[11px] font-black uppercase tracking-[0.25em]">Loading module</span>
    </div>
  </div>
);

const AppBootScreen = ({ message, accent = 'text-blue-400' }: { message: string; accent?: string }) => (
  <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden">
    <div className="liquid-bg opacity-40 pointer-events-none">
      <div className="liquid-blob blob-1"></div>
      <div className="liquid-blob blob-2"></div>
      <div className="liquid-blob blob-3"></div>
    </div>
    <div className="glass-card rounded-[2.6rem] w-full max-w-lg p-8 md:p-10 relative z-10">
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-[1.8rem] bg-gradient-to-br from-slate-700/50 to-slate-900/70 border border-white/10 shadow-[0_30px_80px_rgba(2,6,23,0.55)] overflow-hidden flex items-center justify-center">
            <img src={SHOP_LOGO} alt="WR POS" className="w-full h-full object-contain p-2" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-[1rem] bg-[#091121] border border-white/10 flex items-center justify-center shadow-2xl">
            <Loader2 className={`animate-spin ${accent}`} size={16} />
          </div>
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.38em] text-blue-300 mb-3">WR POS Enterprise</p>
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3" style={{ fontFamily: 'var(--font-display)' }}>Launching Cloud Terminal</h1>
        <p className="text-sm text-slate-400 max-w-md leading-relaxed">{message}</p>
      </div>
    </div>
  </div>
);

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
      const validViews: View[] = ['dashboard', 'billing', 'products', 'customers', 'crm', 'suppliers', 'expenses', 'marketing', 'warranty', 'system', 'settings', 'whatsapp'];
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
      case 'crm': return <CRMDashboard />;
      case 'suppliers': return <SupplierManager />;
      case 'expenses': return <ExpenseManager />;
      case 'marketing': return <MarketingHub />;
      case 'warranty': return <WarrantyManager />;
      case 'system': return <SystemExplorer />;
      case 'settings': return <SettingsManager />;
      case 'whatsapp': return <WhatsAppBotUI />;
      default: return <Stats />;
    }

  };

  if (loading) return <AppBootScreen message="Restoring your secure operator session, syncing desktop credentials, and preparing the liquid workspace." />;
  if (!user) return <Login />;
  if (!isDbReady) return <AppBootScreen message="Connecting to your local and cloud data engines so billing, analytics, and messaging open in a ready state." accent="text-emerald-400" />;

  const isNavVisible = isNavExpanded;

  return (
    <div className="h-screen w-screen flex text-slate-200 relative overflow-hidden bg-[#020617]">
      <div className="liquid-bg opacity-80 pointer-events-none">
        <div className="liquid-blob blob-1"></div>
        <div className="liquid-blob blob-2"></div>
        <div className="liquid-blob blob-3"></div>
      </div>
      {/* --- SIDEBAR --- */}
      <aside
        className={`fixed inset-y-0 left-0 z-[500] border-r border-white/10 px-4 py-5 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] liquid-sidebar shadow-[25px_0_80px_rgba(0,0,0,0.55)] md:relative ${isNavVisible ? 'w-60 xl:w-64' : 'w-[5.25rem]'}`}
      >
        <div className={`mb-8 flex items-center ${isNavVisible ? 'justify-between' : 'justify-center'}`}>
          <Logo settings={businessSettings} isOffline={isOffline} hideText={!isNavVisible} />
          {isNavVisible && (
            <button
              onClick={() => setIsNavExpanded(false)}
              className="text-slate-400 p-2 tap-lift hover:bg-white/10 rounded-xl transition-all"
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
              <NavItem view="crm" icon={Wand2} label={isNavVisible ? "CRM" : ""} currentView={currentView} onClick={() => handleNavClick('crm')} />
              <NavItem view="whatsapp" icon={Bot} label={isNavVisible ? "AI Agent" : ""} currentView={currentView} onClick={() => handleNavClick('whatsapp')} />
            </nav>

          </div>

          <div>
            {isNavVisible && <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 px-1">Management</p>}
            <nav className="space-y-2">
              <NavItem view="suppliers" icon={Truck} label={isNavVisible ? "Supply Chain" : ""} currentView={currentView} onClick={() => handleNavClick('suppliers')} />
              <NavItem view="expenses" icon={Wallet} label={isNavVisible ? "Expenditure" : ""} currentView={currentView} onClick={() => handleNavClick('expenses')} />
              <NavItem view="warranty" icon={ShieldCheck} label={isNavVisible ? "Warranty" : ""} currentView={currentView} onClick={() => handleNavClick('warranty')} />
              <NavItem view="marketing" icon={Send} label={isNavVisible ? "Marketing" : ""} currentView={currentView} onClick={() => handleNavClick('marketing')} />
            </nav>
          </div>
        </div>

        <div className="mt-auto pt-6 border-t border-white/10 space-y-2">
          <button
            onClick={() => handleNavClick('system')}
            title={!isNavVisible ? 'Database' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-[1.15rem] tap-lift transition-all ${currentView === 'system' ? 'nav-liquid-active' : 'nav-liquid-idle'} ${isNavVisible ? '' : 'justify-center'}`}
          >
            <Database size={16} />{isNavVisible && <span className="font-bold text-[10px] tracking-[0.22em] uppercase">Database</span>}
          </button>
          <button
            onClick={() => handleNavClick('settings')}
            title={!isNavVisible ? 'Settings' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-[1.15rem] tap-lift transition-all ${currentView === 'settings' ? 'nav-liquid-active' : 'nav-liquid-idle'} ${isNavVisible ? '' : 'justify-center'}`}
          >
            <Settings size={16} />{isNavVisible && <span className="font-bold text-[10px] tracking-[0.22em] uppercase">Settings</span>}
          </button>
          <button
            onClick={logout}
            title={!isNavVisible ? 'Sign Out' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-3 text-red-300/80 hover:text-red-200 font-bold text-[10px] uppercase tracking-[0.22em] hover:bg-red-500/10 border border-transparent hover:border-red-400/10 rounded-[1.15rem] tap-lift transition-all ${isNavVisible ? '' : 'justify-center'}`}
          >
            <LogOut size={16} />{isNavVisible && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 h-screen relative z-10 flex flex-col transition-all duration-300 bg-transparent overflow-hidden">
        {/* Liquid Background */}
        <div className="liquid-bg opacity-35 pointer-events-none">
          <div className="liquid-blob blob-1"></div>
          <div className="liquid-blob blob-2"></div>
          <div className="liquid-blob blob-3"></div>
        </div>

        {/* Top Header */}
        <header className="shrink-0 z-[400] relative border-b border-white/10 shadow-2xl liquid-topbar">
          <div className="mx-auto w-full max-w-[1700px] px-5 sm:px-6 xl:px-8 pt-5 pb-4 flex justify-between items-end gap-4 bg-animate-gradient">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSidebar}
              className={`p-2.5 text-white bg-white/10 border border-white/15 rounded-[1rem] hover:bg-white/15 tap-lift transition-all shadow-lg group ${isNavVisible ? 'md:opacity-0 md:pointer-events-none' : 'opacity-100'}`}
            >
              <Menu size={20} className={`transition-transform duration-300 ${isNavVisible ? 'rotate-90' : ''}`} />
            </button>

            <div className="flex flex-col">
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-none tracking-tight text-glow" style={{ fontFamily: 'var(--font-display)' }}>
                {viewTitles[currentView]}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.07] border border-white/10 text-[8px] font-black uppercase tracking-[0.2em] shadow-inner ${isOffline ? 'text-orange-400' : 'text-blue-300'}`}>
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
            <div className="w-11 h-11 rounded-[1rem] bg-gradient-to-br from-white/16 to-white/5 border border-white/15 flex items-center justify-center text-white font-black shadow-xl text-sm">
              {user?.name?.charAt(0) || 'A'}
            </div>
          </div>
          </div>
        </header>

        {/* Dynamic View Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative z-10">
          <div className="mx-auto w-full max-w-[1700px] min-h-full flex flex-col px-5 sm:px-6 xl:px-8 pt-4 pb-20 gap-6">
            <Suspense fallback={<ViewLoader />}>
              {renderView()}
            </Suspense>
          </div>
        </div>

        <Suspense fallback={null}>
          <GlobalCommander />
          <AutoResponder />
          <FirebaseMonitor />
        </Suspense>
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
