import { NextResponse } from "next/server";
import { exec } from "child_process";

export async function GET() {
  try {
    // PowerShell query untuk mendapatkan daftar COM ports di Windows
    const cmd = `powershell -NoProfile -Command "[System.IO.Ports.SerialPort]::getportnames()"`;
    return new Promise<NextResponse>((resolve) => {
      exec(cmd, { timeout: 4000 }, (error, stdout) => {
        if (error) {
          resolve(NextResponse.json({ ports: [] }));
          return;
        }
        const ports = stdout
          .split(/\r?\n/)
          .map((p) => p.trim())
          .filter((p) => p.length > 0);
        resolve(NextResponse.json({ ports }));
      });
    });
  } catch (err: any) {
    return NextResponse.json({ ports: [] });
  }
}
