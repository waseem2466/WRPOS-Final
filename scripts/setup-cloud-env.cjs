const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', '..', 'wr-cloud-bot');
const posEnvPath = path.join(__dirname, '..', '.env');
const botEnvPath = path.join(targetDir, '.env');

try {
    const posEnv = fs.readFileSync(posEnvPath, 'utf8');
    
    let geminiKey = '';
    let neonUrl = '';
    let ownerPhone = '';

    const lines = posEnv.split('\\n');
    lines.forEach(line => {
        if (line.startsWith('VITE_GEMINI_API_KEY=')) geminiKey = line.split('=')[1].trim();
        if (line.startsWith('GEMINI_API_KEY=') && !geminiKey) geminiKey = line.split('=')[1].trim();
        if (line.startsWith('VITE_NEON_API_URL=')) neonUrl = line.split('=')[1].trim();
        if (line.startsWith('DATABASE_URL=')) neonUrl = line.split('=')[1].trim();
        if (line.startsWith('OWNER_PHONE=')) ownerPhone = line.split('=')[1].trim();
    });

    const envTemplate = \`
# WR POS Cloud Bot Environment Variables
WRPOS_DB_DRIVER=postgres
DATABASE_URL=\${neonUrl}

# AI Keys
GEMINI_API_KEY=\${geminiKey}
VITE_GEMINI_MODEL=gemini-2.0-flash-lite

# Owner Configuration
OWNER_PHONE=\${ownerPhone || '0719336848'}
WATCHED_GROUPS=smile and supplies
\`;

    fs.writeFileSync(botEnvPath, envTemplate.trim());
    console.log('✅ Successfully copied your secret keys into the wr-cloud-bot .env file!');

} catch (err) {
    console.error('Error setting up env:', err);
}
