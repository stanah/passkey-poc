/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cute-pink': '#ff7eb3',     // Brighter pink for better contrast
        'cute-blue': '#5bbcff',     // Brighter blue
        'cute-yellow': '#fff5b1',
        'cute-purple': '#b07bff',   // Brighter purple
        'cute-text': '#5a4a6e',
        'cute-bg': '#fff9f9',
      },
      borderRadius: {
        '3xl': '1.5rem',
        'blob': '2rem',
      },
      animation: {
        'bounce-slow': 'bounce 3s infinite',
        'wiggle': 'wiggle 1s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      },
      fontFamily: {
        'cute': ['"Nunito"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
