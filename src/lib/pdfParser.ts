import { extractMT103Text } from "./mt103-text";
export { getInvoiceDateFromValueDate } from "./mt103-text";

export async function parseMT103(file: File, password?: string) {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("The PDF exceeds the 10 MB upload limit.");
  }

  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

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

  return extractMT103Text(loadingTask, {
    pages: 50,
    characters: Number.POSITIVE_INFINITY,
  });
}
