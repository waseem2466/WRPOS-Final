const fs = require('fs');

let content = fs.readFileSync('electron-main.cjs', 'utf8');

// 1. Add Tray and Menu to electron imports
if (!content.includes('Tray')) {
    content = content.replace(/const { app, BrowserWindow, ipcMain, dialog, shell } = require\("electron"\);/, 
        'const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu } = require("electron");');
}

// 2. Add Tray variable and app.isQuitting flag
if (!content.includes('let tray = null;')) {
    content = content.replace(/let mainWindow;/, 'let mainWindow;\nlet tray = null;');
}

// 3. Setup Tray in app.whenReady
const trayCode = `
    // Setup System Tray
    try {
        const iconPath = path.join(__dirname, 'build', 'icons', 'Icon.ico');
        if (fs.existsSync(iconPath)) {
            tray = new Tray(iconPath);
            const contextMenu = Menu.buildFromTemplate([
                { label: 'Open WR POS', click: () => { 
                    if (mainWindow) {
                        mainWindow.show();
                    } else {
                        createWindow();
                    }
                } },
                { type: 'separator' },
                { label: 'Quit Completely', click: () => { 
                    app.isQuitting = true; 
                    app.quit(); 
                } }
            ]);
            tray.setToolTip('WR POS - AI Running in Background');
            tray.setContextMenu(contextMenu);
            
            tray.on('double-click', () => {
                if (mainWindow) {
                    mainWindow.show();
                } else {
                    createWindow();
                }
            });
        }
    } catch (e) {
        console.error('Tray error:', e);
    }
`;
if (!content.includes('tray = new Tray')) {
    content = content.replace(/createWindow\(\);/, `createWindow();\n${trayCode}`);
}

// 4. Modify window-all-closed to NOT quit automatically unless app.isQuitting is true
const oldClose = `app.on("window-all-closed", () => {
    if (webhookServer) webhookServer.stop();
    if (process.platform !== "darwin") app.quit();
});`;

const newClose = `app.on("window-all-closed", () => {
    // Keep app running in background for WhatsApp AI
    console.log("Window closed. App running in background tray.");
});`;

content = content.replace(oldClose, newClose);

// 5. Hide window instead of destroying on close
const windowCloseCode = `
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            return false;
        }
    });
`;

if (!content.includes("mainWindow.hide()")) {
    content = content.replace(/mainWindow\.on\('closed', \(\) => {/, `${windowCloseCode}\n    mainWindow.on('closed', () => {`);
}

fs.writeFileSync('electron-main.cjs', content);
console.log('Tray feature added successfully!');
