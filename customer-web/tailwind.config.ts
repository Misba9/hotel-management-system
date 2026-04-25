import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#FF6B35",
          secondary: "#FFD166",
          background: "#FFF8F3",
          accent: "#2EC4B6"
        }
      },
      boxShadow: {
        glass: "0 8px 32px rgba(255, 107, 53, 0.16)"
      }
    }
  },
  plugins: []
};

export default config;
