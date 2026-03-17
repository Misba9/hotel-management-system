import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#FF6B35",
          secondary: "#FFD166",
          background: "#FFF8F3"
        }
      }
    }
  },
  plugins: []
};

export default config;
