import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          50: '#f7f7f8',
          100: '#ececf1',
          200: '#d9d9e3',
          300: '#c5c5d2',
          400: '#acacbe',
          500: '#8e8ea0',
          600: '#6e6e80',
          700: '#4a4a5a',
          800: '#343541',
          850: '#2a2b36',
          900: '#202123',
          950: '#171719',
        },
        accent: {
          green: '#10b981',
          red: '#ef4444',
          blue: '#3b82f6',
          amber: '#f59e0b',
        },
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': '#d1d5db',
            '--tw-prose-headings': '#f3f4f6',
            '--tw-prose-links': '#10b981',
            '--tw-prose-bold': '#f3f4f6',
            '--tw-prose-code': '#10b981',
            '--tw-prose-pre-bg': '#171719',
            '--tw-prose-pre-code': '#d1d5db',
            '--tw-prose-quotes': '#9ca3af',
            '--tw-prose-quote-borders': '#374151',
            '--tw-prose-th-borders': '#374151',
            '--tw-prose-td-borders': '#1f2937',
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

export default config;
