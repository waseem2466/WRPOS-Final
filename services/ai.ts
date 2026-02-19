import { AIConfig } from "../types";
import { errorHandler } from './errorHandler';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- CONFIGURATION ---
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const OLLAMA_CLOUD_API_KEY = import.meta.env.VITE_OLLAMA_CLOUD_API_KEY || "";
const OLLAMA_CLOUD_MODEL = import.meta.env.VITE_OLLAMA_CLOUD_MODEL || "gpt-oss:120b-cloud";

// Models (Standard Google AI Studio models)
const GEMINI_MODEL = "gemini-2.0-flash"; // Using 2.0 Flash as it is current stable free tier workhorse
const GEMINI_MODEL_IMAGE = "gemini-pro-vision"; // Or compatible vision model

// Default Config
const DEFAULT_CONFIG: AIConfig = {
  provider: 'gemini',
};

const getDefaultProvider = (): 'gemini' | 'local-phi' => {
  // Browser mode (no Electron preload): use Gemini
  if (typeof window === 'undefined') return 'gemini';
  if (!window.electronAPI?.askAI) return 'gemini';
  // Electron mode: prefer local model for cost/offline
  return 'local-phi';
};


export const loadAIConfig = (): AIConfig => {
  try {
    const saved = localStorage.getItem('wr_pos_ai_config');
    if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
  } catch (e: unknown) {
    errorHandler.log('AI', e instanceof Error ? e : new Error(String(e)), { operation: 'loadAIConfig' }, 'low');
  }
  return DEFAULT_CONFIG;
};

let currentConfig = loadAIConfig();

export const saveAIConfig = (config: AIConfig) => {
  localStorage.setItem('wr_pos_ai_config', JSON.stringify(config));
  currentConfig = config;
};

export const getAIEngine = () => currentConfig.provider;

/**
 * Google AI Studio Calls (Free Tier)
 */
async function callGemini(prompt: string, modelName?: string): Promise<string> {
  try {
    if (!API_KEY) throw new Error("Gemini API Key is missing. Check .env VITE_GEMINI_API_KEY");

    const model = genAI.getGenerativeModel({ model: modelName || GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (err: any) {
    throw new Error(`Google AI Error: ${err.message}`);
  }
}

async function callGeminiVision(prompt: string, imageBase64: string, modelName?: string): Promise<string> {
  try {
    if (!API_KEY) throw new Error("Gemini API Key is missing");

    const model = genAI.getGenerativeModel({ model: modelName || GEMINI_MODEL }); // Use 2.0 Flash for vision too

    // Remove header if present in base64
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|webp);base64,/, "");

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: cleanBase64,
          mimeType: "image/jpeg",
        },
      },
    ]);
    const response = await result.response;
    return response.text();
  } catch (err: any) {
    throw new Error(`Google Vision Error: ${err.message}`);
  }
}

export async function generateNanoBananaImage(prompt: string): Promise<string> {
  try {
    console.log(`[AI] Generating Image via Pollinations (Free): ${prompt}`);
    const safePrompt = encodeURIComponent(prompt.substring(0, 200));
    const response = await fetch(`https://image.pollinations.ai/prompt/${safePrompt}`);

    if (!response.ok) throw new Error("Pollinations API failed");

    // Convert blob to base64
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        // Return raw base64 without prefix (VisionLab adds the prefix)
        resolve(base64data.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err: any) {
    console.error("Free Image Gen Failed:", err);
    throw new Error(`Free Image Gen Error: ${err.message}`);
  }
}

export async function callGeminiLive(input: any) {
  // Placeholder for real-time logic
  return null;
}


/**
 * Call Ollama Cloud API
 */



async function callOllamaCloud(prompt: string, model?: string): Promise<string> {
  if (!OLLAMA_CLOUD_API_KEY) throw new Error("Ollama Cloud API key missing.");

  const response = await fetch("https://ollama.com/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OLLAMA_CLOUD_API_KEY}`
    },
    body: JSON.stringify({
      model: model || OLLAMA_CLOUD_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: false
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama Cloud Error: ${errText}`);
  }

  try {
    const data = await response.json();
    return data?.message?.content || "";
  } catch (e) {
    return "";
  }
}

/**
 * Call Local Phi-3 via Electron IPC
 */
async function callLocalAI(prompt: string, model?: string): Promise<string> {
  if (!window.electronAPI?.askAI) {
    throw new Error("Electron API not available. Are you running in browser mode?");
  }
  return await window.electronAPI.askAI(prompt, model);
}

/**
 * Enterprise AI Router with Failover Chain
 * Gemini -> DeepSeek -> Ollama Cloud -> Local Phi
 */
/**
 * Enterprise AI Router - Optimized for Offline First
 */
export const generateAiContent = async (
  prompt: string,
  options: string | { provider?: string; model?: string } = getDefaultProvider()
): Promise<string> => {
  const config = typeof options === 'string' ? { provider: options } : options;
  const provider = (config.provider || getDefaultProvider()) as 'gemini' | 'local-phi' | 'ollama-cloud' | 'ollama';
  const realProvider = provider === 'ollama' ? 'local-phi' : provider;

  const model = config.model || (
    realProvider === 'gemini' ? GEMINI_MODEL :
      realProvider === 'local-phi' ? 'phi3' :
        OLLAMA_CLOUD_MODEL
  );

  try {
    errorHandler.log('AI', new Error(`Requesting AI: ${realProvider} (${model})`), { operation: 'generateAiContent' }, 'low');

    let response = '';

    if (realProvider === 'gemini') {
      if (config.imageBase64) {
        response = await callGeminiVision(prompt, config.imageBase64, model);
      } else {
        response = await callGemini(prompt, model);
      }
    } else if (realProvider === 'local-phi') {
      response = await callLocalAI(prompt, model);
    } else if (realProvider === 'ollama-cloud') {
      response = await callOllamaCloud(prompt, model);
    } else {
      throw new Error(`Unknown provider: ${realProvider}`);
    }

    // 2. Cloud Sync (Firebase History)
    const { cloudDb } = await import('./cloudDb');
    const logId = `ai-${Date.now()}`;
    await cloudDb.syncToCloud('aiHistory', logId, {
      prompt: prompt.substring(0, 500), // Truncate for storage
      response: response.substring(0, 500),
      provider,
      model,
      timestamp: new Date().toISOString()
    });

    return response;

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    errorHandler.log('AI', error, { operation: 'generateAiContent', provider }, 'medium');

    // Failover Logic: If Gemini fails, try Local Phi
    if (provider === 'gemini') {
      console.warn("Gemini failed, falling back to local-phi...");
      return await generateAiContent(prompt, 'local-phi');
    }

    throw error;
  }

};

export const generateBusinessInsight = async (
  todaySales: number,
  customerCount: number,
  lowStockItems: string[]
): Promise<string> => {
  const lowStockList = lowStockItems.length > 0 ? lowStockItems.map(item => `- ${item}`).join('\n') : "None";

  const prompt = `
You are a POS AI assistant.

Today's Sales: ${todaySales}
Total Customers: ${customerCount}

Low Stock Items:
${lowStockList}

Give short restock suggestion and business insight.
`;

  return generateAiContent(prompt, { provider: getDefaultProvider(), model: 'phi3' });
};

export const parseUserIntent = async (input: string): Promise<{ type: string; payload: unknown }> => {
  const systemPrompt = `Analyze input and return ONLY JSON. ACTIONS: NAVIGATE, BILLING_ADD, INVENTORY_SEARCH, CUSTOMER_SEARCH, ANALYTICS. Input: "${input}"`;
  try {
    const response = await generateAiContent(systemPrompt, { provider: getDefaultProvider() });
    // Robust sanitization: remove markdown code blocks and whitespace
    const jsonStr = response.replace(/```(json)?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (err) {
    return { type: 'UNKNOWN', payload: { reason: 'AI Error or Invalid JSON' } };
  }
};
