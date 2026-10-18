/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#FFFFFF',
          card: '#FFFFFF',
          border: '#E2E8F0',
          yellow: 'rgb(254, 248, 76)',
          accent: 'rgb(254, 248, 76)',
          blue: '#2563EB',
          indigo: '#4F46E5',
          pink: '#EC4899',
          emerald: '#10B981',
          amber: '#F59E0B',
          text: '#0F172A',
          muted: '#64748B'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
