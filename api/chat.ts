import { GoogleGenerativeAI } from "@google/generative-ai";
import { errorHandler } from "../services/errorHandler";
import type { Request, Response } from "express";

// Use env var or fall back to known working API Key if process.env is missing in this context
// In a real secure deployment, strictly use process.env.API_KEY
const API_KEY = process.env.API_KEY!;

export default async function handler(req: Request, res: Response) {
  // GET: Return empty history since we are in Local Mode (no DB persistence)
  if (req.method === 'GET') {
    return res.json({ history: [] });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, context } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message required' });
  }

  try {
    // Construct prompt context from the payload sent by the frontend
    // This allows the AI to see Local Storage data without a DB connection
    const businessContext = context ? `
      Current Business Context (Local Mode):
      - Total Revenue: LKR ${context.totalRevenue?.toLocaleString() || '0'}
      - Total Profit: LKR ${context.totalProfit?.toLocaleString() || '0'}
      - Active Products: ${context.productCount || '0'}
      - Low Stock Items: ${context.lowStockCount || '0'}
      - Registered Customers: ${context.customerCount || '0'}
      - Top Category: ${context.topCategory || 'N/A'}
    ` : "System Context: Local Data Mode. No specific stats available.";

    const systemPrompt = `
      You are the WR POS Assistant, a specialized business AI.
      ${businessContext}
      
      Role: Provide data-driven insights, helpful POS support, and business advice.
      Constraints: Keep answers concise, professional, and friendly. 
      If asked about data not in the context, explain that you only have access to the summary stats provided above.
    `;

    // Call Gemini
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(`${systemPrompt}\n\nUser Question: ${message}`);
    const response = await result.response;
    const responseText = response.text() || "I'm processing that information but couldn't generate a text response.";

    // Return response without saving to DB
    res.json({ reply: responseText });

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    errorHandler.log('Chat', error, { operation: 'handler' }, 'high');
    res.status(500).json({ error: 'AI Service Error: ' + (error.message || 'Unknown') });
  }
}
