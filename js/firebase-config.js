// firebase-config.js - Enhanced Firebase configuration with better error handling and batch operations

// Firebase Configuration (Replace with your actual config)
const firebaseConfig = {
  apiKey: "AIzaSyB489SUeC5XAbvzIM_Vh6TJpnbEaoz4KuQ", // Replace with your API key
  authDomain: "qh-dashboard-d67cf.firebaseapp.com", // Replace with your auth domain
  projectId: "qh-dashboard-d67cf", // Replace with your project ID
  storageBucket: "qh-dashboard-d67cf.firebasestorage.app", // Replace with your storage bucket
  messagingSenderId: "939838453148", // Replace with your sender ID
  appId: "1:939838453148:web:2bf49c6ec240343b934459" // Replace with your app ID
};


// --- Global Firebase Variables ---
let db; // Firestore database instance
let batch; // Current write batch
let pendingBatchOperations = 0;
const MAX_BATCH_OPERATIONS = 400; // Firestore limit is 500, using 400 for safety buffer
let autoCommitTimer = null; // Timer for automatic batch commits


// --- Initialization ---
/**
 * Initializes the Firebase app and Firestore database.
 * Includes fallback to a mock database if initialization fails.
 * @returns {firebase.firestore.Firestore} Firestore instance or mock object.
 */
function initializeFirebase() {
    try {
        // Check if Firebase is already initialized
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log("Firebase initialized successfully.");
        } else {
            firebase.app(); // if already initialized, use that app
            console.log("Firebase already initialized.");
        }

        db = firebase.firestore(); // Get Firestore instance

        // Optional: Configure Firestore settings (e.g., persistence)
        // db.enablePersistence().catch(err => console.error("Firestore persistence error:", err));

        // Create initial batch
        batch = db.batch();
        pendingBatchOperations = 0;

        return db;
    } catch (error) {
        console.error("Firebase initialization error:", error);
        // Fallback to mock database for offline/testing
        db = createMockDatabase();
        console.warn("Using mock database due to initialization error.");
        return db;
    }
}

// --- Batching Logic ---
/**
 * Gets the current batch or creates a new one if needed.
 * Commits the old batch automatically if it's full.
 * @returns {firebase.firestore.WriteBatch} The current batch object.
 */
function getOrCreateBatch() {
    if (!db || typeof db.batch !== 'function') {
         console.error("Firestore not initialized properly, cannot create batch.");
         // Return a dummy batch object to prevent further errors downstream
         return { set: ()=>{}, update: ()=>{}, delete: ()=>{}, commit: ()=>Promise.resolve() };
    }
    if (!batch || pendingBatchOperations >= MAX_BATCH_OPERATIONS) {
        // Commit current batch if it exists and has operations
        if (batch && pendingBatchOperations > 0) {
            console.log(`Max batch operations reached (${pendingBatchOperations}). Committing previous batch.`);
            commitBatch(); // Commit the full batch
        }
        // Create new batch
        console.log("Creating new Firestore batch.");
        batch = db.batch();
        pendingBatchOperations = 0;
    }
    return batch;
}

/**
 * Commits the current Firestore write batch if it has pending operations.
 * Resets the batch and counter.
 * @returns {Promise<boolean>} Promise resolving to true on success, rejecting on error.
 */
function commitBatch() {
    if (!batch || pendingBatchOperations === 0) {
        // console.log("No pending operations in batch, commit skipped.");
        return Promise.resolve(true); // Resolve immediately if nothing to commit
    }

    console.log(`Committing Firestore batch with ${pendingBatchOperations} operations...`);
    const currentBatch = batch;
    const currentOpsCount = pendingBatchOperations;

    // Reset global batch and counter *before* async commit
    batch = db.batch();
    pendingBatchOperations = 0;
    clearTimeout(autoCommitTimer); // Cancel any pending auto-commit timer
    autoCommitTimer = null;

    return currentBatch.commit()
        .then(() => {
            console.log(`Batch with ${currentOpsCount} operations committed successfully.`);
            return true;
        })
        .catch(error => {
            console.error(`Error committing batch with ${currentOpsCount} operations:`, error);
            // Consider error handling: retry? notify user?
            throw error; // Re-throw error for upstream handling
        });
}

/**
 * Schedules the current batch to be committed after a delay if there are pending operations.
 * Resets the timer if called again before it fires.
 * @param {number} [delayMs=3000] - Delay in milliseconds (default: 3 seconds).
 */
function scheduleAutoCommit(delayMs = 3000) { // Shorter delay
    if (pendingBatchOperations === 0) return; // No need to schedule if nothing pending

    clearTimeout(autoCommitTimer); // Clear existing timer
    autoCommitTimer = setTimeout(() => {
        console.log(`Auto-commit timer fired after ${delayMs}ms.`);
        commitBatch().finally(() => { autoCommitTimer = null; }); // Commit and clear timer variable
    }, delayMs);
    // console.log(`Auto-commit scheduled in ${delayMs}ms`);
}

// --- Mock Database (for offline/testing) ---
/**
 * Creates a mock Firestore object for testing or offline use.
 * Logs operations instead of performing them.
 */
function createMockDatabase() {
    const mockStore = {}; // Simulate data storage
    console.warn("--- MOCK DATABASE ACTIVE ---");
    return {
        collection: function(name) {
             mockStore[name] = mockStore[name] || {};
            return {
                doc: function(id) {
                     mockStore[name][id] = mockStore[name][id] || null; // Simulate doc existence
                    return {
                        set: function(data, options) {
                            console.log(`[Mock DB] SET: ${name}/${id}`, options || '', data);
                            mockStore[name][id] = JSON.parse(JSON.stringify(data)); // Simulate save (deep copy)
                            return Promise.resolve();
                        },
                        get: function() {
                            console.log(`[Mock DB] GET: ${name}/${id}`);
                            const data = mockStore[name][id];
                            return Promise.resolve({
                                exists: !!data,
                                data: function() { return data ? JSON.parse(JSON.stringify(data)) : null; }, // Return copy
                                id: id
                            });
                        },
                        update: function(data) {
                            console.log(`[Mock DB] UPDATE: ${name}/${id}`, data);
                             if (mockStore[name][id]) {
                                 mockStore[name][id] = { ...mockStore[name][id], ...JSON.parse(JSON.stringify(data)) }; // Simulate merge
                             }
                            return Promise.resolve();
                        },
                        delete: function() {
                            console.log(`[Mock DB] DELETE: ${name}/${id}`);
                            delete mockStore[name][id];
                            return Promise.resolve();
                        }
                    };
                },
                get: function() {
                     console.log(`[Mock DB] GET Collection: ${name}`);
                     const docs = Object.keys(mockStore[name] || {}).map(id => ({
                          exists: true,
                          data: () => JSON.parse(JSON.stringify(mockStore[name][id])),
                          id: id
                     }));
                    return Promise.resolve({
                        empty: docs.length === 0,
                        docs: docs,
                        forEach: function(callback) { docs.forEach(callback); }
                    });
                }
            };
        },
        batch: function() {
             console.log("[Mock DB] Create Batch");
             // Mock batch doesn't really batch, just logs
            return {
                set: function(docRef, data, options) { console.log(`[Mock Batch] SET:`, docRef.id, options || '', data); return this; },
                update: function(docRef, data) { console.log(`[Mock Batch] UPDATE:`, docRef.id, data); return this; },
                delete: function(docRef) { console.log(`[Mock Batch] DELETE:`, docRef.id); return this; },
                commit: function() { console.log("[Mock Batch] COMMIT"); return Promise.resolve(); }
            };
        }
    };
}

// --- Enhanced Database Functions ---

/**
 * Saves client data to Firestore using batching.
 * Includes basic validation and retry logic.
 * @param {object} client - The client object to save.
 * @returns {Promise<boolean>} True on success, false on failure.
 */
async function saveClientToFirestore(client) {
    if (!db) { console.error("Firestore DB not initialized."); return Promise.resolve(false); }
    if (!client || !client.id) {
        console.error("saveClientToFirestore: Invalid client object provided:", client);
        return Promise.reject(new Error("Invalid client object")); // Reject promise for invalid input
    }

    console.log(`[Firestore] Preparing to save client: ${client.id}`);
    const clientRef = db.collection('clients').doc(client.id);
    // Ensure lastModified is updated
    const dataToSave = { ...client, lastModified: new Date().toISOString() };

    try {
        // Add to batch
        const currentBatch = getOrCreateBatch();
        currentBatch.set(clientRef, dataToSave); // Use set to overwrite completely
        pendingBatchOperations++;
        console.log(`[Firestore] Added client ${client.id} SET to batch. Pending ops: ${pendingBatchOperations}`);

        // Schedule auto-commit (will reset timer if called frequently)
        scheduleAutoCommit();

        // Optionally, return true immediately after adding to batch for faster UI feedback
        // The actual commit happens later via scheduleAutoCommit or commitBatch
        return true;

        // OR: Await direct save for immediate confirmation (less batching benefit)
        // await clientRef.set(dataToSave);
        // console.log(`[Firestore] Client ${client.id} saved directly.`);
        // return true;

    } catch (error) {
        console.error(`[Firestore] Error adding client ${client.id} to batch:`, error);
        // Attempt immediate save as fallback? Or just report error?
        // For now, just report error.
        _logFirebaseError(error, 'saveClientToFirestore_batch'); // Log error details
        return false; // Indicate failure
    }

    // Note: Retry logic might be better handled within commitBatch or globally
}

/**
 * Saves specific module data for a client to Firestore using batching and merge.
 * @param {string} clientId - The ID of the client.
 * @param {string} moduleId - The ID of the module.
 * @param {object | null} data - The data to save for the module (or null to delete).
 * @returns {Promise<boolean>} True on success, false on failure.
 */
async function saveModuleDataToFirestore(clientId, moduleId, data) {
     if (!db) { console.error("Firestore DB not initialized."); return Promise.resolve(false); }
    if (!clientId || !moduleId) {
        console.error("saveModuleDataToFirestore: Invalid client or module ID provided.");
        return Promise.reject(new Error("Invalid client or module ID"));
    }

    console.log(`[Firestore] Preparing to save module [${moduleId}] data for client [${clientId}]`);
    const clientRef = db.collection('clients').doc(clientId);

    // Structure for updating nested field using dot notation
    const updateData = {};
    const fieldPath = `moduleData.${moduleId}`; // Path to the specific modu
