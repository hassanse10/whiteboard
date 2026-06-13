const DB_NAME = "whiteboard-cache";
const DB_VERSION = 1;
const SCENE_STORE = "scenes";

type CachedScene = {
  elements: any[];
  appState: any;
  files: Record<string, any>;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SCENE_STORE)) {
        db.createObjectStore(SCENE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCachedScene(boardId: string, scene: CachedScene): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SCENE_STORE, "readwrite");
      tx.objectStore(SCENE_STORE).put(scene, boardId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Caching is best-effort; ignore failures (e.g. private browsing).
  }
}

export async function loadCachedScene(boardId: string): Promise<CachedScene | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(SCENE_STORE, "readonly");
      const request = tx.objectStore(SCENE_STORE).get(boardId);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}
