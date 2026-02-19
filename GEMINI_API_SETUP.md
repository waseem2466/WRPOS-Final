# Gemini API Configuration Guide

## Your API Client ID
**Client ID**: `gen-lang-client-0279508785`

## How to Configure in WR POS

### Option 1: Update .env file directly
Add this line to your `.env` file:
```
VITE_GEMINI_API_KEY=gen-lang-client-0279508785
```

### Option 2: Use Environment Variable
Set in your system:
```bash
export VITE_GEMINI_API_KEY=gen-lang-client-0279508785
```

### Option 3: Runtime Configuration
The AI service will automatically pick up this client ID when:
1. The .env file contains the key
2. The application restarts
3. The AI service initializes

## Testing the Configuration
After setting up, test with:
```bash
npm run electron:dev
```
Check the console for:
```
[AI SERVICE] Initialization. Gemini Key Present: true
[AI SERVICE] Gemini Engine initialized.
```

## Supported Models
With this client ID, you can use:
- `gemini-1.5-pro` (recommended)
- `gemini-pro` (fallback)
- `gemini-1.5-flash` (if available)

## Troubleshooting
If you see "models/gemini-1.5-flash is not found":
- The system will automatically fallback to `gemini-pro`
- Check your Google Cloud Console for available models
- Ensure billing is enabled on your Google Cloud project

## Next Steps
1. Add the API key to your .env file
2. Restart the application
3. Test AI functionality in the dashboard
4. Verify WhatsApp AI responses are working
