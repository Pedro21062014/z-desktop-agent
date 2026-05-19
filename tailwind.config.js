/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,jsx,ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#6366f1',
        'primary-hover': '#818cf8',
        'bg-primary': '#0d0d0d',
        'bg-secondary': '#1a1a2e',
        'bg-tertiary': '#16213e',
        'bg-hover': '#1e2a4a',
        'bg-active': '#253356',
        surface: '#111118',
        'surface-light': '#1a1a28',
      },
    },
  },
  plugins: [],
};
