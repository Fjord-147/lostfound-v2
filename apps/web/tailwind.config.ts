import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 明亮青蓝主题（延续 v1 #0891b2）
        brand: {
          DEFAULT: "#0891b2",
          dark: "#0e7490",
          light: "#ecfeff",
        },
        accent: "#f59e0b",
      },
    },
  },
  plugins: [],
};
export default config;
