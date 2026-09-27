import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0b1120',
          raised: '#111a2e',
          border: '#1e293b',
        },
        brand: {
          50: '#eef7ff',
          100: '#d9edff',
          200: '#bce0ff',
          300: '#8ecdff',
          400: '#59b0ff',
          500: '#338eff',
          600: '#1b6ef5',
          700: '#1457e1',
          800: '#1747b6',
          900: '#193f8f',
        },
      },
    },
  },
  plugins: [],
};

export default config;
