const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const { createClient } = require('@supabase/supabase-js');
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
    this.keepAliveTimer = null;
    this.supabase = null;
    this.supabaseBucket = 'whatsapp-auth';
    this.pendingUploads = new Set();
    this.pendingDeletes = new Set();
    this.syncTimer = null;
    this.cloudRestored = false;
  }

  initSupabase() {
    if (this.supabase) return this.supabase;
    const url = process.env.SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (url && key) {
      try {
        this.supabase = createClient(url, key);
      } catch (e) {
        console.error('[WhatsApp] Failed to init Supabase client:', e.message);
      }
    }
    return this.supabase;
  }

  async ensureBucketExists() {
    if (!this.initSupabase()) return;
    try {
      const { data: buckets, error } = await this.supabase.storage.listBuckets();
      if (!error && !buckets?.some(b => b.name === this.supabaseBucket)) {
        await this.supabase.storage.createBucket(this.supabaseBucket, { public: false });
        console.log(`[WhatsApp] Created Supabase Storage bucket "${this.supabaseBucket}".`);
      }
    } catch (e) {
      // Ignore if already exists
    }
  }

  async downloadAuthFromSupabase() {
    if (!this.initSupabase()) return false;
    try {
      if (!fs.existsSync(AUTH_FOLDER)) {
        fs.mkdirSync(AUTH_FOLDER, { recursive: true });
      }

      console.log('[WhatsApp] Checking Supabase cloud storage for saved session...');
      let offset = 0;
      const allFiles = [];

      while (true) {
        const { data: files, error } = await this.supabase.storage
          .from(this.supabaseBucket)
          .list('', { limit: 100, offset });

        if (error || !files || files.length === 0) break;
        allFiles.push(...files);
        if (files.length < 100) break;
        offset += files.length;
      }

      if (allFiles.length === 0) {
        console.log('[WhatsApp] No existing session found in Supabase cloud storage.');
        // If local creds exist, sync them to Supabase to initialize cloud backup
        if (fs.existsSync(path.join(AUTH_FOLDER, 'creds.json'))) {
          const localFiles = fs.readdirSync(AUTH_FOLDER);
          console.log(`[WhatsApp] Uploading ${localFiles.length} local session files to Supabase...`);
          for (const f of localFiles) {
            await this.uploadFileToSupabase(f);
          }
        }
        return false;
      }

      console.log(`[WhatsApp] Restoring ${allFiles.length} session files from Supabase cloud...`);
      let restoredCount = 0;
      await Promise.all(
        allFiles.map(async (file) => {
          if (!file.name) return;
          try {
            const { data, error } = await this.supabase.storage
              .from(this.supabaseBucket)
              .download(file.name);
            if (data && !error) {
              const buffer = Buffer.from(await data.arrayBuffer());
              fs.writeFileSync(path.join(AUTH_FOLDER, file.name), buffer);
              restoredCount++;
            }
          } catch (dlErr) {
            console.error(`[WhatsApp] Failed to download ${file.name}:`, dlErr.message);
          }
        })
      );

      this.cloudRestored = fs.existsSync(path.join(AUTH_FOLDER, 'creds.json'));
      console.log(`[WhatsApp] Cloud session restore complete (${restoredCount} files). Has creds: ${this.cloudRestored}`);
      return this.cloudRestored;
    } catch (err) {
      console.error('[WhatsApp] Failed to sync session from Supabase cloud:', err.message);
      return false;
    }
  }

  async uploadFileToSupabase(fileName) {
    if (!this.initSupabase()) return;
    try {
      const filePath = path.join(AUTH_FOLDER, fileName);
      if (!fs.existsSync(filePath)) return;
      const content = fs.readFileSync(filePath);
      await this.supabase.storage
        .from(this.supabaseBucket)
        .upload(fileName, content, {
          contentType: 'application/json',
          upsert: true
        });
    } catch (e) {
      console.error(`[WhatsApp] Failed to upload ${fileName} to Supabase:`, e.message);
    }
  }

  queueSync(fileName, isDelete = false) {
    if (!fileName) return;
    if (isDelete) {
      this.pendingUploads.delete(fileName);
      this.pendingDeletes.add(fileName);
    } else {
      this.pendingDeletes.delete(fileName);
      this.pendingUploads.add(fileName);
    }

    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    this.syncTimer = setTimeout(() => {
      this.flushSyncQueue();
    }, 1500);
  }

  async flushSyncQueue() {
    if (!this.initSupabase()) return;
    const toUpload = Array.from(this.pendingUploads);
    const toDelete = Array.from(this.pendingDeletes);
    this.pendingUploads.clear();
    this.pendingDeletes.clear();

    if (toDelete.length > 0) {
      try {
        await this.supabase.storage.from(this.supabaseBucket).remove(toDelete);
      } catch (err) {
        console.error('[WhatsApp] Error deleting keys from Supabase:', err.message);
      }
    }

    if (toUpload.length > 0) {
      try {
        await Promise.all(toUpload.map(f => this.uploadFileToSupabase(f)));
      } catch (err) {
        console.error('[WhatsApp] Error syncing keys to Supabase:', err.message);
      }
    }
  }

  startKeepAlive() {
    this.stopKeepAlive();
    // Send presence ping every 25 seconds to prevent NAT/router/idle disconnects
    this.keepAliveTimer = setInterval(async () => {
      if (this.connectionStatus === 'CONNECTED' && this.sock) {
        try {
          await this.sock.sendPresenceUpdate('available');
        } catch (e) {
          // Silent ignore ping errors
        }
      }
    }, 25000);
  }

  stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  async init() {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      if (!fs.existsSync(AUTH_FOLDER)) {
        fs.mkdirSync(AUTH_FOLDER, { recursive: true });
      }

      // Step 1: Sync existing session files from Supabase cloud storage (Render-safe)
      await this.ensureBucketExists();
      await this.downloadAuthFromSupabase();

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
      const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307], isLatest: true }));

      console.log(`[WhatsApp] Initializing Baileys engine (v${version.join('.')}, isLatest: ${isLatest})...`);

      this.connectionStatus = 'CONNECTING';

      this.sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        retryRequestDelayMs: 2000,
      });

      // Hook credentials save to automatically upload creds.json to Supabase
      const enhancedSaveCreds = async () => {
        await saveCreds();
        await this.uploadFileToSupabase('creds.json');
      };
      this.sock.ev.on('creds.update', enhancedSaveCreds);

      // Hook keys.set to automatically queue uploads/deletions to Supabase cloud
      const originalKeysSet = state.keys.set;
      state.keys.set = async (data) => {
        await originalKeysSet(data);
        for (const category in data) {
          for (const id in data[category]) {
            const value = data[category][id];
            const fileName = `${category}-${id}.json`.replace(/\//g, '__').replace(/:/g, '-');
            this.queueSync(fileName, !value);
          }
        }
      };

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
          this.startKeepAlive();
          // Ensure all local session files are backed up to Supabase
          if (fs.existsSync(AUTH_FOLDER)) {
            const files = fs.readdirSync(AUTH_FOLDER);
            files.forEach(f => this.queueSync(f, false));
          }
        }

        if (connection === 'close') {
          this.stopKeepAlive();
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          
          this.connectionStatus = 'DISCONNECTED';
          console.log(`[WhatsApp] Connection closed. StatusCode: ${statusCode}. Reconnecting: ${shouldReconnect}`);

          if (statusCode === DisconnectReason.loggedOut) {
            console.log('[WhatsApp] Logged out from device. Cleaning credentials...');
            await this.resetAuth();
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

  async resetAuth() {
    try {
      this.connectedUser = null;
      this.qrCodeDataUrl = null;
      this.connectionStatus = 'DISCONNECTED';
      this.cloudRestored = false;
      
      // Wipe local auth files
      if (fs.existsSync(AUTH_FOLDER)) {
        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
      }

      // Wipe Supabase cloud session files
      if (this.initSupabase()) {
        try {
          const { data: files } = await this.supabase.storage
            .from(this.supabaseBucket)
            .list('', { limit: 500 });
          if (files && files.length > 0) {
            const names = files.map(f => f.name).filter(Boolean);
            await this.supabase.storage.from(this.supabaseBucket).remove(names);
            console.log(`[WhatsApp] Cleared ${names.length} session files from Supabase cloud storage.`);
          }
        } catch (e) {
          console.error('[WhatsApp] Error clearing Supabase session files:', e.message);
        }
      }

      setTimeout(() => {
        this.isInitializing = false;
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
    savingCredited,
    totalSavingBalance,
    totalLoan,
    remainingBalance
  }) {
    const formattedDate = date || new Date().toISOString().split('T')[0];
    const lines = [
      `🧾 *SINDHUJA FINANCE - COLLECTION RECEIPT*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 *Name:* ${memberName || 'Member'}`,
      memberNo ? `🔢 *Member No:* ${memberNo}` : null,
      centerName ? `📍 *Center:* ${centerName}` : null,
      `📅 *Date:* ${formattedDate}`,
      week ? `📆 *EMI Week:* ${week}` : null,
      `💵 *Amount Paid Today:* ₹${Number(amountPaid || 0).toLocaleString('en-IN')}`,
      Number(savingCredited) > 0 ? `🪙 *Saving Credited:* ₹${Number(savingCredited).toLocaleString('en-IN')}` : null,
      (totalSavingBalance !== undefined && totalSavingBalance !== null) ? `🏦 *Total Saving Balance:* ₹${Number(totalSavingBalance).toLocaleString('en-IN')}` : null,
      totalLoan ? `💳 *Total Loan:* ₹${Number(totalLoan).toLocaleString('en-IN')}` : null,
      (remainingBalance !== undefined && remainingBalance !== null) ? `📊 *Remaining Balance:* ₹${Number(remainingBalance).toLocaleString('en-IN')}` : null,
      `━━━━━━━━━━━━━━━━━━━━`,
      `✅ *Your weekly EMI payment has been received.*`,
      `🙏 *Thank you - Sindhuja Finance!*`
    ].filter(Boolean);

    return lines.join('\n');
  }

  generateForeclosureReceiptText({
    memberName,
    memberNo,
    centerName,
    date,
    settlementAmount,
    discountAmount,
    totalLoan
  }) {
    const formattedDate = date || new Date().toLocaleDateString('en-GB');
    const lines = [
      `🎉 *SINDHUJA FINANCE - LOAN CLOSURE RECEIPT (NOC)*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 *Name:* ${memberName || 'Member'}`,
      memberNo ? `🔢 *Member No:* ${memberNo}` : null,
      centerName ? `📍 *Center:* ${centerName}` : null,
      `📅 *Closure Date:* ${formattedDate}`,
      totalLoan ? `💳 *Total Loan:* ₹${Number(totalLoan).toLocaleString('en-IN')}` : null,
      Number(discountAmount) > 0 ? `🎁 *Discount / Rebate:* ₹${Number(discountAmount).toLocaleString('en-IN')}` : null,
      `💵 *Settlement Amount Paid:* ₹${Number(settlementAmount || 0).toLocaleString('en-IN')}`,
      `📊 *Remaining Balance:* ₹0 (Fully Closed)`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `✅ *Your loan has been successfully foreclosed & closed (LOAN CLOSED).*`,
      `🌟 *You are now eligible to apply for your next loan immediately.*`,
      `🙏 *Thank you - Sindhuja Finance!*`
    ].filter(Boolean);

    return lines.join('\n');
  }

  generatePendingSettlementReceiptText({
    memberName,
    memberNo,
    centerName,
    date,
    amountPaid,
    settledWeeks,
    waivedPenalty,
    savingCredited,
    totalSavingBalance,
    remainingBalance
  }) {
    const formattedDate = date || new Date().toLocaleDateString('en-GB');
    const lines = [
      `🧾 *SINDHUJA FINANCE - ARREARS SETTLEMENT RECEIPT*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 *Name:* ${memberName || 'Member'}`,
      memberNo ? `🔢 *Member No:* ${memberNo}` : null,
      centerName ? `📍 *Center:* ${centerName}` : null,
      `📅 *Date:* ${formattedDate}`,
      settledWeeks && settledWeeks.length > 0 ? `📆 *Settled Weeks:* ${settledWeeks.join(', ')}` : null,
      `💵 *Total Amount Paid:* ₹${Number(amountPaid || 0).toLocaleString('en-IN')}`,
      Number(savingCredited) > 0 ? `🪙 *Saving Credited:* ₹${Number(savingCredited).toLocaleString('en-IN')}` : null,
      (totalSavingBalance !== undefined && totalSavingBalance !== null) ? `🏦 *Total Saving Balance:* ₹${Number(totalSavingBalance).toLocaleString('en-IN')}` : null,
      Number(waivedPenalty) > 0 ? `🎁 *Waived Penalty:* ₹${Number(waivedPenalty).toLocaleString('en-IN')}` : null,
      (remainingBalance !== undefined && remainingBalance !== null) ? `📊 *Total Remaining Balance:* ₹${Number(remainingBalance).toLocaleString('en-IN')}` : null,
      `━━━━━━━━━━━━━━━━━━━━`,
      `✅ *Your pending dues have been successfully settled & credited.*`,
      `🙏 *Thank you - Sindhuja Finance!*`
    ].filter(Boolean);

    return lines.join('\n');
  }

  generateSavingWithdrawalReceiptText({
    memberName,
    memberNo,
    centerName,
    date,
    withdrawnAmount,
    remainingBalance,
    notes
  }) {
    const formattedDate = date || new Date().toLocaleDateString('en-GB');
    const lines = [
      `🏦 *SINDHUJA FINANCE - SAVING WITHDRAWAL RECEIPT*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 *Name:* ${memberName || 'Member'}`,
      memberNo ? `🔢 *Member No:* ${memberNo}` : null,
      centerName ? `📍 *Center:* ${centerName}` : null,
      `📅 *Date:* ${formattedDate}`,
      `💵 *Saving Withdrawn:* ₹${Number(withdrawnAmount || 0).toLocaleString('en-IN')}`,
      `🪙 *Remaining Saving Balance:* ₹${Number(remainingBalance || 0).toLocaleString('en-IN')}`,
      notes ? `📝 *Note:* ${notes}` : null,
      `━━━━━━━━━━━━━━━━━━━━`,
      `✅ *Your saving withdrawal has been processed.*`,
      `🙏 *Thank you - Sindhuja Finance!*`
    ].filter(Boolean);

    return lines.join('\n');
  }

  // Send bills to multiple members with rate-limiting safety delay
  // If member's number fails, automatically fallback to nominee number
  async sendBatchBills(bills) {
    if (!bills || !bills.length) return [];
    const results = [];

    for (let i = 0; i < bills.length; i++) {
      const bill = bills[i];
      const messageText = this.generateBillReceiptText(bill);

      // Try member phone first
      let res = await this.sendMessage(bill.phone, messageText);

      // If member phone failed and nominee phone exists, try nominee
      if (!res.success && bill.phone2) {
        console.log(`[WhatsApp] Member ${bill.memberName}: primary phone failed, trying nominee (${bill.phone2})...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        const nomineeRes = await this.sendMessage(bill.phone2, messageText);
        results.push({
          memberName: bill.memberName,
          phone: bill.phone2,
          sentToNominee: true,
          amount: bill.amountPaid,
          ...nomineeRes
        });
      } else {
        results.push({
          memberName: bill.memberName,
          phone: bill.phone,
          sentToNominee: false,
          amount: bill.amountPaid,
          ...res
        });
      }

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
      user: this.connectedUser,
      cloudSynced: this.cloudRestored || this.connectionStatus === 'CONNECTED',
      cloudBucket: this.supabaseBucket
    };
  }
}

const whatsappService = new WhatsAppService();
module.exports = whatsappService;
