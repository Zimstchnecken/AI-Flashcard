import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { PDFDocument } from "pdf-lib";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const TEXT_LIMIT = 20000;

function looksLikePdf(bytes: Buffer) {
  // PDF files start with "%PDF-"
  return bytes.length >= 5 && bytes.subarray(0, 5).toString("utf8") === "%PDF-";
}

async function extractPdfTextWithRepair(fileBuffer: Buffer) {
  const failures: string[] = [];

  async function extractWithPdfJs(buffer: Buffer) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      stopAtErrors: false,
      isEvalSupported: false,
    });

    const doc = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
      const page = await doc.getPage(pageNo);
      const textContent = await page.getTextContent();
      const pageText = (textContent.items as Array<{ str?: string }>)
        .map((item) => item.str ?? "")
        .join(" ")
        .trim();

      if (pageText) {
        pages.push(pageText);
      }

      if (typeof page.cleanup === "function") {
        page.cleanup();
      }
    }

    await loadingTask.destroy();
    return { text: pages.join("\n"), numpages: doc.numPages };
  }

  try {
    return await pdfParse(fileBuffer);
  } catch (error) {
    failures.push(`pdf-parse(original): ${error instanceof Error ? error.message : String(error)}`);
    const message = error instanceof Error ? error.message : String(error);
    const maybeBrokenXref = /xref|XRef|bad XRef|FormatError/i.test(message);

    try {
      return await extractWithPdfJs(fileBuffer);
    } catch (fallbackError) {
      failures.push(
        `pdfjs(original): ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
      );
    }

    if (maybeBrokenXref) {
      // Some Chrome-exported or reprocessed PDFs contain cross-reference issues.
      // Rewriting the file structure often makes text extraction succeed.
      const repairedDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
      const repairedBytes = await repairedDoc.save({ useObjectStreams: false });
      const repairedBuffer = Buffer.from(repairedBytes);

      try {
        return await pdfParse(repairedBuffer);
      } catch (repairError) {
        failures.push(
          `pdf-parse(repaired): ${repairError instanceof Error ? repairError.message : String(repairError)}`,
        );
      }

      try {
        return await extractWithPdfJs(repairedBuffer);
      } catch (repairFallbackError) {
        failures.push(
          `pdfjs(repaired): ${
            repairFallbackError instanceof Error
              ? repairFallbackError.message
              : String(repairFallbackError)
          }`,
        );
      }
    }

    throw new Error(`PDF extraction failed: ${failures.join(" | ")}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Please upload a valid PDF file." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File must be a PDF under 10MB" }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const mimeLooksPdf = file.type === "application/pdf";
    const extensionLooksPdf = file.name.toLowerCase().endsWith(".pdf");
    const signatureLooksPdf = looksLikePdf(fileBuffer);

    if (!mimeLooksPdf && !extensionLooksPdf && !signatureLooksPdf) {
      return NextResponse.json({ error: "File must be a PDF under 10MB" }, { status: 400 });
    }

    const parsed = await extractPdfTextWithRepair(fileBuffer);

    const normalizedText = parsed.text.replace(/\s+/g, " ").trim();
    if (!normalizedText || normalizedText.length < 20) {
      return NextResponse.json(
        {
          error:
            "This PDF appears to be a scanned image or contains no extractable text. Please paste the text manually.",
        },
        { status: 400 },
      );
    }

    const text = normalizedText.slice(0, TEXT_LIMIT);
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    return NextResponse.json({
      text,
      pageCount: parsed.numpages,
      wordCount,
      trimmed: normalizedText.length > TEXT_LIMIT,
    });
  } catch (error) {
    console.error("[parse-pdf] failed", error);
    return NextResponse.json(
      { error: "Unable to parse this PDF. The file may be encrypted or malformed." },
      { status: 400 },
    );
  }
}
