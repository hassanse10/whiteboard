const TIMEZONE_LANGUAGE_MAP: Record<string, string> = {
  // French
  "Europe/Paris": "fr",
  "Europe/Monaco": "fr",
  "Indian/Reunion": "fr",
  "America/Martinique": "fr",
  "America/Guadeloupe": "fr",
  "America/Cayenne": "fr",

  // Spanish
  "Europe/Madrid": "es",
  "Atlantic/Canary": "es",
  "America/Mexico_City": "es",
  "America/Bogota": "es",
  "America/Argentina/Buenos_Aires": "es",
  "America/Santiago": "es",
  "America/Lima": "es",

  // German
  "Europe/Berlin": "de",
  "Europe/Vienna": "de",
  "Europe/Zurich": "de",

  // Italian
  "Europe/Rome": "it",

  // Dutch
  "Europe/Amsterdam": "nl",

  // Portuguese
  "Europe/Lisbon": "pt",
  "America/Sao_Paulo": "pt",

  // Russian
  "Europe/Moscow": "ru",

  // Japanese
  "Asia/Tokyo": "ja",

  // Korean
  "Asia/Seoul": "ko"
};

export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function detectLanguageFromTimezone(timezone: string): string | null {
  return TIMEZONE_LANGUAGE_MAP[timezone] ?? null;
}

export function timezoneToLabel(timezone: string): string {
  const parts = timezone.split("/");
  const city = parts[parts.length - 1] ?? timezone;
  return city.replace(/_/g, " ");
}
