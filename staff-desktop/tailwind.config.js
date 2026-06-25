/** @type {import('tailwindcss').Config} */
const themePreset = require("../shared/theme/tailwind-preset.cjs");

module.exports = {
  presets: [themePreset],
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        /** Legacy POS aliases — map to centralized theme tokens */
        brand: {
          teal: "var(--theme-primary)",
          emerald: "var(--theme-success)"
        }
      }
    }
  },
  plugins: []
};
