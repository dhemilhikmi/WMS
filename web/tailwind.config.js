/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Sora"', 'system-ui', 'sans-serif'],
        ui:      ['"Manrope"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        sans:    ['"Manrope"', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#1E4FD8',
          50:  '#EEF3FE',
          100: '#D9E3FC',
          600: '#1A45BF',
          700: '#163AA0',
        },
        accent: {
          DEFAULT: '#FF6A1F',
          50:  '#FFF1E8',
          100: '#FFDFC8',
          600: '#E55A14',
          700: '#C44A0F',
        },
        ink: {
          DEFAULT: '#0E1530',
          2: '#2B324A',
          3: '#5A6178',
          4: '#9097A8',
        },
        'wm-bg':      '#F4F1EB',
        'wm-line':    '#E5E8EE',
        'wm-success': '#1F8A5B',
        'wm-warning': '#E5A50A',
        'wm-danger':  '#D24D3F',
      },
      boxShadow: {
        'wm-sm': '0 1px 2px rgba(14, 21, 48, 0.06)',
        'wm-md': '0 6px 16px rgba(14, 21, 48, 0.10)',
        'wm-lg': '0 18px 40px rgba(14, 21, 48, 0.18)',
      },
      borderRadius: {
        'wm-sm': '6px',
        'wm-md': '10px',
        'wm-lg': '14px',
        'wm-xl': '20px',
      },
    },
  },
  safelist: [
    // brand
    'bg-brand', 'bg-brand-50', 'bg-brand-100', 'bg-brand-600', 'bg-brand-700',
    'text-brand', 'text-brand-50', 'text-brand-100', 'text-brand-600', 'text-brand-700',
    'border-brand', 'border-brand-50', 'border-brand-100', 'border-brand-600',
    'hover:bg-brand', 'hover:bg-brand-50', 'hover:bg-brand-100', 'hover:bg-brand-600',
    'hover:text-brand', 'hover:border-brand',
    'active:bg-brand-50', 'active:bg-brand-100',
    'ring-brand', 'focus:border-brand', 'focus:ring-brand',
    // accent
    'bg-accent', 'bg-accent-50', 'bg-accent-100', 'bg-accent-600',
    'text-accent', 'text-accent-600',
    'border-accent', 'hover:bg-accent-600',
    // ink
    'text-ink', 'text-ink-2', 'text-ink-3', 'text-ink-4',
    // wm tokens
    'bg-wm-bg', 'bg-wm-success', 'bg-wm-warning', 'bg-wm-danger',
    'text-wm-success', 'text-wm-warning', 'text-wm-danger',
    'border-wm-line',
    // radius
    'rounded-wm-sm', 'rounded-wm-md', 'rounded-wm-lg', 'rounded-wm-xl',
    // shadow
    'shadow-wm-sm', 'shadow-wm-md', 'shadow-wm-lg',
    // font
    'font-display', 'font-ui', 'font-mono',
  ],
  plugins: [],
}
