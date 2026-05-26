import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/KSP-at-home/',

  plugins: [
    tailwindcss(),
  ],
})