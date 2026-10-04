export const config = {
  season: process.env.F1_SEASON || "current",
  jolpica: (process.env.JOLPICA_BASE_URL || "https://api.jolpi.ca/ergast/f1").replace(/\/$/, ""),
  openf1: (process.env.OPENF1_BASE_URL || "https://api.openf1.org/v1").replace(/\/$/, ""),
  openf1Token: process.env.F1_API_KEY || "",
};
export const isMock = /localhost|127\.0\.0\.1/.test(config.jolpica);
