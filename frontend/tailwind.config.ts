import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: '#FFFDF8',
        surface: '#FFFFFF',
        'surface-alt': '#F7F4ED',
        'surface-muted': '#F1EEE7',
        primary: '#5E60FF',
        'primary-light': '#7D7EFF',
        accent: '#FF7A59',
        success: '#1FC98E',
        deep: '#1D1D1F',
        muted: '#6E6E73',
        border: 'rgba(0,0,0,0.05)',
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      fontSize: {
        hero: ['64px', { lineHeight: '1.1', fontWeight: '700' }],
        'section': ['32px', { lineHeight: '1.2', fontWeight: '600' }],
        'score': ['72px', { lineHeight: '1', fontWeight: '700', letterSpacing: '-0.04em' }],
      },
      borderRadius: {
        button: '18px',
        card: '20px',
        slider: '12px',
      },
      boxShadow: {
        card: '0 8px 30px rgba(0,0,0,0.04)',
        'card-hover': '0 12px 40px rgba(0,0,0,0.06)',
        'glow-primary': '0 0 0 4px rgba(94,96,255,0.08)',
        'glow-accent': '0 0 0 4px rgba(255,122,89,0.08)',
        'slider-handle': '0 2px 8px rgba(0,0,0,0.12)',
      },
      maxWidth: {
        game: '480px',
      },
      animation: {
        'float': 'float 20s ease-in-out infinite',
        'float-delayed': 'float 25s ease-in-out 5s infinite',
        'float-slow': 'float 30s ease-in-out 10s infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'count-up': 'countUp 0.6s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0) translateX(0)', opacity: '0.3' },
          '25%': { transform: 'translateY(-20px) translateX(10px)', opacity: '0.5' },
          '50%': { transform: 'translateY(-10px) translateX(-10px)', opacity: '0.4' },
          '75%': { transform: 'translateY(-30px) translateX(5px)', opacity: '0.3' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config