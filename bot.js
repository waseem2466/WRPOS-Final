const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const qrcode = require("qrcode-terminal")

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info")

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            console.log("Scan this QR with WhatsApp:")
            qrcode.generate(qr, { small: true })
        }

        if (connection === "close") {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

            console.log("Connection closed. Reconnecting...", shouldReconnect)

            if (shouldReconnect) {
                startBot()
            }
        } else if (connection === "open") {
            console.log("✅ WhatsApp Bot Connected Successfully!")
        }
    })

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0]
        if (!msg.message) return

        const text = msg.message.conversation?.toLowerCase()
        const from = msg.key.remoteJid

        if (!text) return

        if (text === "hi") {
            await sock.sendMessage(from, { text: "Welcome to WR Smile & Supplies 🛍️" })
        }
    })
}

startBot()
