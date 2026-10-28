/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-black': '#000000', // Deepest Black
        'brand-surface': '#1A1A1A', // Elevated Surface (Lighter for contrast)
        'brand-cyan': '#00C8FF', // Brighter Cyan
        'brand-purple': '#8A2BE2', // Electric Purple
        'brand-text': '#FFFFFF', // Pure White
        'brand-dim': '#A0A0A0', // Lighter Gray for readability
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0, 180, 216, 0.15)',
        'glow-purple': '0 0 20px rgba(114, 9, 183, 0.15)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      }
    },
  },
  plugins: [],
}
