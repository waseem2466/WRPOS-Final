<div align="center">
<img width="1200" height="475" alt="WR SMILE SUPPLIES" src="https://res.cloudinary.com/wrsmile/image/upload/v1765617036/wr_smile_supplies_products/yses6ycpqormspldap12.jpg" style="border-radius: 2rem;" />
</div>

# WR SMILE SUPPLIES - Professional POS & AI Agent

This is the Enterprise Resource Planning (ERP) and Point of Sale (POS) system for WR SMILE SUPPLIES, featuring a Neural Nexus AI Agent for automated customer service.

## Core Features
- **Professional POS**: Real-time inventory tracking and billing.
- **AI Agent (Neural Nexus)**: Automated WhatsApp support with business intelligence.
- **Cloud Sync**: PostgreSQL (Neon) integration with local offline caching.
- **Smart Billing**: Automatic PDF generation and WhatsApp receipt delivery.

## Running Locally

**Prerequisites:** Node.js (v18+) and a PostgreSQL database.

1. **Install dependencies:**
   `npm install`

2. **Configure Environment:**
   Create a `.env` file in the root with:
   - `DATABASE_URL`: Your PostgreSQL connection string.
   - `VITE_GEMINI_API_KEY`: Your Google AI API Key.
   - `WHATSAPP_TOKEN` & `WHATSAPP_PHONE_NUMBER_ID`: For Cloud API.

3. **Launch Development Environment:**
   `npm run electron:dev`

## Deployment & Building

To generate the **EXE installer** for Windows:
`npm run dist:win`

The installer will be generated in the `release/` directory.

---
*Powered by OpenClaw AI 🤖*
