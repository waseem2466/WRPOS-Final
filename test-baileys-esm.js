
const pino = require('pino');

async function test() {
    console.log('Starting Baileys ESM test with macOS browser...');
    try {
        const pkgBaileys = await import('@whiskeysockets/baileys');
        const makeWASocket = pkgBaileys.default?.default || pkgBaileys.default || pkgBaileys;
        const useMultiFileAuthState = pkgBaileys.useMultiFileAuthState;
        const Browsers = pkgBaileys.Browsers;

        const logger = pino({ level: 'debug' });
        const { state, saveCreds } = await useMultiFileAuthState('test_auth_esm_v4');

        const sock = makeWASocket({
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
                console.log('QR CODE GENERATED!');
                console.log('DATA:', qr);
                // process.exit(0); // Don't exit yet, let's see if it stays
            }
            if (lastDisconnect) {
                const reason = lastDisconnect.error?.output?.statusCode;
                console.log('Last Disconnect Reason:', reason);
                console.log('Last Disconnect Message:', lastDisconnect.error?.message);
            }
        });

        setTimeout(() => {
            console.log('Test timed out (60s)');
            process.exit(0);
        }, 60000);
    } catch (err) {
        console.error('ESM Test failed:', err);
    }
}

test();
