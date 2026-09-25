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
        // Valsts pārvaldes & LSM iedvesmotā neitrālā palete
        par: {
          DEFAULT: '#15803D', // Muted Pine Forest Green (WCAG 2.1 AA)
          hover: '#166534',
          subtle: '#F0FDF4',
          border: '#BBF7D0',
        },
        pret: {
          DEFAULT: '#991B1B', // Muted Brick / Terracotta
          hover: '#7F1D1D',
          subtle: '#FEF2F2',
          border: '#FECACA',
        },
        atturas: {
          DEFAULT: '#B45309', // Amber Ochre
          hover: '#92400E',
          subtle: '#FFFBEB',
          border: '#FDE68A',
        },
        nebalso: {
          DEFAULT: '#64748B', // Cool Slate / Fog Grey
          hover: '#475569',
          subtle: '#F8FAFC',
          border: '#E2E8F0',
        },
        baltic: {
          950: '#0B0F19', // Deep Baltic Slate
          900: '#0F172A', // Baltic Navy base
          800: '#1E293B',
          700: '#334155',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
