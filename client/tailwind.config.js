// client/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Starbucks-Inspired Warm Light Design System
        green: {
          DEFAULT: '#006241',
          accent: '#00754A',
          house: '#1E3932',
          uplift: '#2b5148',
          light: '#d4e9e2',
        },
        gold: {
          DEFAULT: '#cba258',
          50: '#fdf8ed',
          100: '#f5e6c3',
          200: '#e0c88a',
          light: '#dfc49d',
          lightest: '#faf6ee',
          dark: '#8a6d2b',
          700: '#9e7a2e',
          800: '#8a6d2b',
          900: '#6b5419',
          950: '#4a3a10',
        },
        error: {
          DEFAULT: '#c82014',
          light: '#e8524a',
          bg: 'rgba(200, 32, 20, 0.08)',
        },
        warm: {
          DEFAULT: '#d4a017',
          light: '#e0bc5a',
          bg: 'rgba(212, 160, 23, 0.08)',
        },
        cream: {
          DEFAULT: '#f2f0eb',
          ceramic: '#edebe9',
        },
        // Legacy compatibility — map to new system
        "primary": "#006241",
        "primaryLight": "#00754A",
        "positive": "#006241",
        "negative": "#c82014",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Lora', 'Georgia', 'serif'],
        mono: ['Inter', 'Menlo', 'monospace'],
        body: ['Inter', 'sans-serif'],
        manrope: ['Manrope', 'sans-serif'],
      },
      borderRadius: {
        'sm': '0.375rem',
        'DEFAULT': '0.5rem',
        'md': '0.625rem',
        'lg': '0.75rem',
        'card': '12px',
        'pill': '50px',
        'full': '9999px',
      },
      boxShadow: {
        'warm-sm': '0 0 0.5px rgba(0,0,0,0.14), 0 1px 1px rgba(0,0,0,0.24)',
        'warm': '0 0 0.5px rgba(0,0,0,0.14), 0 2px 4px rgba(0,0,0,0.12)',
        'warm-lg': '0 0 0.5px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.10)',
        'warm-xl': '0 8px 12px rgba(0,0,0,0.14), 0 0 6px rgba(0,0,0,0.24)',
        'card': '0 0 0.5px rgba(0,0,0,0.14), 0 1px 1px rgba(0,0,0,0.24)',
        'green-glow': '0 0 20px rgba(0,98,65,0.2)',
        'whisper': '0 2px 4px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.08)',
        'frap': '0 8px 24px rgba(0, 98, 65, 0.3)',
        'soft': '0 4px 20px rgba(0, 0, 0, 0.05)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        'pulse-green': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0,98,65,0.3)' },
          '50%': { boxShadow: '0 0 0 8px rgba(0,98,65,0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'fade-up': 'fade-up 0.5s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.3s ease-out forwards',
        'slide-in-left': 'slide-in-left 0.3s ease-out forwards',
        'scale-in': 'scale-in 0.3s ease-out forwards',
        'shimmer': 'shimmer 1.5s infinite linear',
        'pulse-green': 'pulse-green 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
