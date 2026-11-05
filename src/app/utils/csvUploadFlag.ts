// Whether CSV-Object upload is offered for a given board, from the "Enable CSV file
// upload for this board" checkbox in the Create/Edit Board modal (Sidebar.tsx).
// Stored client-side only (no backend field for this yet) — per board_id, in
// localStorage, so it survives reloads but doesn't follow the board across devices
// or users. Unset (including every board created before this flag existed) reads
// as enabled, so the CSV-Object button keeps showing up unless someone explicitly
// turns it off.
const STORAGE_PREFIX = 'csv_upload_enabled_';

export function isCsvUploadEnabled(boardId: string | number | null | undefined): boolean {
  if (boardId === null || boardId === undefined || boardId === '') return true;
  if (typeof window === 'undefined') return true;
  try {
    const v = localStorage.getItem(`${STORAGE_PREFIX}${boardId}`);
    return v === null ? true : v === 'true';
  } catch {
    return true;
  }
}

export function setCsvUploadEnabled(boardId: string | number | null | undefined, enabled: boolean): void {
  if (boardId === null || boardId === undefined || boardId === '') return;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${boardId}`, String(enabled));
  } catch {
    // ignore (private browsing / storage disabled)
  }
}
