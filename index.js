const express = require("express");
const pino = require("pino");
const QRCode = require("qrcode");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const app = express();
const PORT = process.env.PORT || 10000;

let currentQR = null;
let connectionStatus = "starting";

app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Football Analysis Bot</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 30px;
          }
          img {
            width: 300px;
            max-width: 90vw;
          }
        </style>
      </head>
      <body>
        <h2>WhatsApp Bot</h2>
        <p id="status">Memuat...</p>
        <div id="qr"></div>

        <script>
          async function update() {
            try {
              const response = await fetch("/qr");
              const data = await response.json();

              document.getElementById("status").textContent =
                data.status;

              if (data.qr) {
                document.getElementById("qr").innerHTML =
                  '<img src="' + data.qr + '">';
              } else {
                document.getElementById("qr").innerHTML =
                  '<p>QR belum tersedia.</p>';
              }
            } catch (e) {
              document.getElementById("status").textContent =
                "Gagal mengambil status.";
            }
          }

          update();
          setInterval(update, 2000);
        </script>
      </body>
    </html>
  `);
});

app.get("/qr", (req, res) => {
  res.json({
    status: connectionStatus,
    qr: currentQR
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP server berjalan di port ${PORT}`);
});

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on(
    "connection.update",
    async ({ connection, lastDisconnect, qr }) => {

      if (qr) {
        connectionStatus = "Silakan scan QR WhatsApp";

        try {
          currentQR = await QRCode.toDataURL(qr, {
            width: 400,
            margin: 2
          });

          console.log("QR BARU SIAP. Buka halaman bot untuk scan.");
        } catch (error) {
          console.error("Gagal membuat QR:", error);
        }
      }

      if (connection === "open") {
        connectionStatus = "WhatsApp terhubung";
        currentQR = null;

        console.log("WhatsApp berhasil terhubung!");
      }

      if (connection === "close") {
        connectionStatus = "Koneksi terputus";

        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !==
          DisconnectReason.loggedOut;

        if (shouldReconnect) {
          console.log("Mencoba menghubungkan kembali...");
          setTimeout(startBot, 3000);
        } else {
          console.log("WhatsApp logout. Perlu scan QR lagi.");
        }
      }
    }
  );

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const message = messages[0];

    if (!message?.message) return;

    const text =
      message.message.conversation ||
      message.message.extendedTextMessage?.text ||
      "";

    if (text.toLowerCase() === "/menu") {
      await sock.sendMessage(message.key.remoteJid, {
        text:
          "⚽ FOOTBALL ANALYSIS BOT\n\n" +
          "/menu\n" +
          "/analisis Tim A vs Tim B\n" +
          "/jadwal Tim\n" +
          "/klasemen Liga\n" +
          "/h2h Tim A vs Tim B"
      });
    }
  });
}

startBot().catch(console.error);
