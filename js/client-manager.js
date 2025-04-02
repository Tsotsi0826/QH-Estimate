// client-manager.js - Revised Client data management with enhanced logging

// Client manager for the Construction Estimator app
(function() {
    // Ensure our namespace exists
    window.ConstructionApp = window.ConstructionApp || {};

    // Private data
    let _clients = [];
    let _currentClient = null;
    let _pendingSaves = {}; // Track pending save operations
    let _autoSaveTimer = null; // Timer for auto-saving

    // --- Helper Function to Safely Stringify ---
    // Handles potential circular references or large objects, though sessionStorage limit is the main concern
    function safeStringify(obj, replacer = null, space = null) {
        try {
            return JSON.stringify(obj, replacer, space);
        } catch (error) {
            console.error("[ClientManager] Error stringifying object:", error);
            // Decide how to handle: return null, empty object string, or throw
            // Returning null might hide issues but prevent crashes.
            return null;
        }
    }

    // Client Manager object
    const ClientManager = {
        // Get all clients
        getAllClients: function() {
            return _clients;
        },

        // Get current client
        getCurrentClient: function() {
            // If _currentClient is null, try to get from sessionStorage
            if (!_currentClient) {
                const clientDataStr = sessionStorage.getItem('currentClient');
                if (clientDataStr) {
                    try {
                        _currentClient = JSON.parse(clientDataStr);
                        console.log("[ClientManager] Restored client from sessionStorage on demand:", _currentClient?.name || 'Unknown');
                    } catch (error) {
                        console.error("[ClientManager] Error parsing stored client on demand:", error);
                        sessionStorage.removeItem('currentClient');
                        _currentClient = null; // Ensure it's null if parsing failed
                    }
                } else {
                     console.log("[ClientManager] No client found in sessionStorage on demand.");
                }
            }
            return _currentClient;
        },

        // Set current client
        setCurrentClient: function(client) {
            console.log("[ClientManager] Attempting to set current client:", client ? client.name : "None");
            _currentClient = client; // Update internal state first

            // Save to sessionStorage for persistence between pages
            if (client) {
                const clientString = safeStringify(client);
                if (clientString) {
                    try {
                        sessionStorage.setItem('currentClient', clientString);
                        console.log("[ClientManager] Client saved to sessionStorage:", client.name);
                         // Check size (approximate) - log warning if large
                         if (clientString.length > 4 * 1024 * 1024) { // ~4MB warning
                             console.warn(`[ClientManager] Client data size is large (${(clientString.length / 1024 / 1024).toFixed(2)} MB), may approach sessionStorage limits.`);
                         }
                    } catch (e) {
                         console.error("[ClientManager] Error saving client to sessionStorage (Quota Exceeded?):", e);
                         // Optionally notify user or handle error
                         alert("Error: Could not save client session. Data might be too large.");
                         _currentClient = null; // Clear internal state if save failed
                    }
                } else {
                    console.error("[ClientManager] Failed to stringify client data, not saving to sessionStorage.");
                    _currentClient = null; // Clear internal state if stringify failed
                }
                 // Start auto-save timer for this client only if successfully set
                 if (_currentClient) {
                    this.startAutoSave();
                 } else {
                    this.stopAutoSave(); // Stop if setting failed
                 }
            } else {
                sessionStorage.removeItem('currentClient');
                console.log("[ClientManager] Client removed from sessionStorage");
                // Stop auto-save timer when no client is selected
                this.stopAutoSave();
            }

            // Notify any listeners ONLY if the client state genuinely changed
            // This check might need refinement depending on how onClientChanged is used
            if (typeof this.onClientChanged === 'function') {
                 // Pass a deep copy? Or rely on consumers not mutating? For now, pass directly.
                this.onClientChanged(_currentClient);
            }

            return _currentClient; // Return the client that was actually set (could be null if failed)
        },

        // Add a new client
        addClient: function(clientData, callback) {
            // Create a new client with a unique ID if not provided
            const client = {
                id: clientData.id || `client-${Date.now()}`,
                name: clientData.name,
                address: clientData.address || '',
                moduleData: clientData.moduleData || {}, // Ensure moduleData exists
                created: new Date().toISOString(),
                lastModified: new Date().toISOString()
            };

            console.log("[ClientManager] Adding new client:", client.name);

            // Add to the clients array (in-memory)
            _clients.push(client);

            // Save to Firestore if available
            if (window.ConstructionApp.Firebase) {
                window.ConstructionApp.Firebase.saveClient(client)
                    .then(() => {
                        console.log("[ClientManager] Client saved to Firebase successfully:", client.name);
                        if (callback) callback(true, client);
                    })
                    .catch(error => {
                        console.error("[ClientManager] Error saving client to Firebase:", error);
                        if (callback) callback(false, error.message);
                    });
            } else {
                 console.warn("[ClientManager] Firebase not available, client added locally only.");
                if (callback) callback(true, client); // Report success for local add
            }

            return client;
        },

        // Update an existing client (primarily for non-moduleData changes, or full saves)
        updateClient: function(client, callback) {
            if (!client || !client.id) {
                 console.error("[ClientManager] updateClient called with invalid client object.");
                 if(callback) callback(false, "Invalid client data");
                 return false;
            }
            console.log("[ClientManager] Updating client:", client.name);

            // Update last modified timestamp
            client.lastModified = new Date().toISOString();

            // Find and update the client in the array
            const index = _clients.findIndex(c => c.id === client.id);
            if (index >= 0) {
                _clients[index] = client; // Update in-memory list

                // If this is the current client, update the internal reference AND sessionStorage
                if (_currentClient && _currentClient.id === client.id) {
                    console.log("[ClientManager] Updating _currentClient reference and sessionStorage.");
                    // Use setCurrentClient to handle storage and notifications
                    this.setCurrentClient(client);
                }

                // Save to Firestore if available
                if (window.ConstructionApp.Firebase) {
                    window.ConstructionApp.Firebase.saveClient(client)
                        .then(() => {
                            console.log("[ClientManager] Client updated in Firebase successfully");
                            if (callback) callback(true, null);
                        })
                        .catch(error => {
                            console.error("[ClientManager] Error updating client in Firebase:", error);
                            if (callback) callback(false, error.message);
                        });
                } else {
                     console.warn("[ClientManager] Firebase not available, updated locally only.");
                    if (callback) callback(true, "Firebase not available, updated locally only");
                }

                return true;
            } else {
                 console.warn("[ClientManager] Client not found in local list for update:", client.id);
                 if (callback) callback(false, "Client not found locally");
                 // Should we still try to save to Firebase? Or add it locally?
                 // For now, assume it must exist locally to be updated.
                 return false;
            }
        },

        // Load clients from Firestore
        loadClients: async function() {
            console.log("[ClientManager] Loading clients from Firestore...");
            if (window.ConstructionApp.Firebase) {
                try {
                    const loadedClients = await window.ConstructionApp.Firebase.loadClients();
                    _clients = loadedClients || []; // Ensure _clients is always an array
                    console.log("[ClientManager] Loaded", _clients.length, "clients");
                    return _clients;
                } catch (error) {
                    console.error("[ClientManager] Error loading clients:", error);
                    _clients = []; // Reset local list on error
                    return []; // Return empty array
                }
            } else {
                 console.warn("[ClientManager] Firebase not available, cannot load clients.");
                 _clients = []; // Ensure local list is empty
                 return [];
            }
        },

        // Save module data for the current client with enhanced error handling
        saveModuleData: function(moduleId, data, callback) {
            // Use getCurrentClient to ensure we attempt loading from session if _currentClient is null
            const clientToUpdate = this.getCurrentClient();

            if (!clientToUpdate) {
                console.error("[ClientManager] No current client to save module data for.");
                if (callback) callback(false, "No client selected");
                return false;
            }

            console.log(`[ClientManager] Saving module data for [${moduleId}] to client [${clientToUpdate.name}]`);

            // Generate a save operation ID for potential tracking (optional)
            const saveOpId = `${moduleId}-${Date.now()}`;
            _pendingSaves[saveOpId] = true; // Mark as pending

            // Update last modified timestamp on the client object
            clientToUpdate.lastModified = new Date().toISOString();

            // Ensure moduleData exists
            if (!clientToUpdate.moduleData) {
                clientToUpdate.moduleData = {};
            }

            // Update the module data within the client object
            console.log("[ClientManager] Updating client object in memory with new module data for:", moduleId);
            clientToUpdate.moduleData[moduleId] = data;

            // Update sessionStorage with the modified client object
            // Use setCurrentClient to handle the update consistently
            console.log("[ClientManager] Calling setCurrentClient to update sessionStorage with modified client.");
            this.setCurrentClient(clientToUpdate); // This handles saving to sessionStorage

            // Save *only the module data* to Firestore if available
            if (window.ConstructionApp.Firebase) {
                window.ConstructionApp.Firebase.saveModuleData(clientToUpdate.id, moduleId, data)
                    .then(() => {
                        console.log(`[ClientManager] Module data [${moduleId}] saved to Firebase successfully.`);
                        delete _pendingSaves[saveOpId]; // Remove from pending
                        if (callback) callback(true, null);
                    })
                    .catch(error => {
                        console.error(`[ClientManager] Error saving module data [${moduleId}] to Firebase:`, error);
                        delete _pendingSaves[saveOpId]; // Remove from pending
                        // Retry logic could be added here or within Firebase.saveModuleData
                        if (callback) callback(false, error.message);
                    });
            } else {
                 console.warn(`[ClientManager] Firebase not available, module data [${moduleId}] saved locally only.`);
                delete _pendingSaves[saveOpId]; // Remove from pending
                if (callback) callback(true, "Firebase not available, saved locally only");
            }

            return true;
        },

        // Get module data for the current client
        getModuleData: function(moduleId) {
            const client = this.getCurrentClient(); // Use getter to ensure it tries loading from session
            if (!client || !client.moduleData) {
                // console.log(`[ClientManager] No client or moduleData found when getting data for ${moduleId}`);
                return null;
            }
            // console.log(`[ClientManager] Getting module data for ${moduleId}. Found:`, !!client.moduleData[moduleId]);
            return client.moduleData[moduleId] || null;
        },

        // Clear the current client
        clearCurrentClient: function() {
            console.log("[ClientManager] Clearing current client.");
            // Use setCurrentClient with null to handle clearing storage and stopping timers
            this.setCurrentClient(null);
            return true;
        },

        // Force a refresh of the current client from sessionStorage (less commonly needed now)
        refreshCurrentClient: function() {
             console.log("[ClientManager] Refreshing current client from sessionStorage.");
             sessionStorage.removeItem('currentClient'); // Clear current session item first
             _currentClient = null; // Clear internal variable
             const client = this.getCurrentClient(); // Let the getter handle reloading
             // Notify listeners that client might have changed (even if it's null)
             if (typeof this.onClientChanged === 'function') {
                 this.onClientChanged(client);
             }
             return client;
        },


        // Check if there are pending save operations (basic check)
        hasPendingSaves: function() {
            // This currently only tracks module data saves initiated via saveModuleData
            // It doesn't track the batch commits from firebase-config.js directly
            return Object.keys(_pendingSaves).length > 0;
        },

        // Start auto-save timer (saves entire client)
        startAutoSave: function(interval = 5 * 60 * 1000) { // Default: 5 minutes
            // Clear any existing timer
            this.stopAutoSave();

            // Only start if we have a current client
            if (!_currentClient) return;

            console.log("[ClientManager] Starting auto-save timer for client:", _currentClient.name);

            // Create new timer
            _autoSaveTimer = setInterval(() => {
                // Only auto-save if we have a current client and no active user inputs
                 const activeElement = document.activeElement;
                 const isInputActive = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT');

                if (_currentClient && !isInputActive) {
                    console.log("[ClientManager] Auto-saving client data for:", _currentClient.name);
                    // We'll just update the client to save all data
                    // Pass a callback that logs success/failure
                    this.updateClient(_currentClient, (success, error) => {
                         if(success) {
                              // console.log("[ClientManager] Auto-save successful.");
                         } else {
                              console.error("[ClientManager] Auto-save failed:", error);
                         }
                    });
                }
            }, interval);
        },

        // Stop auto-save timer
        stopAutoSave: function() {
            if (_autoSaveTimer) {
                console.log("[ClientManager] Stopping auto-save timer");
                clearInterval(_autoSaveTimer);
                _autoSaveTimer = null;
            }
        },

        // Event handler for client changes - to be implemented by consumers
        onClientChanged: null
    };

    // Export the ClientManager
    window.ConstructionApp.ClientManager = ClientManager;

    // Add window beforeunload handler to warn about pending saves (optional)
    // Note: This check might be limited if saves are batched in firebase-config
    // window.addEventListener('beforeunload', function(e) {
    //     if (ClientManager.hasPendingSaves()) {
    //         const message = 'You have unsaved changes that might not have reached the server. Are you sure you want to leave?';
    //         e.returnValue = message;
    //         return message;
    //     }
    // });
})();
