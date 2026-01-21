import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors - Refined Industrial palette
        brand: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#FBBF24",
          500: "#F59E0B",
          600: "#D97706", // Primary accent - rich amber
          700: "#B45309",
          800: "#92400E",
          900: "#78350F",
          950: "#451A03",
        },
        // Sidebar - deep slate
        sidebar: {
          DEFAULT: "#0F172A",
          foreground: "#F8FAFC",
          muted: "#64748B",
          accent: "#1E293B",
          border: "#334155",
        },
        // Semantic colors
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Status colors for QMRL/QMHQ
        status: {
          todo: "#9CA3AF",
          "in-progress": "#3B82F6",
          done: "#10B981",
          rejected: "#EF4444",
          pending: "#F59E0B",
          awaiting: "#8B5CF6",
        },
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        display: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      fontSize: {
        // Custom type scale for better hierarchy
        "display-2xl": ["4.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-xl": ["3.75rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-lg": ["3rem", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        "display-md": ["2.25rem", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        "display-sm": ["1.875rem", { lineHeight: "1.25", letterSpacing: "-0.01em" }],
        "display-xs": ["1.5rem", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        // Refined shadows for depth
        "soft-sm": "0 1px 2px 0 rgb(0 0 0 / 0.03), 0 1px 3px 0 rgb(0 0 0 / 0.05)",
        soft: "0 2px 4px 0 rgb(0 0 0 / 0.03), 0 4px 6px -1px rgb(0 0 0 / 0.05)",
        "soft-md": "0 4px 6px -1px rgb(0 0 0 / 0.05), 0 8px 15px -3px rgb(0 0 0 / 0.08)",
        "soft-lg": "0 10px 15px -3px rgb(0 0 0 / 0.05), 0 20px 25px -5px rgb(0 0 0 / 0.08)",
        "soft-xl": "0 20px 25px -5px rgb(0 0 0 / 0.05), 0 40px 50px -12px rgb(0 0 0 / 0.1)",
        // Colored shadows for accent elements
        "brand-sm": "0 2px 8px -2px rgb(217 119 6 / 0.25)",
        "brand-md": "0 4px 14px -3px rgb(217 119 6 / 0.3)",
        "brand-lg": "0 8px 20px -4px rgb(217 119 6 / 0.35)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "fade-up": "fadeUp 0.5s ease-out forwards",
        "slide-in-left": "slideInLeft 0.3s ease-out forwards",
        "slide-in-right": "slideInRight 0.3s ease-out forwards",
        "scale-in": "scaleIn 0.2s ease-out forwards",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      backgroundImage: {
        // Subtle patterns for depth
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "noise-light": "url('/noise-light.png')",
        "grid-pattern":
          "linear-gradient(to right, rgb(0 0 0 / 0.02) 1px, transparent 1px), linear-gradient(to bottom, rgb(0 0 0 / 0.02) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid-sm": "16px 16px",
        "grid-md": "24px 24px",
        "grid-lg": "32px 32px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
