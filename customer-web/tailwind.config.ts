import type { Config } from "tailwindcss";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const themePreset = require("../shared/theme/tailwind-preset.cjs");

const config: Config = {
  presets: [themePreset],
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          background: "var(--theme-background)",
          accent: "var(--theme-info)"
        }
      }
    }
  },
  plugins: []
};

export default config;
