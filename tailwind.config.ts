import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111326",
        muted: "#686b7d",
        line: "#e2e3ea",
        canvas: "#f5f6fa",
        violet: "#5d3df5",
        coral: "#ff715b",
      },
      boxShadow: {
        soft: "0 12px 34px rgba(25, 20, 61, 0.07)",
      },
    },
  },
  plugins: [],
} satisfies Config;
