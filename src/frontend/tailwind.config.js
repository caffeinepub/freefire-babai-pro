/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Orbitron", "sans-serif"],
        body: ["Rajdhani", "sans-serif"],
      },
      colors: {
        fire: {
          50:  "oklch(0.97 0.05 50)",
          100: "oklch(0.92 0.10 46)",
          200: "oklch(0.84 0.16 44)",
          300: "oklch(0.76 0.21 42)",
          400: "oklch(0.68 0.23 38)",
          500: "oklch(0.60 0.24 32)",
          600: "oklch(0.52 0.22 27)",
          700: "oklch(0.44 0.19 24)",
        },
        background: "oklch(var(--background))",
        foreground: "oklch(var(--foreground))",
        card: {
          DEFAULT: "oklch(var(--card))",
          foreground: "oklch(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "oklch(var(--primary))",
          foreground: "oklch(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "oklch(var(--secondary))",
          foreground: "oklch(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "oklch(var(--muted))",
          foreground: "oklch(var(--muted-foreground))",
        },
        border: "oklch(var(--border))",
        input: "oklch(var(--input))",
        ring: "oklch(var(--ring))",
        destructive: {
          DEFAULT: "oklch(var(--destructive))",
          foreground: "oklch(var(--destructive-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        fire: "0 0 20px rgba(255,60,0,0.3)",
        "fire-lg": "0 0 40px rgba(255,60,0,0.5)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
