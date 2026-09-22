const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const AUTH_FOLDER = path.join(__dirname, 'auth_info_baileys');

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.qrCodeDataUrl = null;
    this.connectionStatus = 'DISCONNECTED'; // 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTING' | 'CONNECTED'
    this.connectedUser = null;
    this.isInitializing = false;
  }

  async init() {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      if (!fs.existsSync(AUTH_FOLDER)) {
        fs.mkdirSync(AUTH_FOLDER, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
      const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307], isLatest: true }));

      console.log(`[WhatsApp] Initializing Baileys engine (v${version.join('.')}, isLatest: ${isLatest})...`);

      this.connectionStatus = 'CONNECTING';

      this.sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['Sindhuja Fin Collection', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, { scale: 8, margin: 2 });
            this.connectionStatus = 'SCAN_QR';
            console.log('[WhatsApp] New QR code generated. Visit /whatsapp to scan.');
          } catch (err) {
            console.error('[WhatsApp] Failed to generate QR data URL:', err.message);
          }
        }

        if (connection === 'open') {
          this.connectionStatus = 'CONNECTED';
          this.qrCodeDataUrl = null;
          const userJid = this.sock.user?.id || '';
          const phone = userJid.split(':')[0] || userJid.split('@')[0];
          this.connectedUser = {
            name: this.sock.user?.name || 'Sindhuja Fin Office',
            phone: phone
          };
          console.log(`[WhatsApp] Connected successfully as ${this.connectedUser.phone} (${this.connectedUser.name})!`);
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          
          this.connectionStatus = 'DISCONNECTED';
          console.log(`[WhatsApp] Connection closed. StatusCode: ${statusCode}. Reconnecting: ${shouldReconnect}`);

          if (statusCode === DisconnectReason.loggedOut) {
            console.log('[WhatsApp] Logged out from device. Cleaning credentials...');
            this.resetAuth();
          }

          if (shouldReconnect) {
            setTimeout(() => {
              this.isInitializing = false;
              this.init();
            }, 3000);
          } else {
            this.isInitializing = false;
          }
        }
      });

    } catch (err) {
      console.error('[WhatsApp] Initialization error:', err.message);
      this.connectionStatus = 'DISCONNECTED';
      this.isInitializing = false;
    } finally {
      this.isInitializing = false;
    }
  }

  resetAuth() {
    try {
      this.connectedUser = null;
      this.qrCodeDataUrl = null;
      this.connectionStatus = 'DISCONNECTED';
      if (fs.existsSync(AUTH_FOLDER)) {
        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
      }
      setTimeout(() => {
        this.init();
      }, 1000);
    } catch (e) {
      console.error('[WhatsApp] Error resetting auth:', e.message);
    }
  }

  formatPhoneNumber(phone) {
    if (!phone) return null;
    let clean = String(phone).replace(/\D/g, '');
    if (clean.length === 10) {
      clean = '91' + clean;
    }
    if (clean.length >= 11 && clean.startsWith('91')) {
      return clean;
    }
    return clean.length >= 10 ? clean : null;
  }

  async sendMessage(rawPhone, text) {
    const formattedPhone = this.formatPhoneNumber(rawPhone);
    if (!formattedPhone) {
      return { success: false, error: 'Invalid phone number: ' + rawPhone };
    }

    if (this.connectionStatus !== 'CONNECTED' || !this.sock) {
      return { success: false, error: 'WhatsApp is not connected. Status: ' + this.connectionStatus };
    }

    try {
      const jid = `${formattedPhone}@s.whatsapp.net`;
      const result = await this.sock.sendMessage(jid, { text });
      return { success: true, messageId: result?.key?.id };
    } catch (err) {
      console.error(`[WhatsApp] Error sending to ${formattedPhone}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  generateBillReceiptText({
    memberName,
    memberNo,
    centerName,
    date,
    week,
    amountPaid,
    totalLoan,
    remainingBalance
  }) {
    const formattedDate = date || new Date().toISOString().split('T')[0];
    const lines = [
      `🧾 *SINDHUJA FINANCE - வசூல் ரசீது*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 *பெயர்:* ${memberName || 'Member'}`,
      memberNo ? `🔢 *உறுப்பினர் எண்:* ${memberNo}` : null,
      centerName ? `📍 *சென்டர்:* ${centerName}` : null,
      `📅 *தேதி:* ${formattedDate}`,
      week ? `📆 *தவணை வாரம்:* ${week}` : null,
      `💵 *இன்று செலுத்தியது:* ₹${Number(amountPaid || 0).toLocaleString('en-IN')}`,
      totalLoan ? `💳 *மொத்த கடன்:* ₹${Number(totalLoan).toLocaleString('en-IN')}` : null,
      (remainingBalance !== undefined && remainingBalance !== null) ? `📊 *மீதமுள்ள பாக்கி:* ₹${Number(remainingBalance).toLocaleString('en-IN')}` : null,
      `━━━━━━━━━━━━━━━━━━━━`,
      `✅ *தங்களின் வாரத்தவணை பெறப்பட்டது.*`,
      `🙏 *நன்றி - சிந்துஜா பைனான்ஸ்!*`
    ].filter(Boolean);

    return lines.join('\n');
  }

  // Send bills to multiple members with rate-limiting safety delay
  async sendBatchBills(bills) {
    if (!bills || !bills.length) return [];
    const results = [];

    for (let i = 0; i < bills.length; i++) {
      const bill = bills[i];
      const messageText = this.generateBillReceiptText(bill);
      const res = await this.sendMessage(bill.phone, messageText);
      results.push({
        memberName: bill.memberName,
        phone: bill.phone,
        amount: bill.amountPaid,
        ...res
      });

      // 1.5s delay between messages to prevent spam detection
      if (i < bills.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    return results;
  }

  getStatus() {
    return {
      status: this.connectionStatus,
      isConnected: this.connectionStatus === 'CONNECTED',
      qrCode: this.qrCodeDataUrl,
      user: this.connectedUser
    };
  }
}

const whatsappService = new WhatsAppService();
module.exports = whatsappService;
