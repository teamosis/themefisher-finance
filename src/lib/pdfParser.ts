export function getInvoiceDateFromValueDate(
  valueDate: string,
): string | undefined {
  const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(valueDate);
  if (!parts) return undefined;

  const [, day, month, year] = parts;
  const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const date = new Date(isoDate);
  if (
    !Number.isFinite(date.getTime()) ||
    !date.toISOString().startsWith(isoDate)
  ) {
    return undefined;
  }

  date.setUTCDate(date.getUTCDate() - 7);
  return date.toISOString().slice(0, 10);
}

export async function parseMT103(file: File, password?: string) {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("The PDF exceeds the 10 MB upload limit.");
  }

  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).href;

  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  const envPassword =
    typeof process !== "undefined" ? process.env.PDF_PASSWORD : undefined;
  const configuredPassword = password ?? envPassword;

  const loadingTask = getDocument({
    data,
    ...(configuredPassword ? { password: configuredPassword } : {}),
  });

  let triedConfiguredPassword = false;
  loadingTask.onPassword = (
    updatePassword: (password: string | Error) => void,
    reason: number,
  ) => {
    if (reason === 1 && configuredPassword && !triedConfiguredPassword) {
      triedConfiguredPassword = true;
      updatePassword(configuredPassword);
      return;
    }
    const message =
      reason === 2
        ? "Incorrect password. Enter the PDF password again."
        : "Enter the PDF password.";
    const userEntered =
      typeof window !== "undefined" && window.prompt
        ? window.prompt(message)
        : null;
    updatePassword(
      userEntered || new Error("PDF password entry was cancelled."),
    );
  };

  const allItems: { str: string; x: number; y: number }[] = [];
  try {
    const pdfDocument = await loadingTask.promise;
    if (pdfDocument.numPages > 50) {
      throw new Error("The PDF exceeds the 50-page limit.");
    }
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      for (const item of textContent.items) {
        const str = "str" in item ? item.str.trim() : "";
        if (str && "transform" in item) {
          allItems.push({ str, x: item.transform[4], y: item.transform[5] });
        }
      }
    }
  } finally {
    await loadingTask.destroy();
  }

  // Sort by Y descending (top to bottom in PDF space), then X ascending
  allItems.sort((a, b) => {
    if (Math.abs(b.y - a.y) < 5) {
      return a.x - b.x;
    }
    return b.y - a.y;
  });

  let colAmountX = -1,
    colValueDateX = -1,
    colReceivedFromX = -1,
    colOrderingCustomerX = -1,
    colDetailsX = -1;
  let headerY = -1;

  for (const item of allItems) {
    const s = item.str.toLowerCase();
    if (s.includes("amount")) colAmountX = item.x;
    if (s.includes("value date")) colValueDateX = item.x;
    if (s.includes("received from")) colReceivedFromX = item.x;
    if (s.includes("ordering customer") || s.includes("orderingcustomer")) {
      colOrderingCustomerX = item.x;
      headerY = item.y;
    }
    if (s.includes("details")) colDetailsX = item.x;
  }

  // Fallbacks if columns are shifted or not perfectly aligned
  if (colOrderingCustomerX === -1) colOrderingCustomerX = 400; // approximate
  if (colDetailsX === -1) colDetailsX = 600;

  const dataItems =
    headerY !== -1 ? allItems.filter((i) => i.y < headerY - 10) : allItems;

  let currency = "";
  let amount = "";
  let value_date = "";
  let invoice_number = "";
  let swift_code = "";
  const orderingCustomerLines: string[] = [];
  const detailsLines: string[] = [];
  const fullText = allItems.map((i) => i.str).join(" ");

  for (const item of dataItems) {
    const str = item.str;

    if (item.x >= colAmountX - 40 && item.x < colValueDateX - 20) {
      if (/^[\d\,\.]+$/.test(str)) {
        amount = str.replace(/,/g, "");
      }
    }

    if (/^(USD|EUR|GBP|BDT)$/i.test(str)) {
      currency = str.toUpperCase();
    }

    if (item.x >= colValueDateX - 20 && item.x < colReceivedFromX - 20) {
      const dateMatch = str.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/);
      if (dateMatch) value_date = dateMatch[0];
    }

    if (item.x >= colReceivedFromX - 20 && item.x < colOrderingCustomerX - 20) {
      if (str.length > 5 && str.length < 15 && /^[A-Z0-9]+$/.test(str)) {
        swift_code = str;
      }
    }

    if (item.x >= colOrderingCustomerX - 20 && item.x < colDetailsX - 20) {
      orderingCustomerLines.push(str);
    }

    if (item.x >= colDetailsX - 20) {
      detailsLines.push(str);
      if (!invoice_number) {
        const match = str.match(/TF-[\w\-]+/i);
        if (match) invoice_number = match[0].toUpperCase();
      }
    }
  }

  // Fallback: search entire PDF text for invoice number if spatial detection missed it
  if (!invoice_number) {
    const tfMatch = fullText.match(/TF-[\w\-]+/i);
    if (tfMatch) {
      invoice_number = tfMatch[0].toUpperCase();
    } else {
      const invMatch = fullText.match(/INV[A-Z0-9\-\_]+/i);
      if (invMatch) invoice_number = invMatch[0].toUpperCase();
    }
  }

  // If SWIFT wasn't caught spatially, try regex on full text
  if (!swift_code) {
    const swiftMatches = fullText.match(/[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?/g);
    if (swiftMatches) {
      swift_code = swiftMatches[0];
    }
  }

  return {
    currency,
    amount,
    value_date,
    invoice_number,
    client_name: orderingCustomerLines.join(" "),
    swift_code,
    full_text: fullText,
    details_text: detailsLines.join(" "),
  };
}
