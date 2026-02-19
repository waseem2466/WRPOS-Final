const dotenv = require('dotenv');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config({ path: path.join(__dirname, '.env') });

const GEMINI_KEY = process.env.VITE_GEMINI_API_KEY;

async function testGemini() {
    console.log('\n--- Testing Gemini AI ---');
    if (!GEMINI_KEY) {
        console.error('❌ Gemini API Key missing in .env');
        return false;
    }

    try {
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent('Say: AI is functional!');
        const response = await result.response;
        const text = response.text();
        console.log('✅ Gemini Response:', text);
        return true;
    } catch (error) {
        console.error('❌ Gemini Failed:', error.message);
        return false;
    }
}

async function testOllama() {
    console.log('\n--- Testing Local Ollama AI ---');
    try {
        const res = await fetch('http://localhost:11434/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3',
                messages: [{ role: 'user', content: 'Say: Ollama is functional!' }],
                max_tokens: 10
            })
        });
        if (res.ok) {
            const data = await res.json();
            console.log('✅ Ollama Response:', data.choices?.[0]?.message?.content);
            return true;
        } else {
            console.warn('⚠️ Ollama returned status:', res.status);
            return false;
        }
    } catch (e) {
        console.warn('⚠️ Ollama not reachable (common if not started locally)');
        return false;
    }
}

async function runAll() {
    console.log('=== SYSTEM VERIFICATION START ===');
    const geminiOk = await testGemini();
    const ollamaOk = await testOllama();

    console.log('\n=== SUMMARY ===');
    console.log('Gemini Cloud AI:', geminiOk ? '✅ WORKING' : '❌ FAILED');
    console.log('Ollama Local AI:', ollamaOk ? '✅ WORKING' : '⚠️ NOT REACHABLE (Check if Ollama is running)');
    console.log('=== VERIFICATION END ===');
}

runAll();
