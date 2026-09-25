const http = require("http");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const pino = require("pino");

const API_KEY = process.env.API_FOOTBALL_KEY;

// HTTP server untuk hosting
const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain"
  });

  res.end("Football WhatsApp Bot is running!");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP server berjalan di port ${PORT}`);
});

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState("auth");

  const { version } =
    await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: true
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on(
    "connection.update",
    ({ connection, lastDisconnect }) => {

      if (connection === "open") {
        console.log("BOT WHATSAPP TERHUBUNG!");
      }

      if (connection === "close") {
        const code =
          lastDisconnect?.error?.output?.statusCode;

        if (code !== DisconnectReason.loggedOut) {
          console.log(
            "Koneksi terputus, mencoba tersambung lagi..."
          );

          setTimeout(() => {
            startBot();
          }, 5000);

        } else {
          console.log("WhatsApp ter-logout.");
        }
      }
    }
  );

  sock.ev.on(
    "messages.upsert",
    async ({ messages }) => {

      const msg = messages[0];

      if (!msg.message || msg.key.fromMe) {
        return;
      }

      const jid = msg.key.remoteJid;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      const command =
        text.trim().toLowerCase();

      if (command === "/menu") {

        await sock.sendMessage(jid, {
          text:
`⚽ FOOTBALL BOT

/menu
/analisis Tim A vs Tim B
/jadwal Tim
/klasemen Liga
/h2h Tim A vs Tim B

Bot memberikan informasi dan statistik pertandingan.`
        });
      }
    }
  );
}

if (!API_KEY) {
  console.log(
    "PERINGATAN: API_FOOTBALL_KEY belum dipasang."
  );
}

startBot().catch(console.error);
