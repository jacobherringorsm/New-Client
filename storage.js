(() => {
  const databaseName = "neon-client-launcher";
  const databaseVersion = 1;
  const clientStoreName = "client";
  const settingsStoreName = "settings";
  let databasePromise;

  function openDatabase() {
    if (!("indexedDB" in window)) {
      return Promise.reject(new Error("This browser does not support local client storage."));
    }

    if (!databasePromise) {
      databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, databaseVersion);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(clientStoreName)) database.createObjectStore(clientStoreName);
          if (!database.objectStoreNames.contains(settingsStoreName)) database.createObjectStore(settingsStoreName);
        };
        request.onsuccess = () => {
          request.result.onversionchange = () => request.result.close();
          resolve(request.result);
        };
        request.onerror = () => reject(request.error ?? new Error("Could not open local client storage."));
        request.onblocked = () => reject(new Error("Local storage is blocked by another open client tab."));
      }).catch((error) => {
        databasePromise = undefined;
        throw error;
      });
    }

    return databasePromise;
  }

  async function runTransaction(storeName, mode, action, value) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = action === "get"
        ? store.get(value)
        : action === "delete"
          ? store.delete(value)
          : store.put(value, "current");
      let result;

      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error ?? new Error("Local storage request failed."));
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error ?? new Error("Local storage transaction failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Local storage transaction was aborted."));
    });
  }

  window.NeonClientStorage = Object.freeze({
    getClient: () => runTransaction(clientStoreName, "readonly", "get", "current"),
    saveClient: (client) => runTransaction(clientStoreName, "readwrite", "put", client),
    removeClient: () => runTransaction(clientStoreName, "readwrite", "delete", "current"),
    getSettings: () => runTransaction(settingsStoreName, "readonly", "get", "current"),
    saveSettings: (settings) => runTransaction(settingsStoreName, "readwrite", "put", settings),
    requestPersistence: async () => {
      if (!navigator.storage?.persist) return false;
      return navigator.storage.persist();
    },
  });
})();
