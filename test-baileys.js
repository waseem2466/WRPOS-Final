
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');

async function test() {
    console.log('Starting Baileys test...');
    try {
        const { state, saveCreds } = await useMultiFileAuthState('test_auth');
        console.log('Auth state loaded');
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: pino({ level: 'debug' })
        });

        sock.ev.on('connection.update', (update) => {
            const { connection, qr } = update;
            if (qr) {
                console.log('QR Received!');
            }
            if (connection === 'open') {
                console.log('Connection opened!');
            }
        });
    } catch (err) {
        console.error('Test failed:', err);
    }
}

test();
