import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

// Pencarian dinamis avrdude bawaan Arduino IDE pada sistem
function findAvrdude(): { exe: string; conf: string } | null {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  const baseToolsDir = path.join(localAppData, "Arduino15", "packages", "arduino", "tools", "avrdude");

  if (fs.existsSync(baseToolsDir)) {
    try {
      const versions = fs.readdirSync(baseToolsDir).sort().reverse();
      for (const v of versions) {
        const exe = path.join(baseToolsDir, v, "bin", "avrdude.exe");
        const conf = path.join(baseToolsDir, v, "etc", "avrdude.conf");
        if (fs.existsSync(exe) && fs.existsSync(conf)) {
          return { exe, conf };
        }
      }
    } catch (e) {}
  }

  // Fallback: Program Files
  const progFiles = [
    process.env["ProgramFiles"],
    process.env["ProgramFiles(x86)"],
    path.join(localAppData, "Programs", "Arduino IDE")
  ].filter(Boolean) as string[];

  for (const pf of progFiles) {
    const candidateExe = path.join(pf, "resources", "app", "node_modules", "arduino-ide-extension", "bin", "avrdude.exe");
    const candidateConf = path.join(path.dirname(candidateExe), "..", "etc", "avrdude.conf");
    if (fs.existsSync(candidateExe) && fs.existsSync(candidateConf)) {
      return { exe: candidateExe, conf: candidateConf };
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const hexFile = formData.get("file") as File | null;
    const port = (formData.get("port") as string) || "COM3";
    const baud = (formData.get("baud") as string) || "115200";

    if (!hexFile) {
      return NextResponse.json({ success: false, error: "Tidak ada file .hex yang diunggah" }, { status: 400 });
    }

    const avrdude = findAvrdude();
    if (!avrdude) {
      return NextResponse.json({
        success: false,
        error: "Engine avrdude tidak ditemukan. Pastikan Arduino IDE terinstall di komputer."
      }, { status: 500 });
    }

    // Tulis file .hex ke temp directory
    const buffer = Buffer.from(await hexFile.arrayBuffer());
    const tempHexPath = path.join(os.tmpdir(), `katana_upload_${Date.now()}.hex`);
    fs.writeFileSync(tempHexPath, buffer);

    // Format perintah AVRDUDE resmi Arduino IDE:
    // avrdude -C <conf> -v -V -p atmega328p -c arduino -b <baud> -P <port> -D -U flash:w:<hex>:i
    const cmd = `"${avrdude.exe}" -C "${avrdude.conf}" -v -V -p atmega328p -c arduino -b ${baud} -P ${port} -D -U flash:w:"${tempHexPath}":i`;

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
