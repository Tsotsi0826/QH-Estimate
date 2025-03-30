// firebase-config.js - Centralized Firebase configuration with enhanced error handling and batching

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
let batchOperations = [];
let batchTimer = null;
const MAX_BATCH_SIZE = 490; // Firestore batch has limit of 500 operations

// Initialize Firebase
function initializeFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        console.log("[Firebase] Initialized successfully");
        
        // Set up offline persistence for better user experience
        db.enablePersistence({ synchronizeTabs: true })
            .then(() => {
                console.log("[Firebase] Offline persistence enabled");
            })
            .catch(err => {
                if (err.code === 'failed-precondition') {
                    console.warn("[Firebase] Multiple tabs open, persistence can only be enabled in one tab at a time");
                } else if (err.code === 'unimplemented') {
                    console.warn("[Firebase] The current browser does not support offline persistence");
                } else {
                    console.error("[Firebase] Error enabling persistence:", err);
                }
            });
        
        return db;
    } catch (error) {
        console.error("[Firebase] Initialization error:", error);
        // Create a mock database for testing
        db = createMockDatabase();
        console.log("[Firebase] Using mock database for testing");
        return db;
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
                            console.log(`[MockDB] Saving ${name} document ${id}:`, data, options);
                            return Promise.resolve();
                        },
                        get: function() {
                            return Promise.resolve({
                                exists: false,
                                data: function() { return null; }
                            });
                        },
                        update: function(data) {
                            console.log(`[MockDB] Updating ${name} document ${id}:`, data);
                            return Promise.resolve();
                        },
                        delete: function(){
                            console.log(`[MockDB] Delete ${name}/${id}`);
                            return Promise.resolve();
                        }
                    };
                },
                get: function(){
                    return Promise.resolve({
                        empty: true,
                        docs: [],
                        forEach: function(){}
                    });
                }
            };
        },
        batch: function() {
            return {
                set: function(docRef, data, options) {
                    console.log('[MockDB] Batch set operation:', docRef, data);
                    return this;
                },
                update: function(docRef, data) {
                    console.log('[MockDB] Batch update operation:', docRef, data);
                    return this;
                },
                delete: function(docRef) {
                    console.log('[MockDB] Batch delete operation:', docRef);
                    return this;
                },
                commit: function() {
                    console.log('[MockDB] Committing batch operations');
                    return Promise.resolve();
                }
            };
        },
        enablePersistence: function() {
            return Promise.resolve();
        }
    };
}

// Retry operation with exponential backoff
async function retryOperation(operation, maxRetries = 5) {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            // Check if error is retryable
            if (error.code === 'resource-exhausted' || 
                error.code === 'unavailable' || 
                error.code === 'deadline-exceeded') {
                    
                // Calculate backoff time: 1s, 2s, 4s, 8s, etc.
                const backoffMs = Math.min(1000 * Math.pow(2, attempt), 32000);
                console.log(`[Firebase] Retrying operation after ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`);
                
                // Wait for the backoff period
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                continue;
            }
            
            // For non-retryable errors, throw immediately
            throw error;
        }
    }
    
    // If we've exhausted all retries
    console.error(`[Firebase] All retry attempts failed. Last error:`, lastError);
    throw lastError;
}

// Add operation to batch and commit if needed
function addToBatch(operation) {
    batchOperations.push(operation);
    
    // Clear any existing timer
    if (batchTimer) {
        clearTimeout(batchTimer);
    }
    
    // If batch is getting large, commit immediately 
    if (batchOperations.length >= MAX_BATCH_SIZE) {
        commitBatch();
    } else {
        // Otherwise, schedule commit after a short delay to batch more operations
        batchTimer = setTimeout(commitBatch, 1000);
    }
}

// Commit the current batch of operations
async function commitBatch() {
    if (batchOperations.length === 0) {
        return;
    }
    
    // Grab the current batch and reset
    const operationsToProcess = [...batchOperations];
    batchOperations = [];
    
    if (batchTimer) {
        clearTimeout(batchTimer);
        batchTimer = null;
    }
    
    console.log(`[Firebase] Committing batch with ${operationsToProcess.length} operations`);
    
    try {
        const batch = db.batch();
        
        // Add all operations to the batch
        operationsToProcess.forEach(operation => {
            operation(batch);
        });
        
        // Commit the batch with retry logic
        await retryOperation(() => batch.commit());
        console.log(`[Firebase] Successfully committed batch of ${operationsToProcess.length} operations`);
    } catch (error) {
        console.error('[Firebase] Error committing batch:', error);
        
        // If the batch is too large, split and retry
        if (error.code === 'failed-precondition' && operationsToProcess.length > 1) {
            console.log('[Firebase] Splitting batch and retrying');
            
            const midpoint = Math.floor(operationsToProcess.length / 2);
            const firstHalf = operationsToProcess.slice(0, midpoint);
            const secondHalf = operationsToProcess.slice(midpoint);
            
            // Add back to the batch operations array
            batchOperations = [...secondHalf, ...batchOperations];
            
            // Commit first half immediately, second half will be committed by the batch system
            const firstBatch = db.batch();
            firstHalf.forEach(operation => operation(firstBatch));
            
            try {
                await firstBatch.commit();
                console.log(`[Firebase] Successfully committed first half of split batch (${firstHalf.length} operations)`);
            } catch (splitError) {
                console.error('[Firebase] Error committing split batch:', splitError);
                
                // If still failing, add back to batch operations for future retry
                batchOperations = [...firstHalf, ...batchOperations];
            }
            
            // Schedule the next batch commit
            if (batchOperations.length > 0) {
                batchTimer = setTimeout(commitBatch, 2000);
            }
        } else {
            // For other errors, add back to batch operations for future retry
            batchOperations = [...operationsToProcess, ...batchOperations];
            
            // Schedule retry after a delay
            batchTimer = setTimeout(commitBatch, 5000);
        }
    }
}

// Common database functions

// Save client data to Firestore
async function saveClientToFirestore(client) {
    return new Promise((resolve, reject) => {
        try {
            console.log("[Firebase] Saving client to Firestore:", client.id);
            
            // Create an operation to add to the batch
            const operation = (batch) => {
                const clientRef = db.collection('clients').doc(client.id);
                batch.set(clientRef, client);
            };
            
            // Add to batch
            addToBatch(operation);
            
            // For user experience, we resolve immediately even though the batch will commit later
            resolve(true);
        } catch (error) {
            console.error("[Firebase] Error preparing client save:", error);
            reject(error);
        }
    });
}

// Save module data to Firestore
async function saveModuleDataToFirestore(clientId, moduleId, data) {
    return new Promise((resolve, reject) => {
        try {
            console.log(`[Firebase] Saving ${moduleId} data for client ${clientId}`);
            
            // Create an operation to add to the batch
            const operation = (batch) => {
                const clientRef = db.collection('clients').doc(clientId);
                batch.set(clientRef, {
                    moduleData: {
                        [moduleId]: data
                    },
                    lastModified: new Date().toISOString()
                }, { merge: true });
            };
            
            // Add to batch
            addToBatch(operation);
            
            // For user experience, we resolve immediately even though the batch will commit later
            resolve(true);
        } catch (error) {
            console.error(`[Firebase] Error preparing module ${moduleId} data save:`, error);
            reject(error);
        }
    });
}

// Load clients from Firestore
async function loadClientsFromFirestore() {
    try {
        console.log("[Firebase] Loading clients from Firestore");
        const clients = [];
        
        // Force commit any pending batches before loading
        if (batchOperations.length > 0) {
            await commitBatch();
        }
        
        // Load clients with retry
        const clientsSnapshot = await retryOperation(() => 
            db.collection('clients').get()
        );
        
        if (!clientsSnapshot.empty) {
            clientsSnapshot.forEach(doc => {
                const clientData = doc.data();
                clients.push(clientData);
            });
            console.log(`[Firebase] Loaded ${clients.length} clients`);
        } else {
            console.log("[Firebase] No clients found");
        }
        return clients;
    } catch (error) {
        console.error("[Firebase] Error loading clients:", error);
        return [];
    }
}

// Save modules to Firestore
async function saveModulesToFirestore(modules) {
    return new Promise((resolve, reject) => {
        try {
            console.log("[Firebase] Saving modules to Firestore");
            
            // Create an operation to add to the batch
            const operation = (batch) => {
                const modulesRef = db.collection('settings').doc('modules');
                batch.set(modulesRef, { 
                    modules: modules,
                    lastModified: new Date().toISOString()
                });
            };
            
            // Add to batch
            addToBatch(operation);
            
            // Force an immediate commit for modules since they're important
            commitBatch();
            
            resolve(true);
        } catch (error) {
            console.error("[Firebase] Error saving modules:", error);
            reject(error);
        }
    });
}

// Load modules from Firestore
async function loadModulesFromFirestore() {
    try {
        console.log("[Firebase] Loading modules from Firestore");
        
        // Force commit any pending batches before loading
        if (batchOperations.length > 0) {
            await commitBatch();
        }
        
        // Load modules with retry
        const modulesDoc = await retryOperation(() => 
            db.collection('settings').doc('modules').get()
        );
        
        if (modulesDoc.exists) {
            const data = modulesDoc.data();
            console.log("[Firebase] Loaded modules:", data.modules?.length || 0);
            return data.modules || [];
        } else {
            console.log("[Firebase] No modules found in Firestore");
            return [];
        }
    } catch (error) {
        console.error("[Firebase] Error loading modules:", error);
        return [];
    }
}

// Initialize Firebase on script load
const firestore = initializeFirebase();

// Export functions and objects
window.ConstructionApp = window.ConstructionApp || {};
window.ConstructionApp.Firebase = {
    db: db,
    saveClient: saveClientToFirestore,
    saveModuleData: saveModuleDataToFirestore,
    loadClients: loadClientsFromFirestore,
    saveModules: saveModulesToFirestore,
    loadModules: loadModulesFromFirestore,
    commitBatchNow: commitBatch, // Exposed for when immediate commit is needed
    getPendingOperationsCount: function() {
        return batchOperations.length;
    }
};
