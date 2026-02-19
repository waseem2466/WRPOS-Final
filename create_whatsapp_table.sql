-- Create WhatsApp messages table
CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
    id TEXT PRIMARY KEY,
    from_number TEXT NOT NULL,
    to_number TEXT,
    text TEXT NOT NULL,
    type TEXT NOT NULL, -- 'incoming', 'outgoing'
    method TEXT NOT NULL, -- 'cloud', 'qr'
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster history retrieval
CREATE INDEX IF NOT EXISTS "idx_wa_msg_from" ON "WhatsAppMessage"(from_number);
CREATE INDEX IF NOT EXISTS "idx_wa_msg_ts" ON "WhatsAppMessage"(timestamp DESC);
