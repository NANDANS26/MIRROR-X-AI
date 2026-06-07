import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Lenis from 'lenis'
import './index.css'
import App from './App.tsx'

// ── Lenis smooth scrolling initialization ──────────────────────────────────
// Initialize Lenis after the React root mounts so it can measure the DOM.
// Exported for use in GSAP ScrollTrigger integration.
export const lenis = new Lenis({
  duration: 1.2,
  easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
})

function rafLoop(time: number) {
  lenis.raf(time)
  requestAnimationFrame(rafLoop)
}

requestAnimationFrame(rafLoop)
// ────────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
