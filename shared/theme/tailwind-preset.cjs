/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        theme: {
          background: "var(--theme-background)",
          surface: "var(--theme-surface)",
          card: "var(--theme-card)",
          hover: "var(--theme-hover)",
          border: "var(--theme-border)",
          primary: "var(--theme-primary)",
          "primary-hover": "var(--theme-primary-hover)",
          "primary-muted": "var(--theme-primary-muted)",
          success: "var(--theme-success)",
          "success-muted": "var(--theme-success-muted)",
          warning: "var(--theme-warning)",
          "warning-muted": "var(--theme-warning-muted)",
          danger: "var(--theme-danger)",
          "danger-muted": "var(--theme-danger-muted)",
          info: "var(--theme-info)",
          "info-muted": "var(--theme-info-muted)",
          "text-primary": "var(--theme-text-primary)",
          "text-secondary": "var(--theme-text-secondary)",
          "text-disabled": "var(--theme-text-disabled)",
          divider: "var(--theme-divider)",
          overlay: "var(--theme-overlay)",
          glass: "var(--theme-glass)",
          "input-bg": "var(--theme-input-bg)",
          skeleton: "var(--theme-skeleton)"
        },
        brand: {
          primary: "var(--theme-primary)",
          secondary: "var(--theme-primary-hover)",
          glow: "var(--theme-shadow-glow)",
          muted: "var(--theme-primary-muted)"
        },
        surface: {
          DEFAULT: "var(--theme-surface)",
          raised: "var(--theme-card)",
          secondary: "var(--theme-surface-secondary)",
          overlay: "var(--theme-hover)",
          glass: "var(--theme-glass)"
        },
        line: {
          DEFAULT: "var(--theme-divider)",
          strong: "var(--theme-border)"
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"]
      },
      boxShadow: {
        glass: "var(--theme-shadow-glass)",
        glow: "var(--theme-shadow-glow)",
        "glow-sm": "var(--theme-shadow-glow-sm)",
        premium: "var(--theme-shadow-card)",
        card: "var(--theme-shadow-card)",
        "card-hover": "var(--theme-shadow-card-hover)",
        dropdown: "var(--theme-shadow-dropdown)"
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "mesh-dark":
          "radial-gradient(at 40% 20%, rgba(79, 140, 255, 0.08) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(79, 140, 255, 0.06) 0px, transparent 50%)",
        "mesh-light":
          "radial-gradient(at 40% 20%, rgba(37, 99, 235, 0.04) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(37, 99, 235, 0.03) 0px, transparent 50%)"
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        shimmer: "theme-shimmer 2s infinite linear",
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
        "theme-shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(79, 140, 255, 0.1)" },
          "50%": { boxShadow: "0 0 32px rgba(79, 140, 255, 0.25)" }
        }
      },
      borderRadius: {
        theme: "0.75rem",
        "theme-lg": "1rem"
      }
    }
  },
  plugins: []
};
