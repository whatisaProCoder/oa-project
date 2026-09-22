/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#000000', // Deep black
        surface: '#0a0000',    // Reddish black surface
        primary: '#ff3333',    // Bright crisp red
        primaryDark: '#cc0000',
        accent: '#ff5555',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ff3333',
      },
      boxShadow: {
        'neon-cyan': '0 0 10px rgba(255, 51, 51, 0.4), 0 0 20px rgba(255, 51, 51, 0.2)',
        'neon-red': '0 0 10px rgba(255, 51, 51, 0.5), 0 0 20px rgba(255, 51, 51, 0.3)',
        'glass': '0 4px 30px rgba(0, 0, 0, 0.5)',
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)',
        'glow-gradient': 'radial-gradient(circle at 50% -20%, rgba(255, 51, 51, 0.15), rgba(0, 0, 0, 1) 70%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
