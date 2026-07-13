/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Legacy token — still referenced by index.html <body>. Now matches
        // the phosphor terminal background so there's no off-theme flash.
        arcade: {
          bg: '#030c06',
        },
        // Phosphor terminal palette. Game pages predate these tokens and
        // inline the same hex values; keep the two in sync.
        term: {
          bg: '#030c06',
          panel: '#040e07',
          line: '#0f2a18',
          green: '#22c55e',
          bright: '#4ade80',
          pale: '#86efac',
          mut: '#3f9e68', // muted copy — smallest text that still must be read
          faint: '#26714a', // decorative hints only, never load-bearing text
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
