// firebase-config.js - Centralized Firebase configuration

// Firebase Configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "qh-dashboard-d67cf.firebaseapp.com",
    projectId: "qh-dashboard-d67cf",
    storageBucket: "qh-dashboard-d67cf.firebasestorage.app",
    messagingSenderId: "939838453148",
    appId: "1:939838453148:web:2bf49c6ec240343b934459"
};

// Initialize Firestore DB and export it
let db;

// Initialize Firebase
function initializeFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
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
        }
    };
}

// Common database functions

// Save client data to Firestore
async function saveClientToFirestore(client) {
    try {
        console.log("Saving client to Firestore:", client.id);
        const clientRef = db.collection('clients').doc(client.id);
        await clientRef.set(client);
        console.log("Client saved successfully");
        return true;
    } catch (error) {
        console.error("Error saving client:", error);
        return false;
    }
}

// Save module data to Firestore
async function saveModuleDataToFirestore(clientId, moduleId, data) {
    try {
        console.log(`Saving ${moduleId} data for client ${clientId}`);
        const clientRef = db.collection('clients').doc(clientId);
        await clientRef.set({
            moduleData: {
                [moduleId]: data
            }
        }, { merge: true });
        console.log(`Module ${moduleId} data saved successfully`);
        return true;
    } catch (error) {
        console.error(`Error saving module ${moduleId} data:`, error);
        return false;
    }
}

// Load clients from Firestore
async function loadClientsFromFirestore() {
    try {
        console.log("Loading clients from Firestore");
        const clients = [];
        const clientsSnapshot = await db.collection('clients').get();
        
        if (!clientsSnapshot.empty) {
            clientsSnapshot.forEach(doc => {
                const clientData = doc.data();
                clients.push(clientData);
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

// Initialize Firebase on script load
const firestore = initializeFirebase();

// Export functions and objects
window.ConstructionApp = window.ConstructionApp || {};
window.ConstructionApp.Firebase = {
    db: db,
    saveClient: saveClientToFirestore,
    saveModuleData: saveModuleDataToFirestore,
    loadClients: loadClientsFromFirestore
};
