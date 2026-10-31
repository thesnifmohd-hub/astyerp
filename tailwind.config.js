/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        asty: {
          charcoal: '#1D2527',
          slate: '#8DA1B1',
          black: '#0B0B0B',
          surface: '#F6F8F9',
          border: '#DCE3E8',
        },
      },
      fontFamily: {
        heading: ['"Neue Haas Grotesk Display Pro"', '"Neue Haas Grotesk Text Pro"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

