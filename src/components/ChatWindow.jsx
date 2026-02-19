import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

export default function ChatWindow({ jid, messages }) {
  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!jid) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 bg-gray-50">
        Select a chat to start messaging.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 bg-white border-b font-semibold flex items-center justify-between shadow-sm sticky top-0 bg-white z-10">
        <span>{jid.replace('@s.whatsapp.net', '')}</span>
        {/* Placeholder for customer details or actions */}
        <div className="text-xs text-gray-500">Customer ID: {jid.split('@')[0]}</div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-3">
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {/* Element to scroll to */}
        <div ref={messagesEndRef} /> 
      </div>

      <MessageInput jid={jid} />
    </div>
  );
}
