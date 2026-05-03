import '@babylonjs/core/Misc/tools.js';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initAudioOnGesture } from './engine/SoundManager'
import './index.css'
import App from './App.tsx'

// Defer AudioContext creation until first user gesture (Chrome autoplay policy)
const events = ['click', 'keydown', 'touchstart', 'pointerdown'];
function onFirstGesture() {
  initAudioOnGesture();
  for (const ev of events) document.removeEventListener(ev, onFirstGesture);
}
for (const ev of events) document.addEventListener(ev, onFirstGesture);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
