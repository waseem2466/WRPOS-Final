const fs = require('fs');
const path = require('path');

const cloudDir = path.join(__dirname, '..', 'wr-cloud-bot');

const filesToFix = ['inventoryManager.cjs', 'groupWatcher.cjs', 'aiReply.cjs', 'shopData.cjs', 'intent.cjs'];

filesToFix.forEach(file => {
    const filePath = path.join(cloudDir, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');

        // Remove electron require
        content = content.replace(/const\s*{\s*app\s*}\s*=\s*require\('electron'\);/g, '');
        content = content.replace(/const\s*{\s*app,\s*ipcMain\s*}\s*=\s*require\('electron'\);/g, '');
        
        // Fix envPath
        content = content.replace(/const envPath = app && app\.isPackaged[\s\S]*?dotenv\.config\({ path: envPath }\);/g, 
            "const envPath = path.join(__dirname, '.env');\ndotenv.config({ path: envPath });\nconst app = { isPackaged: false, getPath: () => __dirname };");
        
        // General require('electron') cleanup just in case
        content = content.replace(/require\(['"]electron['"]\)/g, "{}");

        fs.writeFileSync(filePath, content);
        console.log("Fixed " + file);
    }
});

console.log('✅ Cloud Bot files patched perfectly! Ready to push to GitHub.');
