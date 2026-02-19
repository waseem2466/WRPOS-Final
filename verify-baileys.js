
const pino = require('pino');
const path = require('path');
const fs = require('fs');

async function test() {
    console.log('Starting verification test...');
    try {
        const pkgBaileys = await import('@whiskeysockets/baileys');
        const makeWASocket = pkgBaileys.default?.default || pkgBaileys.default || pkgBaileys;
        const useMultiFileAuthState = pkgBaileys.useMultiFileAuthState;
        const Browsers = pkgBaileys.Browsers;
        const fetchLatestBaileysVersion = pkgBaileys.fetchLatestBaileysVersion;

        const logger = pino({ level: 'debug' });

        // Try to fetch latest version to avoid 405
        let version = [2, 3000, 1017531287]; // Fallback
        try {
            const { version: latestVersion, isLatest } = await fetchLatestBaileysVersion();
            console.log(`Using latest version: ${latestVersion} (isLatest: ${isLatest})`);
            version = latestVersion;
        } catch (e) {
            console.log('Failed to fetch latest version, using fallback');
        }

        const authPath = path.join(process.cwd(), 'test_auth_final');
        if (fs.existsSync(authPath)) {
            // fs.rmSync(authPath, { recursive: true, force: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(authPath);

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: Browsers.macOS('Desktop'),
            logger: logger,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000
        });

        sock.ev.on('connection.update', (update) => {
            const { connection, qr, lastDisconnect } = update;
            console.log('Update:', connection || 'no connection prop', qr ? 'QR received' : 'no QR');
            if (qr) {
                console.log('SUCCESS: QR CODE GENERATED!');
                process.exit(0);
            }
            if (lastDisconnect) {
                console.log('Disconnect Reason:', lastDisconnect.error?.output?.statusCode);
                console.log('Disconnect Message:', lastDisconnect.error?.message);
            }
        });

        setTimeout(() => {
            console.log('Verification timed out (60s)');
            process.exit(1);
        }, 60000);
    } catch (err) {
        console.error('Verification failed:', err);
        process.exit(1);
    }
}

test();
