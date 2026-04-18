/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sage: { 300: '#b8c9b2', 500: '#758d6e', 700: '#465640' },
        cream: { 100: '#faf7f2', 200: '#f0ece1' },
        charcoal: { 800: '#2a2d28', 900: '#1a1c19' },
      },
      fontFamily: {
        serif: ['Playfair Display', 'serif'],
        sans: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
};
