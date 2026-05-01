/** Memastikan tidak ada LF/CRLF di dalam kutip ASCII ganda (`"`), agar pemetaan rekaman-ke-baris fisik stabil. */
export function assertCsvTextSingleLinePhysicalRecords(csvText: string): void {
  let inQuotes = false;
  for (let i = 0; i < csvText.length; i++) {
    const c = csvText[i];
    if (c === '"') {
      const next = csvText[i + 1];
      if (inQuotes && next === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes && (c === "\n" || c === "\r")) {
      throw new Error(
        "CSV multiline tidak didukung — hilangkan newline di dalam tanda kutip.",
      );
    }
  }
}
