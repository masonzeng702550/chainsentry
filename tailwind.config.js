/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        danger: '#e11d48',
        warn: '#f59e0b',
        safe: '#10b981',
        ink: '#0f172a',
        panel: '#111827',
      },
    },
  },
  plugins: [],
};
