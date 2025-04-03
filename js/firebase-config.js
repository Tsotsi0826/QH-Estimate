// js/firebase-config.js - Wrapped in IIFE to prevent redeclaration errors

(function() { // Start of IIFE
    'use strict';

    // Firebase Configuration (Now inside IIFE)
    const firebaseConfig = {
        apiKey: "AIzaSyB489SUeC5XAbvzIM_Vh6TJpnbEaoz4KuQ", // Replace with your actual config if different
        authDomain: "qh-dashboard-d67cf.firebaseapp.com",
        projectId: "qh-dashboard-d67cf",
        storageBucket: "qh-dashboard-d67cf.firebasestorage.app",
        messagingSenderId: "939838453148",
        appId: "1:939838453148:web:2bf49c6ec240343b934459"
    };

    // Initialize Firestore DB and export it
    let db;
    let batch;
    let pendingBatchOperations = 0;
    const MAX_BATCH_OPERATIONS = 400; // Firestore limit is 500, using 400 for safety
    let autoCommitTimer = null;
    let lastError = null; // Track last error within this scope

    // Initialize Firebase
    function initializeFirebase() {
        try {
            // Check if Firebase is already initialized (optional safeguard)
            if (!firebase.apps.length) {
                 firebase.initializeApp(firebaseConfig);
                 console.log("Firebase initialized successfully");
            } else {
                 console.log("Firebase already initialized.");
            }
            db = firebase.firestore();
            batch = db.batch(); // Create initial batch
            return db;
        } catch (error) {
            console.error("Firebase initialization error:", error);
            lastError = { message: error.message, code: error.code, timestamp: new Date().toISOString() };
            // Create a mock database for testing/fallback
            db = createMockDatabase();
            console.log("Using mock database due to initialization error.");
            return db;
        }
    }

    // Create new batch when needed
    function getOrCreateBatch() {
        if (!db || typeof db.batch !== 'function') { // Check if db is valid
             console.error("Firestore db not initialized correctly, cannot create batch.");
             return createMockDatabase().batch(); // Return a mock batch
        }
        if (!batch || pendingBatchOperations >= MAX_BATCH_OPERATIONS) {
            if (batch && pendingBatchOperations > 0) {
                commitBatch(); // Commit existing full/old batch first
            }
            batch = db.batch(); // Create new batch
            pendingBatchOperations = 0;
        }
        return batch;
    }

    // Commit the current batch
    async function commitBatch() {
        if (!batch || pendingBatchOperations === 0) return Promise.resolve(true); // Nothing to commit

        console.log(`Committing batch with ${pendingBatchOperations} operations`);
        const currentBatch = batch;
        const currentOps = pendingBatchOperations;

        // Reset before committing
        batch = db.batch();
        pendingBatchOperations = 0;
        clearTimeout(autoCommitTimer); // Clear timer as we are committing now
        autoCommitTimer = null;

        try {
            await currentBatch.commit();
            console.log(`Batch with ${currentOps} operations committed successfully`);
            return true;
        } catch (error) {
            console.error("Error committing batch:", error);
            lastError = { message: error.message, code: error.code, timestamp: new Date().toISOString() };
            // Decide on retry strategy or how to handle failed batch operations
            // For now, just report error
            throw error; // Re-throw for calling function to handle if needed
        }
    }

    // Schedule auto-commit if not running
    function scheduleAutoCommit(delayMs = 5000) {
        if (!autoCommitTimer && pendingBatchOperations > 0) {
            console.log(`[Firebase] Scheduling auto-commit in ${delayMs}ms`);
            autoCommitTimer = setTimeout(() => {
                commitBatch().finally(() => { autoCommitTimer = null; });
            }, delayMs);
        }
    }

    // Mock database for testing/fallback
    function createMockDatabase() {
        // (Mock implementation remains the same as before)
        console.warn("Using Mock Firestore Database!");
        return {
            collection: function(name) { /* ... */ },
            batch: function() { /* ... */ }
            // Ensure mock implements all methods used by the app
        };
    }

    // --- Enhanced database functions (saveClient, saveModuleData, etc.) ---
    // (These functions remain largely the same as before, just ensure they use
    //  the 'db', 'getOrCreateBatch', 'commitBatch', 'scheduleAutoCommit' defined within this IIFE)

    async function saveClientToFirestore(client) {
        if (!client || !client.id) return Promise.reject(new Error("Invalid client object"));
        if (!db || typeof db.collection !== 'function') return Promise.reject(new Error("DB not initialized")); // DB check
        try {
            console.log("Saving client to Firestore:", client.id);
            const clientRef = db.collection('clients').doc(client.id);
            const currentBatch = getOrCreateBatch();
            currentBatch.set(clientRef, client); // Add to batch
            pendingBatchOperations++;
            scheduleAutoCommit(); // Schedule potential commit
            // Consider if immediate write is still needed or rely solely on batch commit
            // await clientRef.set(client); // Optional immediate write
            console.log("Client save operation added to batch.");
            return true; // Indicate operation added
        } catch (error) {
            console.error("Error adding client save to batch:", error);
            lastError = { message: error.message, code: error.code, timestamp: new Date().toISOString() };
            return false; // Indicate failure
        }
    }

    async function saveModuleDataToFirestore(clientId, moduleId, data) {
         if (!clientId || !moduleId) return Promise.reject(new Error("Invalid client/module ID"));
         if (!db || typeof db.collection !== 'function') return Promise.reject(new Error("DB not initialized")); // DB check
         try {
             console.log(`Saving module ${moduleId} data for client ${clientId}`);
             const clientRef = db.collection('clients').doc(clientId);
             const moduleUpdateData = { // Prepare the nested update structure
                 [`moduleData.${moduleId}`]: { // Use dot notation for nested field update/set
                     data: data,
                     lastModified: new Date().toISOString(),
                     version: Date.now()
                 },
                 lastModified: new Date().toISOString() // Also update client's lastModified
             };

             const currentBatch = getOrCreateBatch();
             // Use update for merging nested fields correctly
             currentBatch.update(clientRef, moduleUpdateData);
             pendingBatchOperations++;
             scheduleAutoCommit();
             // Consider if immediate write is needed
             // await clientRef.update(moduleUpdateData); // Optional immediate write
             console.log(`Module ${moduleId} update added to batch.`);
             return true;
         } catch (error) {
             console.error(`Error adding module ${moduleId} update to batch:`, error);
             lastError = { message: error.message, code: error.code, timestamp: new Date().toISOString() };
             return false;
         }
    }

    async function loadClientsFromFirestore() {
        if (!db || typeof db.collection !== 'function') { // DB check
             console.error("DB not initialized, cannot load clients.");
             return [];
        }
        try {
            console.log("Loading clients from Firestore");
            const clients = [];
            const clientsSnapshot = await db.collection('clients').get();
            if (!clientsSnapshot.empty) {
                clientsSnapshot.forEach(doc => {
                    try {
                        const clientData = doc.data();
                        if (!clientData.id) clientData.id = doc.id; // Ensure ID exists
                        if (!clientData.moduleData) clientData.moduleData = {}; // Ensure moduleData exists

                        // Unnest module data if needed (assuming structure { data: ..., version: ...})
                        // Note: The save function now uses dot notation, so this might not be needed
                        // if reading directly, but good practice if structure varies.
                        // Object.keys(clientData.moduleData).forEach(modId => {
                        //    if (clientData.moduleData[modId]?.data) {
                        //        clientData.moduleData[modId] = clientData.moduleData[modId].data;
                        //    }
                        // });

                        clients.push(clientData);
                    } catch (parseError) {
                        console.error("Error parsing client document:", doc.id, parseError);
                    }
                });
                console.log(`Loaded ${clients.length} clients`);
            } else {
                console.log("No clients found");
            }
            return clients;
        } catch (error) {
            console.error("Error loading clients:", error);
            lastError = { message: error.message, code: error.code, timestamp: new Date().toISOString() };
            return []; // Return empty array on error
        }
    }

    async function saveModulesToFirestore(modules) {
         if (!db || typeof db.collection !== 'function') return Promise.reject(new Error("DB not initialized")); // DB check
         try {
             console.log("Saving modules structure to Firestore");
             const modulesRef = db.collection('settings').doc('modules');
             const moduleData = {
                 modules: modules,
                 lastModified: new Date().toISOString(),
                 version: Date.now()
             };
             // Use batching for this too? Settings might change less often, direct write might be ok.
             // For consistency, let's add to batch.
             const currentBatch = getOrCreateBatch();
             currentBatch.set(modulesRef, moduleData);
             pendingBatchOperations++;
             scheduleAutoCommit();
             // await modulesRef.set(moduleData); // Optional immediate write
             console.log("Modules structure save added to batch.");
             return true;
         } catch (error) {
             console.error("Error adding modules save to batch:", error);
             lastError = { message: error.message, code: error.code, timestamp: new Date().toISOString() };
             return false;
         }
    }

    async function loadModulesFromFirestore() {
        if (!db || typeof db.collection !== 'function') { // DB check
             console.error("DB not initialized, cannot load modules.");
             return [];
        }
        try {
            console.log("Loading modules structure from Firestore");
            const modulesDoc = await db.collection('settings').doc('modules').get();
            if (modulesDoc.exists) {
                const data = modulesDoc.data();
                console.log("Loaded modules structure:", data.modules ? data.modules.length : 0);
                return data.modules || []; // Return the array or empty if missing
            } else {
                console.log("No modules structure found in Firestore");
                return [];
            }
        } catch (error) {
            console.error("Error loading modules structure:", error);
            lastError = { message: error.message, code: error.code, timestamp: new Date().toISOString() };
            return [];
        }
    }

    // archiveClientData function remains the same...
    async function archiveClientData(clientId, reason = "manual") { /* ... */ }

    // --- Initialize Firebase on script load ---
    initializeFirebase(); // Call initialization

    // --- Commit any pending batch before unload ---
    window.addEventListener('beforeunload', function() {
        if (pendingBatchOperations > 0) {
            console.warn("Attempting to commit pending Firestore batch on page unload...");
            // Note: Synchronous commit is not possible, this is best effort.
            // The auto-commit timer should ideally handle most cases.
            commitBatch().catch(e => console.error("Error during beforeunload batch commit:", e));
        }
    });

    // --- Export functions and objects ---
    window.ConstructionApp = window.ConstructionApp || {};
    window.ConstructionApp.Firebase = {
        db: db, // Export the db instance (or mock)
        saveClient: saveClientToFirestore,
        saveModuleData: saveModuleDataToFirestore,
        loadClients: loadClientsFromFirestore,
        saveModules: saveModulesToFirestore,
        loadModules: loadModulesFromFirestore,
        archiveClient: archiveClientData,
        commitBatch: commitBatch, // Expose commit if manual commit is needed anywhere
        getLastError: function() { return lastError; } // Expose last error
    };

})(); // End of IIFE
