import React, { useMemo, useState } from 'react';
import { MessageSquare, Send, Sparkles, X, Wifi, WifiOff } from 'lucide-react';
import { GlassCard } from './ui/GlassCard';
import { GlassInput } from './ui/GlassInput';
import { GlassButton } from './ui/GlassButton';
import type { BusinessSettings } from '../types';
import { whatsappService } from '../services/whatsapp';
import { generateAiContent } from '../services/ai';
import { cleanPhone } from '../services/utils';

interface WhatsAppQuickPanelProps {
  open: boolean;
  onClose: () => void;
  settings: BusinessSettings | null;
}

export const WhatsAppQuickPanel: React.FC<WhatsAppQuickPanelProps> = ({ open, onClose, settings }) => {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channel = useMemo(() => {
    if (settings?.waAccessToken && settings?.waPhoneNumberId) return 'cloud';
    return 'qr';
  }, [settings?.waAccessToken, settings?.waPhoneNumberId]);

  const canSend = useMemo(() => {
    const cleaned = cleanPhone(phone);
    return Boolean(cleaned) && Boolean(message.trim()) && Boolean(settings);
  }, [phone, message, settings]);

  const handleAIDraft = async () => {
    if (!settings) return;
    setIsDrafting(true);
    setError(null);
    try {
      const prompt = `Write a short professional WhatsApp message for a customer.\n\nBusiness: ${settings.businessName}\nAddress: ${settings.address}\n\nGoal: ${message.trim() ? message.trim() : 'General customer update'}\n\nRules:\n- Under 60 words\n- Friendly and clear\n- No markdown\n- Use Sri Lanka Rupee as LKR when mentioning prices\n\nReturn only the message.`;
      const text = await generateAiContent(prompt);
      setMessage(text.trim());
    } catch (e: any) {
      setError(e?.message || 'AI drafting failed');
    } finally {
      setIsDrafting(false);
    }
  };

  const handleSend = async () => {
    if (!settings) return;
    setIsSending(true);
    setError(null);
    try {
      const result = await whatsappService.sendDirect(settings, phone, message);
      if (result.success) {
        setMessage('');
      } else {
        setError(result.error || 'Send failed');
      }
    } catch (e: any) {
      setError(e?.message || 'Send failed');
    } finally {
      setIsSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
      <GlassCard className="w-full max-w-xl bg-[#0b1121] border border-white/10 rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-6 shadow-3xl max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">WhatsApp Quick Send</h3>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                {channel === 'cloud' ? <Wifi size={10} className="text-purple-400" /> : <WifiOff size={10} className="text-blue-400" />}
                Channel: {channel === 'cloud' ? 'Cloud API' : 'Baileys QR'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white rounded-xl transition-all"
            aria-label="Close WhatsApp panel"
          >
            <X size={18} />
          </button>
        </div>

        {!settings && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-[10px] text-red-300 font-bold uppercase tracking-widest mb-4">
            Settings not loaded. Please open Settings and save Business Settings.
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-[10px] text-red-300 font-bold uppercase tracking-widest mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <GlassInput
            label="Customer Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="9477xxxxxxx"
            required
          />

          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
              Message
            </label>
            <button
              onClick={handleAIDraft}
              disabled={!settings || isDrafting}
              className="flex items-center gap-2 text-[9px] font-black text-blue-400 uppercase tracking-widest hover:text-white disabled:opacity-50"
              title="AI Draft"
            >
              <Sparkles size={12} className={isDrafting ? 'animate-pulse' : ''} />
              {isDrafting ? 'Drafting...' : 'AI Draft'}
            </button>
          </div>

          <textarea
            className="glass-input rounded-2xl px-5 py-4 text-xs font-medium text-gray-300 outline-none min-h-[160px] resize-none leading-relaxed"
            placeholder="Type message or write goal then press AI Draft..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-2">
            <GlassButton variant="secondary" onClick={onClose}>
              Close
            </GlassButton>
            <GlassButton
              variant="success"
              onClick={handleSend}
              disabled={!canSend || isSending}
            >
              <Send size={14} />
              {isSending ? 'Sending...' : 'Send'}
            </GlassButton>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
