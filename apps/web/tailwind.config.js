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
          bg: '#0c0d14',
          card: '#12141f',
          surface: '#181b2a',
          hover: '#202438',
          border: '#24283b',
          borderLight: '#2e344d',
          green: '#00D09C',
          greenHover: '#00B386',
          greenBg: 'rgba(0, 208, 156, 0.12)',
          red: '#EB5B5B',
          redHover: '#D94848',
          redBg: 'rgba(235, 91, 91, 0.12)',
          textMuted: '#8b949e',
          textSubtle: '#6A7187',
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
