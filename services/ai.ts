import { AIConfig, AIProvider } from "../types";
import { errorHandler } from './errorHandler';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { cloudDb } from './cloudDb';
import { createWorker, type Worker } from 'tesseract.js';

// --- CONFIGURATION ---
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const OLLAMA_CLOUD_API_KEY = import.meta.env.VITE_OLLAMA_CLOUD_API_KEY || "";
const OLLAMA_CLOUD_MODEL = import.meta.env.VITE_OLLAMA_CLOUD_MODEL || "gpt-oss:120b-cloud";
const LOCAL_OLLAMA_MODEL = import.meta.env.VITE_LOCAL_OLLAMA_MODEL || "qwen2.5:3b";
const LOCAL_OLLAMA_VISION_MODEL = import.meta.env.VITE_LOCAL_OLLAMA_VISION_MODEL || "qwen2.5vl:3b";
const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_BASE_URL || import.meta.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";
const ZHIPU_AI_API_KEY = import.meta.env.VITE_ZHIPU_AI_API_KEY || "";
let ocrWorkerPromise: Promise<Worker> | null = null;

// Models (Standard Google AI Studio models)
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.0-flash"; // Fast default for business insights.
const GEMINI_MODEL_IMAGE = "gemini-pro-vision"; // Or compatible vision model

const GROQ_MODEL = "llama3-70b-8192";
const ZHIPU_MODEL = "glm-4";

// Default Config
const DEFAULT_CONFIG: AIConfig = {
  provider: 'local-phi',
  model: LOCAL_OLLAMA_MODEL,
};

const getDefaultProvider = (): AIProvider => {
  return 'auto';
};


export const loadAIConfig = (): AIConfig => {
  try {
    const saved = localStorage.getItem('wr_pos_ai_config');
    if (saved) {
      const parsed = { ...DEFAULT_CONFIG, ...JSON.parse(saved) } as AIConfig;
      if (!parsed.model || parsed.model === 'phi3:latest') {
        parsed.model = LOCAL_OLLAMA_MODEL;
      }
      if (parsed.provider === 'auto') {
        parsed.provider = 'local-phi';
      }
      return parsed;
    }
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

const canUseLocalAI = () =>
  typeof window !== 'undefined' && typeof window.electronAPI?.askAI === 'function';

const providerAvailable = (provider: AIProvider): boolean => {
  if (provider === 'auto') return true;
  if (provider === 'local-phi') return canUseLocalAI();
  if (provider === 'gemini') return Boolean(API_KEY);
  if (provider === 'groq') return Boolean(GROQ_API_KEY);
  if (provider === 'zhipu') return Boolean(ZHIPU_AI_API_KEY);
  if (provider === 'ollama-cloud') return Boolean(OLLAMA_CLOUD_API_KEY);
  return false;
};

const buildProviderChain = (preferred: AIProvider): AIProvider[] => {
  const chain: AIProvider[] = [];
  const add = (provider: AIProvider) => {
    if (provider !== 'auto' && providerAvailable(provider) && !chain.includes(provider)) {
      chain.push(provider);
    }
  };

  add(preferred);
  add('local-phi');
  add('gemini');
  add('groq');
  add('zhipu');
  add('ollama-cloud');

  return chain;
};

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

async function callGroq(prompt: string, modelName?: string): Promise<string> {
  if (!GROQ_API_KEY) throw new Error('Groq API Key is missing. Check .env VITE_GROQ_API_KEY');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelName || GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq AI Error: ${errText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
}


/**
 * Build a simple JWT token for ZhipuAI
 */
function buildZhipuToken(apiKey: string): string {
  const [id, secret] = apiKey.split('.');
  if (!id || !secret) throw new Error('Invalid ZhipuAI key format. Expected: id.secret');

  try {
    // In-browser JWT signing using crypto API
    const header = { alg: 'HS256', sign_type: 'SIGN' };
    const now = Date.now();
    const payload = { api_key: id, exp: now + 3600000, timestamp: now };

    const base64UrlEncode = (obj: any) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    // We cannot easily do HMAC-SHA256 sync in the browser without async WebCrypto.
    // However, ZhipuAI's API actually accepts the raw API key as the Bearer token in most of their newer V4 endpoints.
    // Given the previous code was returning \`apiKey\` as well, we will stick to passing the raw apiKey,
    // which testing confirms works for the glm-4-flash endpoint.
    return apiKey;
  } catch (e) {
    return apiKey;
  }
}

async function callZhipu(prompt: string, modelName?: string): Promise<string> {
  if (!ZHIPU_AI_API_KEY) throw new Error('Zhipu AI API Key is missing. Check .env VITE_ZHIPU_AI_API_KEY');

  const token = buildZhipuToken(ZHIPU_AI_API_KEY);

  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: modelName || 'glm-4-flash', // glm-4-flash is the free-tier model
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Zhipu AI Error: ${errText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
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

async function callLocalOllamaVision(prompt: string, imageBase64: string, modelName?: string): Promise<string> {
  const model = modelName || LOCAL_OLLAMA_VISION_MODEL;
  const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

  const tagsResponse = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
  if (!tagsResponse.ok) {
    throw new Error('Local Ollama is not reachable for vision.');
  }

  const tagsData = await tagsResponse.json();
  const availableModels = Array.isArray(tagsData?.models) ? tagsData.models.map((item: any) => String(item?.name || '').trim()) : [];
  if (!availableModels.includes(model)) {
    throw new Error(`Local vision model ${model} is not installed in Ollama.`);
  }

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      images: [cleanBase64],
      stream: false,
      options: {
        temperature: 0.1,
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Local Ollama vision failed: ${errText}`);
  }

  const data = await response.json();
  return String(data?.response || '').trim();
}

async function getOcrWorker(): Promise<Worker> {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const worker = await createWorker('eng');
      return worker;
    })();
  }
  return ocrWorkerPromise;
}

async function extractTextFromImageLocally(imageBase64: string): Promise<string> {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(imageBase64);
  return String(data?.text || '').trim();
}

async function structureBillTextWithLocalAI(rawText: string): Promise<string> {
  const prompt = `
You are helping a POS system read OCR text from a supplier bill.

From the OCR text below, extract the clearest single product entry and return ONLY valid JSON.
If multiple products exist, choose the line with the best visible product name, quantity, and price.
Do not include markdown or explanation.

Required JSON shape:
{
  "name": "string",
  "category": "string",
  "cost": 0,
  "price": 0,
  "stock": 0,
  "sku": "string",
  "barcode": "string",
  "description": "string"
}

Rules:
- "cost" = unit buying cost if visible
- "price" = selling price if visible, otherwise estimate slightly above cost
- "stock" = received quantity
- Keep missing text fields as ""
- Keep missing numbers as 0
- Use short category names
- Description should be one short product summary

OCR TEXT:
${rawText.slice(0, 5000)}
`;

  return await callLocalAI(prompt, LOCAL_OLLAMA_MODEL);
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

export async function extractInventoryItemFromBill(imageBase64: string): Promise<{
  name?: string;
  category?: string;
  cost?: number;
  price?: number;
  stock?: number;
  sku?: string;
  barcode?: string;
  description?: string;
}> {
  const prompt = `
You are reading a supplier bill or purchase invoice image for a POS inventory system.

Extract the clearest single product entry from the bill and return ONLY valid JSON.
If multiple products exist, choose the most complete line item with a visible name, quantity, and price.
Do not include markdown or explanation.

Required JSON shape:
{
  "name": "string",
  "category": "string",
  "cost": 0,
  "price": 0,
  "stock": 0,
  "sku": "string",
  "barcode": "string",
  "description": "string"
}

Rules:
- "cost" = unit purchase cost
- "price" = suggested selling price if visible, otherwise estimate a reasonable selling price above cost
- "stock" = quantity from the bill
- Keep missing text fields as ""
- Keep missing numbers as 0
- Use short POS-friendly category names
- Description should be one short product summary
`;

  let response = '';
  let lastError: unknown = null;

  try {
    response = await callLocalOllamaVision(prompt, imageBase64, LOCAL_OLLAMA_VISION_MODEL);
  } catch (localVisionError) {
    lastError = localVisionError;
    try {
      const ocrText = await extractTextFromImageLocally(imageBase64);
      if (!ocrText || ocrText.length < 10) {
        throw new Error('OCR could not read enough text from the bill image.');
      }
      response = await structureBillTextWithLocalAI(ocrText);
    } catch (ocrError) {
      lastError = ocrError;
      if (!API_KEY) {
        throw new Error(
          `Local bill-image AI is not ready: ${ocrError instanceof Error ? ocrError.message : String(ocrError)}`
        );
      }
    }
  }

  if (!response) {
    try {
      response = await callGeminiVision(prompt, imageBase64, GEMINI_MODEL);
    } catch (geminiError) {
      const localMsg = lastError instanceof Error ? lastError.message : String(lastError || '');
      const geminiMsg = geminiError instanceof Error ? geminiError.message : String(geminiError);
      throw new Error(localMsg ? `Local vision failed: ${localMsg}. Gemini fallback failed: ${geminiMsg}` : geminiMsg);
    }
  }

  const jsonStr = response.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(jsonStr);

  return {
    name: String(parsed?.name || '').trim(),
    category: String(parsed?.category || 'General').trim() || 'General',
    cost: Number(parsed?.cost || 0),
    price: Number(parsed?.price || 0),
    stock: Number(parsed?.stock || 0),
    sku: String(parsed?.sku || '').trim(),
    barcode: String(parsed?.barcode || '').trim(),
    description: String(parsed?.description || '').trim(),
  };
}


/**
 * Call Ollama Cloud API
 * Uses the official Ollama Cloud API endpoint
 */
async function callOllamaCloud(prompt: string, model?: string): Promise<string> {
  if (!OLLAMA_CLOUD_API_KEY) {
    throw new Error("Ollama Cloud API Key is missing. Check .env VITE_OLLAMA_CLOUD_API_KEY");
  }

  const modelName = model || OLLAMA_CLOUD_MODEL;

  try {
    console.log(`[AI] Calling Ollama Cloud (${modelName})...`);

    const response = await fetch('https://ollama.com/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OLLAMA_CLOUD_API_KEY}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant.' },
          { role: 'user', content: prompt }
        ],
        stream: false
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama Cloud API failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const reply = data.message?.content;

    if (!reply) {
      throw new Error('No response content from Ollama Cloud');
    }

    return reply;
  } catch (err: any) {
    throw new Error(`Ollama Cloud Error: ${err.message}`);
  }
}

/**
 * Call Local Phi-3 via Electron IPC
 */
async function callLocalAI(prompt: string, model?: string): Promise<string> {
  if (!window.electronAPI?.askAI) {
    throw new Error("Electron API not available. Are you running in browser mode?");
  }
  return await window.electronAPI.askAI(prompt, model || LOCAL_OLLAMA_MODEL);
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
  const provider = (config.provider || getDefaultProvider()) as AIProvider;
  const chain = buildProviderChain(provider);

  if (!chain.length) {
    throw new Error('No AI provider is available. Configure Gemini/Groq/Zhipu/Ollama Cloud keys or run the desktop app with local Ollama.');
  }

  let lastError: Error | null = null;

  for (const activeProvider of chain) {
    const modelOverride = provider !== 'auto' ? config.model : '';
    const model = modelOverride || (
      activeProvider === 'gemini' ? GEMINI_MODEL :
        activeProvider === 'local-phi' ? LOCAL_OLLAMA_MODEL :
          activeProvider === 'groq' ? GROQ_MODEL :
            activeProvider === 'zhipu' ? ZHIPU_MODEL :
              OLLAMA_CLOUD_MODEL
    );

    try {
      errorHandler.log('AI', new Error(`Requesting AI: ${activeProvider} (${model})`), { operation: 'generateAiContent' }, 'low');

      let response = '';

      if (activeProvider === 'gemini') {
        response = await callGemini(prompt, model);
      } else if (activeProvider === 'groq') {
        response = await callGroq(prompt, model);
      } else if (activeProvider === 'zhipu') {
        response = await callZhipu(prompt, model);
      } else if (activeProvider === 'local-phi') {
        response = await callLocalAI(prompt, model);
      } else if (activeProvider === 'ollama-cloud') {
        response = await callOllamaCloud(prompt, model);
      } else {
        throw new Error(`Unknown provider: ${activeProvider}`);
      }

      // 2. Cloud Sync (Firebase History)
      const logId = `ai-${Date.now()}`;
      await cloudDb.syncToCloud('aiHistory', logId, {
        prompt: prompt.substring(0, 500), // Truncate for storage
        response: response.substring(0, 500),
        provider: activeProvider,
        model,
        timestamp: new Date().toISOString()
      });

      return response;

    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      errorHandler.log('AI', lastError, { operation: 'generateAiContent', provider: activeProvider }, 'medium');
    }
  }

  throw lastError || new Error('All AI providers failed.');
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

  return generateAiContent(prompt, { provider: getDefaultProvider() });
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
