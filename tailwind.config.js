/** @type {import('tailwindcss').Config} */

// The palette lives here so the component can stay on core Tailwind utilities
// (bg-*, text-*, border-*) rather than arbitrary values or custom CSS.
// "Drafting film": cool light ground, near-black blue ink, one ultramarine
// accent that is used for verdicts and nothing else.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ground: '#E8ECF0',
        surface: '#FFFFFF',
        ink: '#0D1219',
        'ink-2': '#59636E',
        'ink-3': '#98A1AB',
        rule: '#CBD2D9',
        accent: '#2438CE',
        'accent-tint': '#E7E9FB',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'SF Mono',
          'Menlo',
          'Consolas',
          'Liberation Mono',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};
