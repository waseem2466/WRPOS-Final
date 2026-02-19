
const OpenAI = require("openai");

// Configuration matching .env or defaults
const OLLAMA_API_URL = "http://localhost:11434/v1";
const OLLAMA_API_KEY = "ollama"; // Dummy key

const client = new OpenAI({
    baseURL: OLLAMA_API_URL,
    apiKey: OLLAMA_API_KEY,
});

async function main() {
    console.log("1. Connecting to Ollama at:", OLLAMA_API_URL);

    try {
        const start = Date.now();
        const completion = await client.chat.completions.create({
            messages: [{ role: "user", content: "Say 'Ollama is working!'" }],
            model: "llama3", // Assuming user has this, or we can try a few
        });
        const duration = Date.now() - start;

        console.log("2. Response Received in", duration, "ms");
        console.log("3. AI says:", completion.choices[0].message.content);
        console.log("\n✅ SUCCESS: Ollama is reachable and responding.");
    } catch (error) {
        console.error("\n❌ ERROR: Could not connect to Ollama.");
        console.error("Details:", error.message);

        if (error.code === 'ECONNREFUSED') {
            console.log("\nTIP: Is Ollama running? Try running 'ollama serve' in a separate terminal.");
        }
    }
}

main();
