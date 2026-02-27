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
          950: '#0c0c16',
          900: '#131320',
          800: '#1a1a28',
          750: '#1f1f30',
          700: '#272636',
          600: '#2e2e42',
          500: '#3c3c5c',
          400: '#58587c',
          300: '#7878a8',
          200: '#a4a4c4',
          150: '#c4c4dc',
          100: '#e2e2f0',
          50:  '#f1f1f9',
        },
        gold: {
          700: '#b07828',
          600: '#c99032',
          500: '#dfaa3e',
          400: '#f2c24e',
          300: '#f6d478',
          200: '#fbe19a',
          100: '#fdf0c4',
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
        "primary": "#f2c24e",
        "primaryLight": "#f6d478",
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
        'gold-glow': '0 0 20px rgba(242,194,78,0.18)',
        'gold-glow-lg': '0 0 40px rgba(242,194,78,0.25)',
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
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(242,194,78,0.35)' },
          '50%': { boxShadow: '0 0 0 8px rgba(242,194,78,0)' },
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