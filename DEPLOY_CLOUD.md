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
3.  **Instance Type**: Select **Free** (Scroll down if needed, Render defaults to 'Starter').
4.  **Region**: Choose the one closest to you.
5.  **Runtime**: Node
6.  **Build Command**: `npm install`
7.  **Start Command**: `node bot-server.js`

> [!IMPORTANT]
> **About the Render Free Tier**: 
> - It is **100% free** if you select the "Free" instance type. 
> - **Spin Down**: If there's no traffic for 15 minutes, the bot will go to sleep. To prevent this, use a free service like [Cron-job.org](https://cron-job.org/) or [UptimeRobot](https://uptimerobot.com/) to ping your Render URL `https://your-app.onrender.com/health` every 10 minutes.

## 4. Add Environment Variables
In the Render dashboard, go to the **Environment** tab and click **Add Environment Variable**. Add these from your local `.env`:
- `DATABASE_URL` (Use your Neon connection string)
- `GEMINI_API_KEY`
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WEBHOOK_VERIFY_TOKEN` (Exactly as it is in your `.env`)
- `PORT`: 10000 (Render uses this port by default)

## 5. Connect WhatsApp (QR Method)
If you use the QR code method:
1.  Check the **Logs** tab in Render.
2.  Wait for the QR code to appear in the text logs.
3.  Scan it with your phone.
4.  **Note**: The session might reset if Render restarts. For a more stable experience, use the "WhatsApp Cloud API" method.

## 6. Update Webhook URL (Cloud API Method)
If you use the WhatsApp Cloud API:
1.  Copy your Render service URL (e.g., `https://wr-pos-bot.onrender.com`).
2.  Go to the [Meta Developers Portal](https://developers.facebook.com/).
3.  Update the **Webhook URL** to `https://your-app.onrender.com/webhook`.
4.  The Meta Webhook will automatically "wake up" your Render service whenever a message arrives.

---
Your bot is now a truly global, always-on assistant!

## 7. Alternative Platforms (Free)

If Render doesn't suit you, here are two great alternatives:

### [Koyeb](https://www.koyeb.com/) (Recommended)
- **Free Tier**: Offers a "Nano" instance that runs 24/7 for free.
- **Setup**: Create a "Web Service", connect GitHub, and use `npm install` and `node bot-server.js`.
- **Pro**: No "sleeping" (spin down) on their free tier!

### [Railway](https://railway.app/)
- **Free Tier**: Offers $5 or 500 hours of free credits every month.
- **Setup**: "New Project" > "Deploy from GitHub". It builds automatically.
- **Pro**: Very fast deployment and excellent dashboard.
