/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        groww: {
          bg: '#F8FAFC',
          card: '#FFFFFF',
          surface: '#F1F5F9',
          hover: '#E2E8F0',
          border: '#E2E8F0',
          borderLight: '#CBD5E1',
          green: '#00D09C',
          greenHover: '#00B386',
          greenBg: 'rgba(0, 208, 156, 0.12)',
          red: '#EB5B5B',
          redHover: '#D94848',
          redBg: 'rgba(235, 91, 91, 0.12)',
          textMuted: '#64748B',
          textSubtle: '#94A3B8',
          textDark: '#0F172A',
          blue: '#437EF7',
          blueBg: 'rgba(67, 126, 247, 0.12)',
          yellow: '#FFB800',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'flash-green': 'flashGreen 0.6s ease-out',
        'flash-red': 'flashRed 0.6s ease-out',
        'pulse-subtle': 'pulseSubtle 2s infinite',
      },
      keyframes: {
        flashGreen: {
          '0%': { backgroundColor: 'rgba(0, 208, 156, 0.4)' },
          '100%': { backgroundColor: 'transparent' },
        },
        flashRed: {
          '0%': { backgroundColor: 'rgba(235, 91, 91, 0.4)' },
          '100%': { backgroundColor: 'transparent' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
}
