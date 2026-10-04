import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#07080b", 900: "#0b0d12", 800: "#11141b", 700: "#1a1e28" },
        accent: { DEFAULT: "#ff3b30", soft: "#ff6a3d", amber: "#ff9f43" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        pulseDot: { "0%,100%": { opacity: "1", transform: "scale(1)" }, "50%": { opacity: ".45", transform: "scale(.8)" } },
      },
      animation: { pulseDot: "pulseDot 1.4s ease-in-out infinite" },
    },
  },
  plugins: [],
};
export default config;
