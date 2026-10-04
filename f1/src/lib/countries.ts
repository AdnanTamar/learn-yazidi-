/** Maps provider nationality / country names to ISO-3166 alpha-2 codes (for flags and localized names). */
const NATIONALITY: Record<string, string> = {
  British: "GB", Dutch: "NL", Monegasque: "MC", Spanish: "ES", Australian: "AU", Mexican: "MX", German: "DE",
  Canadian: "CA", French: "FR", Finnish: "FI", Japanese: "JP", Thai: "TH", Chinese: "CN", Danish: "DK",
  Italian: "IT", American: "US", Brazilian: "BR", Argentine: "AR", Argentinian: "AR", Belgian: "BE",
  "New Zealander": "NZ", Swiss: "CH", Austrian: "AT", Polish: "PL", Russian: "RU", Swedish: "SE", Hungarian: "HU",
  Indonesian: "ID", Venezuelan: "VE", Colombian: "CO", Portuguese: "PT", Irish: "IE", Czech: "CZ", Malaysian: "MY",
  Indian: "IN", Emirati: "AE", Qatari: "QA", Bahraini: "BH", Saudi: "SA", Azerbaijani: "AZ", Turkish: "TR", Korean: "KR",
  "South African": "ZA", Rhodesian: "ZW", Chilean: "CL", Uruguayan: "UY", Liechtensteiner: "LI", Estonian: "EE",
};

const COUNTRY: Record<string, string> = {
  UK: "GB", "United Kingdom": "GB", USA: "US", "United States": "US", UAE: "AE", Netherlands: "NL", Monaco: "MC",
  Spain: "ES", Australia: "AU", Mexico: "MX", Germany: "DE", Canada: "CA", France: "FR", Japan: "JP", China: "CN",
  Italy: "IT", Brazil: "BR", Belgium: "BE", Austria: "AT", Hungary: "HU", Singapore: "SG", Azerbaijan: "AZ",
  Bahrain: "BH", "Saudi Arabia": "SA", Qatar: "QA", Portugal: "PT", Turkey: "TR", Russia: "RU", Korea: "KR",
  Malaysia: "MY", India: "IN", Argentina: "AR", "South Africa": "ZA", Switzerland: "CH", Sweden: "SE", Morocco: "MA",
  "Great Britain": "GB",
};

export const nationalityCode = (n?: string | null) => (n ? NATIONALITY[n] ?? null : null);
export const countryCode = (c?: string | null) => (c ? COUNTRY[c] ?? null : null);

export function regionName(code: string | null, locale: string, fallback = ""): string {
  if (!code) return fallback;
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Brand accent colours per constructor (presentation only; live colours come from the provider when present). */
export const TEAM_COLORS: Record<string, string> = {
  mclaren: "#ff8000", ferrari: "#e8002d", mercedes: "#27f4d2", red_bull: "#3671c6", rb: "#6692ff",
  racing_bulls: "#6692ff", alpine: "#ff87bc", aston_martin: "#229971", williams: "#64c4ff", haas: "#b6babd",
  sauber: "#52e252", audi: "#f50537", cadillac: "#c9c9d1", alphatauri: "#6692ff", alfa: "#c92d4b", renault: "#ffd800",
};
export const teamColor = (id?: string | null, fallback = "#8b93a7") => (id && TEAM_COLORS[id]) || fallback;
