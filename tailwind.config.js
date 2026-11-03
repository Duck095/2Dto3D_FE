/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pocket: {
          paper: 'rgb(var(--joy-paper-rgb) / <alpha-value>)',
          plum: 'rgb(var(--joy-ink-rgb) / <alpha-value>)',
          pink: 'rgb(var(--joy-pink-rgb) / <alpha-value>)',
          lavender: 'rgb(var(--joy-lavender-rgb) / <alpha-value>)',
          mint: 'rgb(var(--joy-mint-rgb) / <alpha-value>)',
          butter: 'rgb(var(--joy-butter-rgb) / <alpha-value>)',
          line: 'rgb(var(--joy-line-rgb) / <alpha-value>)',
          muted: 'rgb(var(--joy-muted-rgb) / <alpha-value>)',
        },
        /* Legacy utility names remain compatible while they migrate to Pocket Joy. */
        brand: {
          primary: 'rgb(var(--joy-ink-rgb) / <alpha-value>)',
          hover: 'rgb(var(--joy-ink-strong-rgb) / <alpha-value>)',
          light: 'rgb(var(--joy-lavender-rgb) / <alpha-value>)',
          soft: 'rgb(var(--joy-lavender-soft-rgb) / <alpha-value>)',
          soft0: 'rgb(var(--joy-paper-rgb) / <alpha-value>)',
          dark: 'rgb(var(--joy-ink-strong-rgb) / <alpha-value>)',
          accent: 'rgb(var(--joy-pink-rgb) / <alpha-value>)',
          'accent-light': 'rgb(var(--joy-butter-rgb) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--joy-surface-rgb) / <alpha-value>)',
          subtle: 'rgb(var(--joy-paper-rgb) / <alpha-value>)',
          muted: 'rgb(var(--joy-lavender-soft-rgb) / <alpha-value>)',
        },
        textColor: {
          primary: 'rgb(var(--joy-ink-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--joy-muted-rgb) / <alpha-value>)',
          muted: 'rgb(var(--joy-muted-rgb) / <alpha-value>)',
        },
        borderColor: {
          DEFAULT: 'rgb(var(--joy-line-rgb) / <alpha-value>)',
          subtle: 'rgb(var(--joy-lavender-rgb) / <alpha-value>)',
        },
        success: '#16a34a',
        danger: '#dc2626',
        warning: '#f59e0b',
      },
      fontFamily: {
        sans: ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        heading: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '5xl-hero': ['3.5rem', { lineHeight: '1.12', letterSpacing: '-0.025em' }],
        '6xl-hero': ['4.5rem', { lineHeight: '1.08', letterSpacing: '-0.03em' }],
      },
      borderRadius: {
        'sm-custom': 'var(--joy-radius-sm)',
        'md-custom': 'var(--joy-radius-md)',
        'lg-custom': 'var(--joy-radius-lg)',
        'xl-custom': 'var(--joy-radius-xl)',
      },
      boxShadow: {
        'sm-custom': 'var(--joy-shadow-sm)',
        'md-custom': 'var(--joy-shadow-md)',
        'lg-custom': 'var(--joy-shadow-lg)',
        'xl-custom': 'var(--joy-shadow-xl)',
        'glow-pocket': 'var(--joy-shadow-glow)',
      },
      animation: {
        'gradient-shift': 'gradient-shift 6s ease infinite',
        'button-shine': 'buttonShine 5s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        pulse: 'pulse 2s ease-in-out infinite',
        'spin-slow': 'spin-slow 20s linear infinite',
        'fade-in-up': 'fadeInUp 0.6s ease forwards',
      },
      keyframes: {
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        buttonShine: {
          '0%, 65%': { transform: 'translateX(-115%)' },
          '85%, 100%': { transform: 'translateX(115%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
    },
  },
  plugins: [],
}
