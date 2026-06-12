const BOARD_ID_LENGTH = 10;
const BOARD_ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateBoardId(): string {
  const bytes = new Uint8Array(BOARD_ID_LENGTH);
  crypto.getRandomValues(bytes);

  let id = "";
  for (let i = 0; i < BOARD_ID_LENGTH; i++) {
    id += BOARD_ID_CHARS[bytes[i] % BOARD_ID_CHARS.length];
  }
  return id;
}

export function getBoardIdFromUrl(search: string): string | null {
  const params = new URLSearchParams(search);
  return params.get("board");
}

export function ensureBoardId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = getBoardIdFromUrl(window.location.search);
  if (existing) {
    return existing;
  }

  const id = generateBoardId();
  const params = new URLSearchParams(window.location.search);
  params.set("board", id);
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  return id;
}
