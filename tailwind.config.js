/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0B1220',
          900: '#111A2C',
          800: '#1B2A44',
          700: '#26375A',
        },
        paper: {
          50: '#F7F8FA',
          100: '#EEF1F5',
        },
        signal: {
          teal: '#0F9D8C',
          amber: '#D98E2A',
          coral: '#E0654F',
        },
      },
      fontFamily: {
        display: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
