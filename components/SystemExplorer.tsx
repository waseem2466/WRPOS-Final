
import React, { useState, useEffect } from 'react';
import { GlassCard } from './ui/GlassCard';
import { GlassButton } from './ui/GlassButton';
import { db } from '../services/mockDb';
import { Database, Play, Terminal, Table as TableIcon, AlertTriangle, CheckCircle, Clock, Save, Copy, Zap, Code, PlusCircle, RefreshCw, LayoutGrid, FileJson, Trash2, Download, ExternalLink } from 'lucide-react';

interface SQLTemplate {
  name: string;
  description: string;
  query: string;
  icon: any;
}

export const SystemExplorer: React.FC = () => {
  const [query, setQuery] = useState('SELECT * FROM products LIMIT 10;');
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [tableStats, setTableStats] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  
  const tables = ['products', 'customers', 'bills', 'suppliers', 'expenses', 'returns', 'monthly_summaries', 'purchase_orders', 'payments', 'settings'];

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const stats = await db.getTableStats();
    setTableStats(stats);
  };

  const templates: SQLTemplate[] = [
    {
      name: 'System Schema Blueprint',
      description: 'Review the current PostgreSQL table definitions.',
      icon: Code,
      query: `-- NEON POSTGRES SCHEMA BLUEPRINT\n\n` +
             `CREATE TABLE IF NOT EXISTS products (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name TEXT, category TEXT, cost_price NUMERIC, price NUMERIC, stock INTEGER);\n` +
             `CREATE TABLE IF NOT EXISTS customers (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name TEXT, phone TEXT, balance NUMERIC DEFAULT 0);\n` +
             `CREATE TABLE IF NOT EXISTS bills (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, customer_id BIGINT, total NUMERIC, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), invoice_number TEXT UNIQUE);`
    },
    {
      name: 'Inventory Health Check',
      description: 'Identify items with critically low stock level.',
      icon: AlertTriangle,
      query: `SELECT name, stock, category FROM products WHERE stock < 5 ORDER BY stock ASC;`
    },
    {
      name: 'Credit Risk Analysis',
      description: 'List Top 10 customers with the highest outstanding debt.',
      icon: Zap,
      query: `SELECT name, phone, balance FROM customers WHERE balance > 0 ORDER BY balance DESC LIMIT 10;`
    },
    {
      name: 'Sales Volume Audit',
      description: 'Total revenue aggregated by customer for current month.',
      icon: FileJson,
      query: `SELECT c.name as customer_name, SUM(b.total) as total_spent \nFROM bills b \nJOIN customers c ON b.customer_id = c.id \nWHERE b.archived = FALSE \nGROUP BY c.name \nORDER BY total_spent DESC;`
    }
  ];

  const executeQuery = async (customQuery?: string) => {
    const queryToRun = customQuery || query;
    if (!queryToRun.trim()) return;

    setIsLoading(true);
    setError(null);
    setResults(null);
    const start = performance.now();

    try {
      const data = await db.executeRaw(queryToRun);
      setResults(Array.isArray(data) ? data : [data]);
      setExecutionTime(performance.now() - start);
      if (!queryToRun.toLowerCase().startsWith('select')) {
        await loadStats();
      }
    } catch (err: any) {
      const msg = err?.message || String(err) || 'An unknown error occurred during execution.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!results || results.length === 0) return;
    const headers = Object.keys(results[0]).join(',');
    const rows = results.map(row => 
      Object.values(row).map(val => 
        typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
      ).join(',')
    ).join('\n');
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `neon_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const peekTable = (tableName: string) => {
    const q = `SELECT * FROM ${tableName} LIMIT 50;`;
    setQuery(q);
    executeQuery(q);
  };

  return (
    <div className="h-full flex flex-col lg:overflow-hidden overflow-y-auto custom-scrollbar">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 animate-in fade-in duration-700 p-1">
        
        {/* Sidebar: Independently scrollable on desktop */}
        <div className="lg:col-span-3 space-y-6 lg:h-full lg:overflow-y-auto custom-scrollbar lg:pr-2 lg:pb-0 pb-4">
          <GlassCard className="border-blue-500/10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Database size={14} className="text-blue-400" /> Cloud Registry
              </h3>
              <button onClick={loadStats} className="text-gray-600 hover:text-white transition-colors">
                <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="space-y-2">
              {tables.map(table => (
                <button
                  key={table}
                  onClick={() => peekTable(table)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <TableIcon size={14} className="text-gray-500 group-hover:text-blue-400" />
                    <span className="text-[11px] font-bold text-gray-400 group-hover:text-white uppercase tracking-tight">{table}</span>
                  </div>
                  <span className="text-[9px] font-black text-gray-700 group-hover:text-blue-500 font-mono">
                    {tableStats[table] ?? '-'}
                  </span>
                </button>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="border-purple-500/10">
            <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <Zap size={14} className="text-purple-400" /> Console Snippets
            </h3>
            <div className="space-y-3">
              {templates.map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(tpl.query); }}
                  className="w-full text-left p-3 rounded-xl bg-white/5 border border-white/5 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group"
                >
                  <div className="flex items-center gap-3 mb-1">
                    <tpl.icon size={14} className="text-purple-400" />
                    <span className="text-[10px] font-black text-white uppercase">{tpl.name}</span>
                  </div>
                  <p className="text-[9px] text-gray-500 font-bold leading-tight line-clamp-2 uppercase tracking-tighter">{tpl.description}</p>
                </button>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Main Editor: Independently scrollable on desktop */}
        <div className="lg:col-span-9 flex flex-col lg:h-full min-h-[600px] pb-4 lg:pb-0">
          <GlassCard className="flex-1 flex flex-col overflow-hidden border-white/5 p-0 bg-black/40 shadow-2xl rounded-[2rem]">
            <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-500 shadow-xl border border-blue-500/10">
                  <Terminal size={18} />
                </div>
                <div>
                  <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Neon-Postgres v16 Console</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest">Live Cloud Connection</p>
                  </div>
                </div>
              </div>
              <GlassButton onClick={() => executeQuery()} disabled={isLoading} className="py-2.5 px-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-[10px] font-black tracking-[0.2em] flex items-center gap-2">
                {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                EXECUTE SQL
              </GlassButton>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col relative">
              <div className="flex-1 min-h-[350px]">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full h-full bg-[#0b1121] text-blue-400 font-mono text-sm p-8 outline-none focus:ring-0 resize-none placeholder-gray-800 leading-relaxed"
                  placeholder="-- Execute PostgreSQL statements..."
                  spellCheck={false}
                />
              </div>

              {(results || error) && (
                <div className="border-t border-white/5 bg-black/60 p-6 animate-in slide-in-from-bottom duration-500 shrink-0">
                   <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-6">
                        {error ? <div className="text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><AlertTriangle size={16} /> Syntax Error</div> : <div className="text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><CheckCircle size={16} /> Success</div>}
                        {executionTime && <div className="text-gray-600 text-[9px] font-black uppercase tracking-widest">Latency: {executionTime.toFixed(2)}ms</div>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setViewMode(viewMode === 'table' ? 'json' : 'table')} className="p-2 bg-white/5 rounded-xl text-gray-400 hover:text-white">{viewMode === 'table' ? <FileJson size={16} /> : <LayoutGrid size={16} />}</button>
                        {results && results.length > 0 && <button onClick={exportToCSV} className="bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Download size={14} /> Export</button>}
                      </div>
                   </div>

                   {error ? <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 font-mono text-xs text-red-400 leading-relaxed">{String(error)}</div> : (
                     viewMode === 'table' && results && results.length > 0 ? (
                       <div className="overflow-x-auto rounded-2xl border border-white/5 max-h-[400px] custom-scrollbar bg-black/40">
                          <table className="w-full text-[10px] text-left border-collapse">
                            <thead className="bg-white/10 text-gray-400 font-black uppercase tracking-widest sticky top-0 backdrop-blur-xl">
                              <tr>{Object.keys(results[0]).map(key => <th key={key} className="px-6 py-4 border-b border-white/10">{key}</th>)}</tr>
                            </thead>
                            <tbody className="text-gray-400 font-mono">
                              {results.map((row, idx) => (
                                <tr key={idx} className="border-b border-white/5 hover:bg-blue-500/5">
                                  {Object.values(row).map((val: any, vIdx) => <td key={vIdx} className="px-6 py-4 max-w-sm truncate text-blue-300/80">{typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '')}</td>)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                       </div>
                     ) : <pre className="p-8 rounded-2xl bg-[#0b1121] border border-white/5 text-blue-300 font-mono text-[11px] overflow-auto max-h-[400px] custom-scrollbar">{JSON.stringify(results, null, 4)}</pre>
                   )}
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
