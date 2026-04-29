import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          base: '#FFFDF8',
          white: '#FFFFFF',
          soft: '#F7F4ED',
          muted: '#F1EEE7',
        },
        primary: {
          DEFAULT: '#5E60FF',
          gradient: '#7D7EFF',
        },
        accent: {
          DEFAULT: '#FF7A59',
        },
        success: {
          DEFAULT: '#1FC98E',
        },
        text: {
          deep: '#1D1D1F',
          muted: '#6E6E73',
        },
      },
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      fontSize: {
        hero: ['64px', { lineHeight: '1.1', fontWeight: '700' }],
        'section': ['32px', { lineHeight: '1.2', fontWeight: '600' }],
        'score': ['72px', { lineHeight: '1', fontWeight: '700', letterSpacing: '-0.04em' }],
        body: ['16px', { lineHeight: '1.5', fontWeight: '400' }],
      },
      borderRadius: {
        pill: '18px',
        card: '20px',
        slider: '12px',
      },
      boxShadow: {
        card: '0 8px 30px rgba(0,0,0,0.04)',
        'card-hover': '0 12px 40px rgba(0,0,0,0.06)',
        glow: '0 0 0 4px rgba(94,96,255,0.08)',
        'glow-accent': '0 0 0 4px rgba(255,122,89,0.08)',
      },
      maxWidth: {
        game: '480px',
      },
      animation: {
        'float': 'float 20s ease-in-out infinite',
        'float-delayed': 'float 25s ease-in-out 5s infinite',
        'float-slow': 'float 30s ease-in-out 10s infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0) translateX(0)' },
          '25%': { transform: 'translateY(-20px) translateX(10px)' },
          '50%': { transform: 'translateY(-10px) translateX(-10px)' },
          '75%': { transform: 'translateY(-30px) translateX(5px)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;