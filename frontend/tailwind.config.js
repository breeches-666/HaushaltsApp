/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      boxShadow: {
        'neo': '6px 6px 12px #bebebe, -6px -6px 12px #ffffff',
        'neo-sm': '3px 3px 6px #bebebe, -3px -3px 6px #ffffff',
        'neo-inset': 'inset 3px 3px 6px #bebebe, inset -3px -3px 6px #ffffff',
        'neo-flat': '2px 2px 4px #bebebe, -2px -2px 4px #ffffff',
        'neo-dark': '6px 6px 12px #181825, -6px -6px 12px #242437',
        'neo-dark-sm': '3px 3px 6px #181825, -3px -3px 6px #242437',
        'neo-dark-inset': 'inset 3px 3px 6px #181825, inset -3px -3px 6px #242437',
        'neo-dark-flat': '2px 2px 4px #181825, -2px -2px 4px #242437',
        'neo-nav': '0 -4px 12px #bebebe',
        'neo-nav-dark': '0 -4px 12px #181825',
        'neo-fab': '4px 4px 10px #bebebe, -4px -4px 10px #ffffff, inset 0 0 0 transparent',
        'neo-fab-dark': '4px 4px 10px #181825, -4px -4px 10px #242437',
      },
    },
  },
  plugins: [],
}
