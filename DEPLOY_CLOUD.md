# Deploying Your "Always Online" AI Bot

You can now host your AI bot on a cloud service so it stays online 24/7. Follow these steps:

## 1. Prerequisites
- A **GitHub** account (private repository recommended).
- A **Render** (render.com) or **Railway** (railway.app) account.

## 2. Push Code to GitHub
Push your project files to GitHub, including the new `bot-server.js`. 
> [!NOTE]
> Do NOT push your `.env` file or `data` folder to GitHub. These contain private keys and session data.

## 3. Create a Web Service on Render
1.  Go to [Render.com](https://render.com) and click **New > Web Service**.
2.  Connect your GitHub repository.
3.  **Environment**: Node
4.  **Build Command**: `npm install`
5.  **Start Command**: `node bot-server.js`

## 4. Add Environment Variables
In the Render dashboard, go to **Environment** and add the following variables from your local `.env`:
- `DATABASE_URL` (Use your Neon connection string)
- `GEMINI_API_KEY`
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WEBHOOK_VERIFY_TOKEN` (Exactly as it is in your `.env`)

## 5. Connect WhatsApp (QR Method)
If you use the QR code method:
1.  Check the **Logs** tab in Render.
2.  A QR code will appear in the text logs.
3.  Scan it with your phone just like you do locally.
4.  The session will be saved in a persistent disk (if configured) or maintained as long as the service is active.

## 6. Update Webhook URL (Cloud API Method)
If you use the WhatsApp Cloud API:
1.  Copy your Render service URL (e.g., `https://wr-pos-bot.onrender.com`).
2.  Go to the [Meta Developers Portal](https://developers.facebook.com/).
3.  Update the **Webhook URL** to `https://your-app.onrender.com/webhook`.

---
Your bot is now a truly global, always-on assistant!
