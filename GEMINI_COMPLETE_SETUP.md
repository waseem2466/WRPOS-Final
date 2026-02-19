# Gemini API Configuration - COMPLETE SETUP

## Your Gemini API Credentials
- **Client ID**: `gen-lang-client-0175952871`
- **API Key**: `AIzaSyCKya9NRPcJ9nGuiXq3Tp_G8XDfkkZ4dos`

## Quick Setup Instructions

### Step 1: Update Your .env File
Replace your current `.env` file content with:

```env
# Google Gemini AI Configuration  
VITE_GEMINI_API_KEY=AIzaSyCKya9NRPcJ9nGuiXq3Tp_G8XDfkkZ4dos

# Database (add your actual database URL)
DATABASE_URL=your_postgresql_connection_string

# WhatsApp (add your credentials if available)
WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id

# Other settings
NODE_ENV=development
JWT_SECRET=your_jwt_secret_here
```

### Step 2: Restart Application
```bash
npm run electron:dev
```

### Step 3: Verify AI is Working
Check console for:
```
[AI SERVICE] Initialization. Gemini Key Present: true
[AI SERVICE] Gemini Engine initialized.
```

## What This Fixes
✅ **404 Model Errors**: The correct API key will resolve "model not found" errors  
✅ **AI Responses**: WhatsApp bot and dashboard AI will work  
✅ **Fallback System**: Auto-switches between models if needed  
✅ **Error Handling**: Better error messages for debugging  

## Testing the AI
1. Go to **Dashboard** → Try AI insights
2. Go to **WhatsApp AI Agent** → Send test message  
3. Check console for successful API calls

## Security Notes
- ⚠️ **Never commit API keys to git**
- 🔒 **Keep .env file private**
- 🔄 **Rotate keys periodically**
- 📝 **Document key usage in your project**

## Troubleshooting
If AI still doesn't work:
1. Verify Google Cloud billing is enabled
2. Check Gemini API is enabled in your project
3. Ensure client ID matches: `gen-lang-client-0175952871`
4. Test API key in Google AI Studio first

Your WR POS AI should now be fully functional! 🚀
