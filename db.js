const DATABASE_NAME = "milepilot";
const DATABASE_VERSION = 1;
const QUEUE_STORE = "queue";
const CACHE_STORE = "cache";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(QUEUE_STORE)) {
        database.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(CACHE_STORE)) {
        database.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(storeName, mode, callback) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const result = callback(store);
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function queueRequest(request) {
  return transact(QUEUE_STORE, "readwrite", store => store.put(request));
}

export async function getQueuedRequests() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(QUEUE_STORE, "readonly");
    const request = transaction.objectStore(QUEUE_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function removeQueuedRequest(id) {
  return transact(QUEUE_STORE, "readwrite", store => store.delete(id));
}

export async function setCache(key, value) {
  return transact(CACHE_STORE, "readwrite", store => store.put({ key, value, updatedAt: Date.now() }));
}

export async function getCache(key) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CACHE_STORE, "readonly");
    const request = transaction.objectStore(CACHE_STORE).get(key);
    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => reject(request.error);
  });
}
