// simulation.worker.ts
// The worker will emit ticks for the game loop to advance time

let interval: number | null = null;
const TICK_RATE = 1000; // 1 second real-time = 1 tick

self.onmessage = (e) => {
  if (e.data.type === 'START') {
    if (interval !== null) return;
    interval = self.setInterval(() => {
      self.postMessage({ type: 'TICK' });
    }, TICK_RATE);
  } else if (e.data.type === 'STOP') {
    if (interval !== null) {
      self.clearInterval(interval);
      interval = null;
    }
  } else if (e.data.type === 'SET_SPEED') {
    if (interval !== null) {
      self.clearInterval(interval);
    }
    const newSpeed = e.data.payload.speed;
    const rate = TICK_RATE / newSpeed;
    if (newSpeed > 0) {
      interval = self.setInterval(() => {
        self.postMessage({ type: 'TICK' });
      }, rate);
    }
  }
};
