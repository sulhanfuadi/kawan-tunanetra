import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getArchiveDir(): string {
  const cwd = process.cwd();
  if (cwd.endsWith("dashboard") || cwd.includes("dashboard")) {
    return path.resolve(cwd, "..", "archive");
  }
  return path.resolve(cwd, "archive");
}

export async function GET(req: NextRequest) {
  try {
    const archiveDir = getArchiveDir();
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    const { searchParams } = new URL(req.url);
    const fileParam = searchParams.get("file");

    if (fileParam) {
      const sanitized = path.basename(fileParam);
      const filePath = path.join(archiveDir, sanitized);
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: "File arsip tidak ditemukan" }, { status: 404 });
      }

      const content = fs.readFileSync(filePath, "utf-8");
      return new NextResponse(content, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${sanitized}"`,
        },
      });
    }

    const files = fs.readdirSync(archiveDir);
    const csvFiles = files
      .filter((f) => f.endsWith(".csv"))
      .map((f) => {
        const filePath = path.join(archiveDir, f);
        const stats = fs.statSync(filePath);
        let rowCount = 0;
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          rowCount = Math.max(0, content.trim().split(/\r?\n/).length - 1);
        } catch {}

        return {
          name: f,
          sizeBytes: stats.size,
          sizeKb: (stats.size / 1024).toFixed(1),
          createdAt: stats.mtime.toISOString(),
          rowCount,
          downloadUrl: `/api/archive?file=${encodeURIComponent(f)}`,
        };
      })
      .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

    return NextResponse.json({
      success: true,
      archivePath: "katana/archive",
      files: csvFiles,
      count: csvFiles.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal membaca direktori arsip" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const archiveDir = getArchiveDir();
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    const body = await req.json();
    const { filename, csvContent } = body;

    if (!csvContent || typeof csvContent !== "string") {
      return NextResponse.json({ error: "Konten CSV kosong atau tidak valid" }, { status: 400 });
    }

    const safeName = filename
      ? path.basename(filename).replace(/[^a-zA-Z0-9_\-\.]/g, "_")
      : `katana_telemetry_${Date.now()}.csv`;

    const finalName = safeName.endsWith(".csv") ? safeName : `${safeName}.csv`;
    const targetPath = path.join(archiveDir, finalName);

    const contentToWrite = csvContent.startsWith("\uFEFF") ? csvContent : "\uFEFF" + csvContent;

    fs.writeFileSync(targetPath, contentToWrite, "utf-8");
    const stats = fs.statSync(targetPath);
    const rowCount = Math.max(0, csvContent.trim().split(/\r?\n/).length - 1);

    return NextResponse.json({
      success: true,
      message: `File berhasil disimpan ke katana/archive/${finalName}`,
      filename: finalName,
      path: `katana/archive/${finalName}`,
      sizeBytes: stats.size,
      rowCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal menyimpan file ke arsip" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const archiveDir = getArchiveDir();
    const { searchParams } = new URL(req.url);
    const fileParam = searchParams.get("file");

    if (!fileParam) {
      return NextResponse.json({ error: "Nama file tidak diberikan" }, { status: 400 });
    }

    const sanitized = path.basename(fileParam);
    const filePath = path.join(archiveDir, sanitized);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return NextResponse.json({ success: true, message: `File ${sanitized} berhasil dihapus` });
    }

    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal menghapus file" }, { status: 500 });
  }
}
