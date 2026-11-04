import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {

      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        accent: {
          DEFAULT: "#2563EB",
          hover: "#1D4ED8",
        },
        navy: "#1E3A8A",
        "panel-bg": "#F0F5FE",
        "page-bg": "#F5F8FD",
        "card-border": "#DCE5F5",
        tint: "#E8EFFD",
        chart: {
          blue: "#2563EB",
          pink: "#E8527C",
          teal: "#14A59B",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)"],
        body: ["var(--font-body)"],
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar-hide')
  ],
} satisfies Config;
