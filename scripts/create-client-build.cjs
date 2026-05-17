const fs = require('fs');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("=========================================");
console.log("🚀 WR POS - NEW CLIENT BUILDER 🚀");
console.log("=========================================\n");

rl.question("1. Enter the new Client's Business Name (e.g. 'Healthy Pharmacy'): ", (clientName) => {
    rl.question("2. Enter the Client's Supabase URL: ", (supabaseUrl) => {
        rl.question("3. Enter the Client's Supabase Service Role Key: ", (supabaseKey) => {
            
            console.log("\n[1/3] Updating .env file...");
            let envContent = fs.readFileSync('.env', 'utf8');
            
            // Replace Supabase URL
            envContent = envContent.replace(/VITE_SUPABASE_URL=.*/g, `VITE_SUPABASE_URL=${supabaseUrl}`);
            envContent = envContent.replace(/SUPABASE_URL=.*/g, `SUPABASE_URL=${supabaseUrl}`);
            
            // Replace Service Role Key
            envContent = envContent.replace(/SUPABASE_SERVICE_ROLE_KEY=.*/g, `SUPABASE_SERVICE_ROLE_KEY=${supabaseKey}`);
            envContent = envContent.replace(/VITE_SUPABASE_SERVICE_ROLE_KEY=.*/g, `VITE_SUPABASE_SERVICE_ROLE_KEY=${supabaseKey}`);

            fs.writeFileSync('.env', envContent);

            console.log("[2/3] Compiling custom .exe for " + clientName + "...");
            try {
                // Run the electron builder
                execSync('npm run dist', { stdio: 'inherit' });
                
                console.log("\n[3/3] Build Complete!");
                console.log("=========================================");
                console.log(`✅ Success! You can find the new .exe for ${clientName} inside the 'release/' folder!`);
                console.log("Don't forget to charge them for the software installation! 💰");
                console.log("=========================================\n");
            } catch (err) {
                console.error("Build failed: ", err);
            }

            rl.close();
        });
    });
});
