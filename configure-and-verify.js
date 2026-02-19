const { Pool } = require('pg');
const OpenAI = require("openai");

const connectionString = "postgresql://neondb_owner:npg_WnX4hLFdCV1l@ep-muddy-bush-aeihyvce-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

// Values from .env
const WHATSAPP_TOKEN = "EAAMDzAogNlABQsRETNz22SdQpcQbmdmNAcTiPqHxblvYjm4dsvmmKyahaE1ReukSAuIdNkkrikYCMwuSOS6v4KhoY2XuUFsfSRTzSklsN9OwW4Rd28JSN20ZA3HdyUtd3qllMz4sF13NDtZAtIDD2pAA2VszEdH7OIJpPfVaY6ZBVdBiycYlY1AtOCWwNOSEgZDZD";
const WHATSAPP_PHONE_NUMBER_ID = "962954070236965";

async function updateDb() {
    console.log('--- Updating Database ---');
    const pool = new Pool({ connectionString });
    try {
        // First check if 'main' exists
        const checkRes = await pool.query('SELECT id FROM "Settings" WHERE id = \'main\'');
        if (checkRes.rows.length === 0) {
            console.log('Inserting new "main" settings record...');
            await pool.query(
                'INSERT INTO "Settings" (id, business_name, wa_access_token, wa_phone_number_id) VALUES ($1, $2, $3, $4)',
                ['main', 'WR POS', WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID]
            );
        } else {
            console.log('Updating existing "main" settings record...');
            await pool.query(
                'UPDATE "Settings" SET wa_access_token = $1, wa_phone_number_id = $2 WHERE id = \'main\'',
                [WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID]
            );
        }
        console.log('SUCCESS: Database updated.');
    } catch (err) {
        console.error('ERROR: Database update failed:', err.message);
    } finally {
        await pool.end();
    }
}

async function verifyOllama() {
    console.log('\n--- Verifying Ollama ---');
    const client = new OpenAI({
        baseURL: "http://localhost:11434/v1",
        apiKey: "ollama",
    });

    try {
        const completion = await client.chat.completions.create({
            messages: [{ role: "user", content: "Say 'Ollama is alive!'" }],
            model: "llama3",
        });
        console.log('Ollama Response:', completion.choices[0].message.content);
        console.log('SUCCESS: Ollama is responsive.');
    } catch (error) {
        console.error('ERROR: Ollama is still unreachable:', error.message);
    }
}

async function run() {
    await updateDb();
    // Wait for Ollama to warm up
    console.log('Waiting 5s for Ollama service to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    await verifyOllama();
}

run();
