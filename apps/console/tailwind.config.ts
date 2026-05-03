import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: {
      bg:        "#0b0f17",
      panel:     "#11162055",
      panelSolid:"#111620",
      accent:    "#5cf2c0",
      warn:      "#fcb045",
      danger:    "#ff5c5c",
      muted:     "#7c869b",
    },
  }},
  plugins: [],
};
export default config;
