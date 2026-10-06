/**
 * STK500v1 Arduino Nano Web Flasher
 * Implements Optiboot / Arduino Bootloader protocol via Web Serial API.
 * Supports both New Bootloader (115200 baud) and Old Bootloader (57600 baud).
 */

// STK500 Constants
const Resp_STK_INSYNC = 0x14;
const Resp_STK_OK = 0x10;
const Cmnd_STK_GET_SYNC = 0x30;
const Cmnd_STK_SET_DEVICE = 0x42;
const Cmnd_STK_ENTER_PROGMODE = 0x50;
const Cmnd_STK_LOAD_ADDRESS = 0x55;
const Cmnd_STK_PROG_PAGE = 0x64;
const Cmnd_STK_LEAVE_PROGMODE = 0x51;
const Sync_CRC_EOP = 0x20;

export interface FlashOptions {
  baudRate: 115200 | 57600;
  pageSize?: number;
  onProgress: (percent: number, stepText: string) => void;
  onLog: (message: string) => void;
}

export class Stk500Flasher {
  private port: any;
  private reader: any = null;
  private writer: any = null;
  private inputBuffer: number[] = [];
  private readingActive = false;

  constructor(port: any) {
    this.port = port;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private startContinuousReader(): void {
    this.readingActive = true;
    (async () => {
      while (this.readingActive && this.reader) {
        try {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) {
            for (let i = 0; i < value.length; i++) {
              this.inputBuffer.push(value[i]);
            }
          }
        } catch (e) {
          if (!this.readingActive) break;
          await this.sleep(10);
        }
      }
    })();
  }

  private async readBytes(count: number, timeoutMs = 1500): Promise<number[]> {
    const startTime = Date.now();
    while (this.inputBuffer.length < count) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(
          `Timeout menunggu respon bootloader (butuh ${count} byte, diterima: [${this.inputBuffer.map(b => "0x" + b.toString(16)).join(", ")}])`
        );
      }
      await this.sleep(10);
    }
    return this.inputBuffer.splice(0, count);
  }

  private async sendCommand(cmd: number[]): Promise<void> {
    const buf = new Uint8Array(cmd);
    await this.writer.write(buf);
  }

  private async getSync(onLog: (msg: string) => void): Promise<boolean> {
    for (let attempt = 1; attempt <= 15; attempt++) {
      this.inputBuffer = [];
      try {
        await this.sendCommand([Cmnd_STK_GET_SYNC, Sync_CRC_EOP]);
        const resp = await this.readBytes(2, 250);
        if (resp[0] === Resp_STK_INSYNC && resp[1] === Resp_STK_OK) {
          return true;
        }
      } catch (err) {
        // coba lagi hingga bootloader merespons dalam window 1-2 detik setelah reset
      }
      await this.sleep(40);
    }
    return false;
  }

  public async flash(firmwareBytes: Uint8Array, options: FlashOptions): Promise<void> {
    const { baudRate, onProgress, onLog } = options;
    const pageSize = options.pageSize || 128; // ATmega328P page size 128 bytes

    onLog(`[FLASH] Menyiapkan port serial dengan baud rate ${baudRate}...`);
    await this.port.open({ baudRate });

    this.writer = this.port.writable.getWriter();
    this.reader = this.port.readable.getReader();
    this.startContinuousReader();

    try {
      // 1. Reset Arduino Nano via DTR pulse
      // Pada CH340 / FTDI, DTR active-low (DTR = true -> pin DTR low -> trigger RST pin)
      onLog("[FLASH] Mengirim sinyal DTR Hardware Reset (Active-Low pulse)...");
      onProgress(5, "Mereset Arduino Nano...");
      try {
        // Tarik DTR HIGH (logic pin LOW) untuk ground reset capacitor
        await this.port.setSignals({ dataTerminalReady: true, requestToSend: true });
        await this.sleep(250);
        // Lepas DTR LOW (logic pin HIGH) agar ATmega keluar dari reset ke bootloader
        await this.port.setSignals({ dataTerminalReady: false, requestToSend: false });
      } catch (dtrErr: any) {
        onLog(`[FLASH] Catatan DTR: ${dtrErr.message || "Manual DTR"}`);
      }

      // Beri jeda sangat singkat agar bootloader mulai mengeksekusi
      await this.sleep(100);

      // 2. Sinkronisasi STK500
      onLog("[FLASH] Menyinkronkan STK500 (Get Sync)... (Jika macet, tekan tombol RESET kecil di papan Arduino)");
      onProgress(15, "Menyinkronkan bootloader...");
      const synced = await this.getSync(onLog);
      if (!synced) {
        throw new Error(
          `Gagal sinkron dengan bootloader pada ${baudRate} baud. Pastikan baud rate benar atau coba tekan tombol RESET fisik di papan Arduino tepat saat progress bar mencapai 15%.`
        );
      }
      onLog("[FLASH] Bootloader STK500 tersinkronisasi (INSYNC OK).");

      // 3. Masuk ke mode programming
      onLog("[FLASH] Masuk ke Programming Mode...");
      onProgress(25, "Memasuki programming mode...");
      await this.sendCommand([
        Cmnd_STK_SET_DEVICE,
        0x86, 0x00, 0x00, 0x01, 0x01, 0x01, 0x01, 0x03,
        0xff, 0xff, 0xff, 0xff, 0x00, 0x80, 0x04, 0x00,
        0x00, 0x00, 0x80, 0x00,
        Sync_CRC_EOP
      ]);
      await this.readBytes(2, 600);

      await this.sendCommand([Cmnd_STK_ENTER_PROGMODE, Sync_CRC_EOP]);
      await this.readBytes(2, 600);
      onLog("[FLASH] Programming Mode aktif.");

      // 4. Flash page demi page
      const totalPages = Math.ceil(firmwareBytes.length / pageSize);
      onLog(`[FLASH] Menulis firmware: ${firmwareBytes.length} bytes (${totalPages} pages @ ${pageSize}B)...`);

      for (let page = 0; page < totalPages; page++) {
        const address = (page * pageSize) >> 1; // STK500 uses word addressing (address / 2)
        const addrLow = address & 0xff;
        const addrHigh = (address >> 8) & 0xff;

        // Load Address
        await this.sendCommand([Cmnd_STK_LOAD_ADDRESS, addrLow, addrHigh, Sync_CRC_EOP]);
        await this.readBytes(2, 600);

        // Siapkan block page
        const start = page * pageSize;
        const end = Math.min(start + pageSize, firmwareBytes.length);
        const pageData = new Uint8Array(pageSize);
        pageData.fill(0xff);
        pageData.set(firmwareBytes.subarray(start, end));

        // Program Page (0x64, sizeHigh, sizeLow, 'F', bytes..., 0x20)
        const progCmd = new Uint8Array(5 + pageSize);
        progCmd[0] = Cmnd_STK_PROG_PAGE;
        progCmd[1] = (pageSize >> 8) & 0xff;
        progCmd[2] = pageSize & 0xff;
        progCmd[3] = 0x46; // 'F' for Flash
        progCmd.set(pageData, 4);
        progCmd[4 + pageSize] = Sync_CRC_EOP;

        await this.writer.write(progCmd);
        const resp = await this.readBytes(2, 1000);
        if (resp[0] !== Resp_STK_INSYNC || resp[1] !== Resp_STK_OK) {
          throw new Error(`Gagal menulis halaman ${page + 1}/${totalPages}`);
        }

        const percent = Math.round(25 + ((page + 1) / totalPages) * 70);
        onProgress(percent, `Menulis memori flash... (${page + 1}/${totalPages} page)`);
      }

      // 5. Keluar dari programming mode
      onLog("[FLASH] Menutup Programming Mode...");
      onProgress(98, "Menyelesaikan flashing...");
      await this.sendCommand([Cmnd_STK_LEAVE_PROGMODE, Sync_CRC_EOP]);
      try {
        await this.readBytes(2, 500);
      } catch (e) {}

      onProgress(100, "Selesai! Firmware berhasil di-upload.");
      onLog("[FLASH] Upload firmware berhasil 100%! Arduino kembali restart.");
    } finally {
      this.readingActive = false;
      // Bersihkan reader & writer
      if (this.reader) {
        try { await this.reader.cancel(); } catch (e) {}
        try { this.reader.releaseLock(); } catch (e) {}
        this.reader = null;
      }
      if (this.writer) {
        try { await this.writer.close(); } catch (e) {}
        try { this.writer.releaseLock(); } catch (e) {}
        this.writer = null;
      }
      try {
        await this.port.close();
      } catch (e) {}
    }
  }
}
