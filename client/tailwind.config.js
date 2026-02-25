// client/tailwind.config.js
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
        // Obsidian Intelligence Design System
        ink: {
          950: '#08080f',
          900: '#0e0e17',
          800: '#15151f',
          750: '#19192a',
          700: '#1f1f2e',
          600: '#272738',
          500: '#343450',
          400: '#4e4e70',
          300: '#7474a0',
          200: '#a0a0c0',
          150: '#c0c0d8',
          100: '#e0e0ee',
          50:  '#f0f0f8',
        },
        gold: {
          700: '#a07020',
          600: '#b88428',
          500: '#d09a32',
          400: '#e8b844',
          300: '#f4cc6a',
          200: '#fad98e',
          100: '#fcedb8',
        },
        jade: {
          600: '#15896a',
          500: '#1da880',
          400: '#2dd4a0',
          300: '#5ee4b8',
        },
        rose: {
          600: '#c43636',
          500: '#e04848',
          400: '#f46464',
          300: '#f98a8a',
        },
        ember: {
          600: '#c05818',
          500: '#e06a20',
          400: '#f07e38',
          300: '#f5a060',
        },
        // Legacy compatibility
        "primary": "#e8b844",
        "primaryLight": "#f4cc6a",
        "positive": "#2dd4a0",
        "negative": "#e04848",
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
        body: ['Outfit', 'sans-serif'],
      },
      borderRadius: {
        'sm': '0.375rem',
        'DEFAULT': '0.5rem',
        'md': '0.625rem',
        'lg': '0.875rem',
        'xl': '1.125rem',
        '2xl': '1.5rem',
        'full': '9999px',
      },
      boxShadow: {
        'ink-sm': '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'ink': '0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)',
        'ink-lg': '0 12px 40px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4)',
        'ink-xl': '0 24px 64px rgba(0,0,0,0.7), 0 8px 24px rgba(0,0,0,0.5)',
        'gold-glow': '0 0 20px rgba(232,184,68,0.15)',
        'gold-glow-lg': '0 0 40px rgba(232,184,68,0.2)',
        'card': '0 1px 0 rgba(255,255,255,0.04) inset, 0 2px 8px rgba(0,0,0,0.4)',
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
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(232,184,68,0.3)' },
          '50%': { boxShadow: '0 0 0 8px rgba(232,184,68,0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'fade-up': 'fade-up 0.5s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.3s ease-out forwards',
        'slide-in-left': 'slide-in-left 0.3s ease-out forwards',
        'scale-in': 'scale-in 0.3s ease-out forwards',
        'shimmer': 'shimmer 1.5s infinite linear',
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}