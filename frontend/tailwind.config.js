/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a12",
        panel: "rgba(255,255,255,0.04)",
        gold: "#f5c518",
        olympic: {
          blue: "#0085c7",
          yellow: "#f4c300",
          black: "#000000",
          green: "#009f3d",
          red: "#df0024",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(245,197,24,0.45)",
        card: "0 8px 40px -12px rgba(0,0,0,0.6)",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
