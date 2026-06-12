import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#FF7A00",
          secondary: "#FFB347",
          glow: "#FF7A0033",
          muted: "#FF7A001A"
        },
        surface: {
          DEFAULT: "#0A0A0F",
          raised: "#12121A",
          overlay: "#1A1A24",
          glass: "rgba(18, 18, 26, 0.72)"
        },
        line: {
          DEFAULT: "rgba(255, 255, 255, 0.08)",
          strong: "rgba(255, 255, 255, 0.14)"
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"]
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        glow: "0 0 40px rgba(255, 122, 0, 0.15)",
        "glow-sm": "0 0 20px rgba(255, 122, 0, 0.12)",
        premium: "0 4px 24px rgba(0, 0, 0, 0.35), 0 1px 0 rgba(255, 255, 255, 0.04) inset"
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "mesh-dark":
          "radial-gradient(at 40% 20%, rgba(255, 122, 0, 0.08) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(255, 179, 71, 0.06) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(255, 122, 0, 0.04) 0px, transparent 50%)"
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        shimmer: "shimmer 2s infinite linear",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite"
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(255, 122, 0, 0.1)" },
          "50%": { boxShadow: "0 0 32px rgba(255, 122, 0, 0.25)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
