// firebase-config.js - Enhanced Firebase configuration with better error handling and batch operations

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyB489SUeC5XAbvzIM_Vh6TJpnbEaoz4KuQ",
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

// Initialize Firebase
function initializeFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        
        // Create initial batch
        batch = db.batch();
        
        console.log("Firebase initialized successfully");
        return db;
    } catch (error) {
        console.error("Firebase initialization error:", error);
        // Create a mock database for testing
        db = createMockDatabase();
        console.log("Using mock database for testing");
        return db;
    }
}

// Create new batch when needed
function getOrCreateBatch() {
    if (!batch || pendingBatchOperations >= MAX_BATCH_OPERATIONS) {
        // Commit current batch if it exists and has operations
        if (batch && pendingBatchOperations > 0) {
            commitBatch();
        }
        
        // Create new batch
        batch = db.batch();
        pendingBatchOperations = 0;
    }
    return batch;
}

// Commit the current batch
function commitBatch() {
    if (!batch || pendingBatchOperations === 0) return Promise.resolve();
    
    console.log(`Committing batch with ${pendingBatchOperations} operations`);
    const currentBatch = batch;
    batch = db.batch(); // Create new batch
    
    const currentOps = pendingBatchOperations;
    pendingBatchOperations = 0;
    
    return currentBatch.commit()
        .then(() => {
            console.log(`Batch with ${currentOps} operations committed successfully`);
            return true;
        })
        .catch(error => {
            console.error("Error committing batch:", error);
            throw error;
        });
}

// Schedule auto-commit if not running
let autoCommitTimer = null;
function scheduleAutoCommit(delayMs = 5000) {
    if (!autoCommitTimer && pendingBatchOperations > 0) {
        autoCommitTimer = setTimeout(() => {
            commitBatch().finally(() => { autoCommitTimer = null; });
        }, delayMs);
    }
}

// Mock database for testing
function createMockDatabase() {
    return {
        collection: function(name) {
            return {
                doc: function(id) {
                    return {
                        set: function(data, options) {
                            console.log(`Mock DB: saving ${name} document ${id}:`, data, options);
                            return Promise.resolve();
                        },
                        get: function() {
                            return Promise.resolve({
                                exists: false,
                                data: function() { return null; }
                            });
                        },
                        update: function(data) {
                            console.log(`Mock DB: updating ${name} document ${id}:`, data);
                            return Promise.resolve();
                        },
                        delete: function(){
                            console.log(`Mock delete ${name}/${id}`);
                            return Promise.resolve();
                        }
                    };
                },
                get: function(){
                    return Promise.resolve({
                        empty: true,
                        forEach: function(){}
                    });
                }
            };
        },
        batch: function() {
            return {
                set: function() { return this; },
                update: function() { return this; },
                delete: function() { return this; },
                commit: function() { return Promise.resolve(); }
            };
        }
    };
}

// Enhanced database functions

// Save client data to Firestore with retry logic
async function saveClientToFirestore(client) {
    // Validate client object
    if (!client || !client.id) {
        console.error("Invalid client object:", client);
        return Promise.reject(new Error("Invalid client object"));
    }
    
    try {
        console.log("Saving client to Firestore:", client.id);
        const clientRef = db.collection('clients').doc(client.id);
        
        // Add to batch
        const currentBatch = getOrCreateBatch();
        currentBatch.set(clientRef, client);
        pendingBatchOperations++;
        
        // Schedule auto-commit
        scheduleAutoCommit();
        
        // For immediate feedback, do a direct save too
        await clientRef.set(client);
        
        console.log("Client saved successfully");
        return true;
    } catch (error) {
        console.error("Error saving client:", error);
        
        // Retry logic
        if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
            console.log("Retrying client save due to temporary error...");
            try {
                const clientRef = db.collection('clients').doc(client.id);
                await clientRef.set(client);
                console.log("Retry successful");
                return true;
            } catch (retryError) {
                console.error("Retry failed:", retryError);
                return false;
            }
        }
        
        return false;
    }
}

// Save module data to Firestore with optimized structure
async function saveModuleDataToFirestore(clientId, moduleId, data) {
    if (!clientId || !moduleId) {
        console.error("Invalid client or module ID");
        return Promise.reject(new Error("Invalid client or module ID"));
    }
    
    try {
        console.log(`Saving ${moduleId} data for client ${clientId}`);
        const clientRef = db.collection('clients').doc(clientId);
        
        // Add versioning info
        const moduleData = {
            data: data,
            lastModified: new Date().toISOString(),
            version: Date.now()
        };
        
        // Add to batch
        const currentBatch = getOrCreateBatch();
        currentBatch.set(clientRef, {
            moduleData: {
                [moduleId]: moduleData
            },
            lastModified: new Date().toISOString()
        }, { merge: true });
        pendingBatchOperations++;
        
        // Schedule auto-commit
        scheduleAutoCommit();
        
        // For immediate feedback, do a direct save too
        await clientRef.set({
            moduleData: {
                [moduleId]: moduleData
            },
            lastModified: new Date().toISOString()
        }, { merge: true });
        
        console.log(`Module ${moduleId} data saved successfully`);
        return true;
    } catch (error) {
        console.error(`Error saving module ${moduleId} data:`, error);
        
        // Retry logic
        if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
            console.log("Retrying module save due to temporary error...");
            try {
                const clientRef = db.collection('clients').doc(clientId);
                await clientRef.set({
                    moduleData: {
                        [moduleId]: {
                            data: data,
                            lastModified: new Date().toISOString(),
                            version: Date.now()
                        }
                    },
                    lastModified: new Date().toISOString()
                }, { merge: true });
                console.log("Retry successful");
                return true;
            } catch (retryError) {
                console.error("Retry failed:", retryError);
                return false;
            }
        }
        
        return false;
    }
}

// Load clients from Firestore with data validation
async function loadClientsFromFirestore() {
    try {
        console.log("Loading clients from Firestore");
        const clients = [];
        const clientsSnapshot = await db.collection('clients').get();
        
        if (!clientsSnapshot.empty) {
            clientsSnapshot.forEach(doc => {
                try {
                    const clientData = doc.data();
                    
                    // Basic validation
                    if (!clientData.id) {
                        clientData.id = doc.id;
                    }
                    
                    if (!clientData.moduleData) {
                        clientData.moduleData = {};
                    }
                    
                    // Extract actual module data from versioned storage
                    const moduleIds = Object.keys(clientData.moduleData);
                    moduleIds.forEach(moduleId => {
                        const moduleData = clientData.moduleData[moduleId];
                        if (moduleData && moduleData.data) {
                            clientData.moduleData[moduleId] = moduleData.data;
                        }
                    });
                    
                    clients.push(clientData);
                } catch (parseError) {
                    console.error("Error parsing client document:", parseError);
                }
            });
            console.log(`Loaded ${clients.length} clients`);
        } else {
            console.log("No clients found");
        }
        return clients;
    } catch (error) {
        console.error("Error loading clients:", error);
        return [];
    }
}

// Save modules to Firestore
async function saveModulesToFirestore(modules) {
    try {
        console.log("Saving modules to Firestore");
        const modulesRef = db.collection('settings').doc('modules');
        
        // Add timestamps and versioning
        const moduleData = {
            modules: modules,
            lastModified: new Date().toISOString(),
            version: Date.now()
        };
        
        await modulesRef.set(moduleData);
        console.log("Modules saved successfully");
        return true;
    } catch (error) {
        console.error("Error saving modules:", error);
        
        // Retry logic
        if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
            console.log("Retrying modules save due to temporary error...");
            try {
                const modulesRef = db.collection('settings').doc('modules');
                await modulesRef.set({
                    modules: modules,
                    lastModified: new Date().toISOString(),
                    version: Date.now()
                });
                console.log("Retry successful");
                return true;
            } catch (retryError) {
                console.error("Retry failed:", retryError);
                return false;
            }
        }
        
        return false;
    }
}

// Load modules from Firestore
async function loadModulesFromFirestore() {
    try {
        console.log("Loading modules from Firestore");
        const modulesDoc = await db.collection('settings').doc('modules').get();
        
        if (modulesDoc.exists) {
            const data = modulesDoc.data();
            console.log("Loaded modules:", data.modules ? data.modules.length : 0);
            return data.modules || [];
        } else {
            console.log("No modules found in Firestore");
            return [];
        }
    } catch (error) {
        console.error("Error loading modules:", error);
        return [];
    }
}

// Archive client data (for history/versioning)
async function archiveClientData(clientId, reason = "manual") {
    try {
        if (!clientId) {
            console.error("Invalid client ID for archiving");
            return false;
        }
        
        // Get the current client data
        const clientDoc = await db.collection('clients').doc(clientId).get();
        if (!clientDoc.exists) {
            console.error("Client not found for archiving:", clientId);
            return false;
        }
        
        const clientData = clientDoc.data();
        
        // Create archive record
        const archiveRef = db.collection('client_archives').doc(`${clientId}_${Date.now()}`);
        await archiveRef.set({
            clientData: clientData,
            archivedAt: new Date().toISOString(),
            reason: reason
        });
        
        console.log("Client data archived successfully:", clientId);
        return true;
    } catch (error) {
        console.error("Error archiving client data:", error);
        return false;
    }
}

// Initialize Firebase on script load
const firestore = initializeFirebase();

// Make sure any pending operations are committed before page unload
window.addEventListener('beforeunload', function() {
    if (pendingBatchOperations > 0) {
        try {
            // Try to commit synchronously (might not always work)
            commitBatch();
        } catch (e) {
            console.error("Error committing batch on page unload:", e);
        }
    }
});

// Export functions and objects
window.ConstructionApp = window.ConstructionApp || {};
window.ConstructionApp.Firebase = {
    db: db,
    saveClient: saveClientToFirestore,
    saveModuleData: saveModuleDataToFirestore,
    loadClients: loadClientsFromFirestore,
    saveModules: saveModulesToFirestore,
    loadModules: loadModulesFromFirestore,
    archiveClient: archiveClientData,
    
    // Add direct access to batch operations
    commitBatch: commitBatch,
    
    // Add error tracking/reporting
    getLastError: function() {
        return this._lastError;
    },
    
    // Internal error tracking
    _lastError: null,
    _setError: function(error) {
        this._lastError = {
            message: error.message,
            code: error.code,
            timestamp: new Date().toISOString()
        };
    }
};
