import { CONSTANTS } from '../config/constants';
import type { SaveData } from '../types';

/**
 * SaveSystem: IndexedDB-based save/load with auto-save.
 */
export class SaveSystem {
  private db: IDBDatabase | null = null;
  private autoSaveTimer: number | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(CONSTANTS.SAVE_DB_NAME, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(CONSTANTS.SAVE_STORE_NAME)) {
          db.createObjectStore(CONSTANTS.SAVE_STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to open IndexedDB');
        reject(request.error);
      };
    });
  }

  /** Save park data */
  async save(id: string, data: SaveData): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(CONSTANTS.SAVE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONSTANTS.SAVE_STORE_NAME);

      const record = {
        id,
        name: data.park.name,
        data: JSON.stringify(data),
        updatedAt: new Date().toISOString(),
      };

      const request = store.put(record);
      request.onsuccess = () => {
        // Store last save ID in localStorage
        try {
          localStorage.setItem('coast_last_save', id);
        } catch (e) { /* ignore */ }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /** Load park data by ID */
  async load(id: string): Promise<SaveData | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(CONSTANTS.SAVE_STORE_NAME, 'readonly');
      const store = tx.objectStore(CONSTANTS.SAVE_STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        if (request.result) {
          try {
            resolve(JSON.parse(request.result.data));
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /** Load the most recent save */
  async loadLatest(): Promise<SaveData | null> {
    try {
      const lastId = localStorage.getItem('coast_last_save');
      if (lastId) {
        return await this.load(lastId);
      }
    } catch { /* ignore */ }
    return null;
  }

  /** List all saves */
  async listSaves(): Promise<{ id: string; name: string; updatedAt: string }[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(CONSTANTS.SAVE_STORE_NAME, 'readonly');
      const store = tx.objectStore(CONSTANTS.SAVE_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result.map((r: any) => ({
          id: r.id,
          name: r.name,
          updatedAt: r.updatedAt,
        }));
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /** Delete a save */
  async deleteSave(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(CONSTANTS.SAVE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONSTANTS.SAVE_STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /** Export save as JSON file download */
  async exportToJson(id: string): Promise<void> {
    const data = await this.load(id);
    if (!data) return;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coast_${data.park.name}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Import save from JSON file */
  async importFromJson(file: File): Promise<string | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target!.result as string) as SaveData;
          const id = `park_${Date.now()}`;
          await this.save(id, data);
          resolve(id);
        } catch {
          resolve(null);
        }
      };
      reader.readAsText(file);
    });
  }

  /** Start auto-save interval */
  startAutoSave(getSaveData: () => SaveData, saveId: string) {
    this.stopAutoSave();
    this.autoSaveTimer = window.setInterval(async () => {
      const data = getSaveData();
      await this.save(saveId, data);
    }, CONSTANTS.AUTO_SAVE_INTERVAL);
  }

  /** Stop auto-save */
  stopAutoSave() {
    if (this.autoSaveTimer !== null) {
      window.clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  dispose() {
    this.stopAutoSave();
    this.db?.close();
  }
}

export const saveManager = new SaveSystem();
