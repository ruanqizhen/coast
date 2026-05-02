/**
 * ObjectPool: generic pre-allocated pool for Babylon.js meshes.
 * Reuses objects to avoid GC pressure from create/dispose cycles.
 */
export class ObjectPool<T> {
  private available: T[] = [];
  private active: Set<T> = new Set();
  private factory: () => T;
  private reset: (item: T) => void;
  private capacity: number;

  constructor(factory: () => T, reset: (item: T) => void, capacity: number = 200) {
    this.factory = factory;
    this.reset = reset;
    this.capacity = capacity;
  }

  acquire(): T | null {
    let item: T;
    if (this.available.length > 0) {
      item = this.available.pop()!;
    } else if (this.active.size < this.capacity) {
      item = this.factory();
    } else {
      // Pool exhausted: reuse oldest active item
      const first = this.active.values().next();
      if (first.done) return null;
      item = first.value;
      this.active.delete(item);
      this.reset(item);
    }
    this.active.add(item);
    return item;
  }

  release(item: T) {
    if (this.active.delete(item)) {
      this.reset(item);
      this.available.push(item);
    }
  }

  releaseAll() {
    for (const item of this.active) {
      this.reset(item);
      this.available.push(item);
    }
    this.active.clear();
  }

  get activeCount(): number { return this.active.size; }
  get availableCount(): number { return this.available.length; }
  get totalCount(): number { return this.active.size + this.available.length; }
}
