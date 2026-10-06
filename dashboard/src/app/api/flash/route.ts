import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

// Lokasi avrdude bawaan Arduino IDE yang sudah terinstall di laptop
const AVRDUDE_EXE = "C:\\Users\\ASUS'\\AppData\\Local\\Arduino15\\packages\\arduino\\tools\\avrdude\\8.0.0-arduino1\\bin\\avrdude.exe";
const AVRDUDE_CONF = "C:\\Users\\ASUS'\\AppData\\Local\\Arduino15\\packages\\arduino\\tools\\avrdude\\8.0.0-arduino1\\etc\\avrdude.conf";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const hexFile = formData.get("file") as File | null;
    const port = (formData.get("port") as string) || "COM3";
    const baud = (formData.get("baud") as string) || "115200";

    if (!hexFile) {
      return NextResponse.json({ success: false, error: "Tidak ada file .hex yang diunggah" }, { status: 400 });
    }

    if (!fs.existsSync(AVRDUDE_EXE)) {
      return NextResponse.json({
        success: false,
        error: `Binary avrdude tidak ditemukan di ${AVRDUDE_EXE}`
      }, { status: 500 });
    }

    // Tulis file .hex ke temp directory
    const buffer = Buffer.from(await hexFile.arrayBuffer());
    const tempHexPath = path.join(os.tmpdir(), `katana_upload_${Date.now()}.hex`);
    fs.writeFileSync(tempHexPath, buffer);

    // Format perintah AVRDUDE resmi Arduino IDE:
    // avrdude -C <conf> -v -V -p atmega328p -c arduino -b <baud> -P <port> -D -U flash:w:<hex>:i
    const cmd = `"${AVRDUDE_EXE}" -C "${AVRDUDE_CONF}" -v -V -p atmega328p -c arduino -b ${baud} -P ${port} -D -U flash:w:"${tempHexPath}":i`;

    return new Promise<NextResponse>((resolve) => {
      exec(cmd, { timeout: 25000 }, (error, stdout, stderr) => {
        // Hapus file sementara
        try { fs.unlinkSync(tempHexPath); } catch (e) {}

        const outputLog = (stdout + "\n" + stderr).trim();

        if (error) {
          resolve(NextResponse.json({
            success: false,
            error: error.message,
            output: outputLog
          }, { status: 500 }));
        } else {
          resolve(NextResponse.json({
            success: true,
            output: outputLog
          }));
        }
      });
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
