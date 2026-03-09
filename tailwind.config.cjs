/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        arcade: {
          bg: '#0a0a1a',
          card: '#141428',
          border: '#2a2a4a',
          accent: '#8b5cf6',
          'accent-hover': '#a78bfa',
          gold: '#f59e0b',
          neon: '#22d3ee',
          success: '#10b981',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['"Press Start 2P"', 'monospace'],
      },
    },
  },
  plugins: [],
};
