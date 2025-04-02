// client-manager.js - Added logging to debug onClientChanged callback

// Client manager for the Construction Estimator app
(function() {
    // Ensure our namespace exists
    window.ConstructionApp = window.ConstructionApp || {};

    // Private data
    let _clients = [];
    let _currentClient = null;
    let _pendingSaves = {}; // Track pending save operations
    let _autoSaveTimer = null; // Timer for auto-saving

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
                const clientData = sessionStorage.getItem('currentClient');
                if (clientData) {
                    try {
                        _currentClient = JSON.parse(clientData);
                        console.log("[ClientManager] Restored client from sessionStorage:", _currentClient?.name || 'Unknown');
                    } catch (error) {
                        console.error("[ClientManager] Error parsing stored client:", error);
                        sessionStorage.removeItem('currentClient');
                    }
                }
            }
            return _currentClient;
        },

        // Set current client
        setCurrentClient: function(client) {
            console.log("[ClientManager] setCurrentClient called with:", client ? client.name : "None");
            _currentClient = client;

            // Save to sessionStorage for persistence between pages
            if (client) {
                try {
                    sessionStorage.setItem('currentClient', JSON.stringify(client));
                    console.log("[ClientManager] Client saved to sessionStorage");
                } catch (error) {
                     console.error("[ClientManager] Error saving client to sessionStorage:", error);
                }
                // Start auto-save timer for this client
                this.startAutoSave();
            } else {
                sessionStorage.removeItem('currentClient');
                console.log("[ClientManager] Client removed from sessionStorage");
                // Stop auto-save timer when no client is selected
                this.stopAutoSave();
            }

            // --- DEBUG LOGS for Callback ---
            console.log("DEBUG: [setCurrentClient] Checking onClientChanged callback...");
            console.log("DEBUG: [setCurrentClient] typeof this.onClientChanged:", typeof this.onClientChanged);
            if (typeof this.onClientChanged === 'function') {
                console.log("DEBUG: [setCurrentClient] Callback is a function. Attempting to call it...");
                try {
                    this.onClientChanged(client); // Call the callback
                    console.log("DEBUG: [setCurrentClient] Callback called successfully.");
                } catch (callbackError) {
                     console.error("DEBUG: [setCurrentClient] Error occurred INSIDE the onClientChanged callback function:", callbackError);
                }
            } else {
                 console.warn("DEBUG: [setCurrentClient] this.onClientChanged is NOT a function. Callback skipped.");
            }
            // --- END DEBUG LOGS ---

            return client;
        },

        // Add a new client
        addClient: function(clientData, callback) {
            // Create a new client with a unique ID if not provided
            const client = {
                id: clientData.id || `client-${Date.now()}`,
                name: clientData.name,
                address: clientData.address || '',
                moduleData: clientData.moduleData || {},
                created: new Date().toISOString(),
                lastModified: new Date().toISOString()
            };

            console.log("[ClientManager] Adding new client:", client.name);

            // Add to the clients array
            _clients.push(client);

            // Save to Firestore if available
            if (window.ConstructionApp.Firebase) {
                window.ConstructionApp.Firebase.saveClient(client)
                    .then(() => {
                        console.log("[ClientManager] Client saved to Firebase successfully");
                        if (callback) callback(true, client); // Pass client back on success
                    })
                    .catch(error => {
                        console.error("[ClientManager] Error saving client to Firebase:", error);
                        if (callback) callback(false, error.message);
                    });
            } else {
                 console.warn("[ClientManager] Firebase not available, client added locally only.");
                if (callback) callback(true, client); // Still succeed locally
            }

            return client; // Return the created client object synchronously
        },

        // Update an existing client
        updateClient: function(client, callback) {
            console.log("[ClientManager] Updating client:", client?.name || 'Invalid Client');
             if (!client || !client.id) {
                  console.error("[ClientManager] updateClient called with invalid client object.");
                  if (callback) callback(false, "Invalid client data provided");
                  return false;
             }


            // Update last modified timestamp
            client.lastModified = new Date().toISOString();

            // Find and update the client in the array
            const index = _clients.findIndex(c => c.id === client.id);
            let updatedLocally = false;
            if (index >= 0) {
                _clients[index] = client;
                updatedLocally = true;

                // If this is the current client, update it and sessionStorage
                if (_currentClient && _currentClient.id === client.id) {
                    _currentClient = client;
                     try {
                         sessionStorage.setItem('currentClient', JSON.stringify(client));
                         console.log("[ClientManager] Updated current client in sessionStorage");
                     } catch (error) {
                          console.error("[ClientManager] Error updating current client in sessionStorage:", error);
                     }
                }

            } else {
                 console.warn("[ClientManager] Client not found in local array for update:", client.id);
                 // Optionally add if not found? Or just rely on save below?
                 // For now, we'll proceed to save to Firebase anyway.
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
                 console.warn("[ClientManager] Firebase not available, client updated locally only (if found).");
                if (callback) callback(updatedLocally, updatedLocally ? null : "Client not found locally");
            }

            return updatedLocally; // Return status based on local update
        },

        // Load clients from Firestore
        loadClients: async function() {
            console.log("[ClientManager] Loading clients from Firestore");
            if (window.ConstructionApp.Firebase) {
                try {
                    const loadedClients = await window.ConstructionApp.Firebase.loadClients();
                    if (loadedClients && Array.isArray(loadedClients)) {
                         _clients = loadedClients; // Replace local cache
                         console.log("[ClientManager] Loaded", loadedClients.length, "clients");
                    } else {
                         console.warn("[ClientManager] loadClients from Firebase did not return a valid array.");
                         _clients = []; // Reset local cache if load failed
                    }
                    return _clients; // Return the loaded (or empty) array
                } catch (error) {
                    console.error("[ClientManager] Error loading clients:", error);
                    _clients = []; // Reset on error
                    return []; // Return empty array on error
                }
            } else {
                 console.warn("[ClientManager] Firebase not available for loading clients.");
                 return _clients; // Return current local cache (might be empty)
            }
        },

        // Save module data for the current client with enhanced error handling
        saveModuleData: function(moduleId, data, callback) {
            if (!_currentClient) {
                console.error("[ClientManager] No current client to save module data for");
                if (callback) callback(false, "No client selected");
                return false; // Indicate failure
            }
             if (!moduleId) {
                  console.error("[ClientManager] Invalid moduleId provided for saveModuleData");
                  if (callback) callback(false, "Invalid module ID");
                  return false;
             }

            console.log("[ClientManager] Saving module data for", moduleId, "to client", _currentClient.name);

            // Generate a save operation ID (optional, for tracking complex saves)
            // const saveOpId = `${moduleId}-${Date.now()}`;
            // _pendingSaves[saveOpId] = true;

            // Update last modified timestamp on the client
            _currentClient.lastModified = new Date().toISOString();

            // Ensure moduleData container exists
            if (!_currentClient.moduleData) {
                _currentClient.moduleData = {};
            }

            // Update or remove the module data
            if (data === null) {
                 console.log(`[ClientManager] Removing module data for ${moduleId}`);
                 delete _currentClient.moduleData[moduleId];
            } else {
                 console.log(`[ClientManager] Updating module data for ${moduleId}`);
                 _currentClient.moduleData[moduleId] = data; // Store the provided data directly
            }


            // Update sessionStorage immediately
            try {
                sessionStorage.setItem('currentClient', JSON.stringify(_currentClient));
                console.log("[ClientManager] Updated client in sessionStorage with new module data");
            } catch (error) {
                 console.error("[ClientManager] Error updating sessionStorage with module data:", error);
                 // Should we still attempt Firebase save? Probably yes.
            }


            // Save the specific module data field to Firestore if available
            if (window.ConstructionApp.Firebase) {
                window.ConstructionApp.Firebase.saveModuleData(_currentClient.id, moduleId, data) // Pass data directly
                    .then(() => {
                        console.log("[ClientManager] Module data saved to Firebase successfully");
                        // delete _pendingSaves[saveOpId];
                        if (callback) callback(true, null);
                    })
                    .catch(error => {
                        console.error("[ClientManager] Error saving module data to Firebase:", error);
                        // delete _pendingSaves[saveOpId];
                        // Retry logic could be added here
                        if (callback) callback(false, error.message);
                    });
            } else {
                 console.warn("[ClientManager] Firebase not available, module data saved locally only.");
                // delete _pendingSaves[saveOpId];
                if (callback) callback(true, null); // Report success for local save
            }

            return true; // Indicate local update started
        },

        // Get module data for the current client
        getModuleData: function(moduleId) {
            const client = this.getCurrentClient(); // Use getter to ensure sessionStorage check if needed
            if (!client || !client.moduleData || !moduleId) {
                return null;
            }
            // Return the data stored under the module ID (could be versioned or direct)
            return client.moduleData[moduleId] || null;
        },

        // Clear the current client
        clearCurrentClient: function() {
            console.log("[ClientManager] Clearing current client");
            const previousClient = _currentClient; // Store previous client for notification
            _currentClient = null;
            sessionStorage.removeItem('currentClient'); // Remove from sessionStorage

            // Stop auto-save timer
            this.stopAutoSave();

            // Notify any listeners THAT THE CLIENT HAS CHANGED (to null)
            console.log("DEBUG: [clearCurrentClient] Checking onClientChanged callback...");
            console.log("DEBUG: [clearCurrentClient] typeof this.onClientChanged:", typeof this.onClientChanged);
            if (typeof this.onClientChanged === 'function') {
                 console.log("DEBUG: [clearCurrentClient] Callback is function. Calling with null...");
                 try {
                      this.onClientChanged(null); // Notify listeners that client is now null
                      console.log("DEBUG: [clearCurrentClient] Callback called successfully.");
                 } catch (callbackError) {
                      console.error("DEBUG: [clearCurrentClient] Error occurred INSIDE the onClientChanged callback function:", callbackError);
                 }
            } else {
                 console.warn("DEBUG: [clearCurrentClient] this.onClientChanged is NOT a function. Callback skipped.");
            }

            return true; // Indicate success
        },

        // Force a refresh of the current client from sessionStorage
        // Note: This might overwrite in-memory changes if called carelessly
        refreshCurrentClient: function() {
            console.log("[ClientManager] Attempting to refresh current client from sessionStorage");
            const clientData = sessionStorage.getItem('currentClient');
            let refreshedClient = null;
            if (clientData) {
                try {
                    refreshedClient = JSON.parse(clientData);
                    console.log("[ClientManager] Refreshed current client from sessionStorage:", refreshedClient?.name || 'Unknown');
                } catch (error) {
                    console.error("[ClientManager] Error refreshing client from sessionStorage:", error);
                    sessionStorage.removeItem('currentClient'); // Clear corrupted data
                    refreshedClient = null;
                }
            } else {
                console.log("[ClientManager] No client found in sessionStorage during refresh");
                refreshedClient = null;
            }

            // Update the internal state ONLY IF different or nulling out
            if (_currentClient?.id !== refreshedClient?.id) {
                 _currentClient = refreshedClient; // Update internal variable

                 // Stop/Start auto-save timer based on refreshed client
                 this.stopAutoSave();
                 if (_currentClient) {
                      this.startAutoSave();
                 }

                 // Notify listeners about the change
                 console.log("DEBUG: [refreshCurrentClient] Checking onClientChanged callback...");
                 console.log("DEBUG: [refreshCurrentClient] typeof this.onClientChanged:", typeof this.onClientChanged);
                 if (typeof this.onClientChanged === 'function') {
                      console.log("DEBUG: [refreshCurrentClient] Callback is function. Calling with refreshed client...");
                      try {
                           this.onClientChanged(_currentClient);
                           console.log("DEBUG: [refreshCurrentClient] Callback called successfully.");
                      } catch (callbackError) {
                           console.error("DEBUG: [refreshCurrentClient] Error occurred INSIDE the onClientChanged callback function:", callbackError);
                      }
                 } else {
                      console.warn("DEBUG: [refreshCurrentClient] this.onClientChanged is NOT a function. Callback skipped.");
                 }
            } else {
                 console.log("[ClientManager] Refreshed client is the same as current in-memory client. No notification needed.");
            }


            return _currentClient; // Return the potentially refreshed client
        },

        // Check if there are pending save operations (if tracking is used)
        hasPendingSaves: function() {
            // This was likely intended for batching, which seems bypassed now
            // Return false for now, or implement based on actual save promises if needed
            return Object.keys(_pendingSaves).length > 0; // Basic check if _pendingSaves is used
        },

        // Start auto-save timer
        startAutoSave: function(interval = 5 * 60 * 1000) { // Default: 5 minutes
            // Clear any existing timer
            this.stopAutoSave();

            // Only start if we have a current client
            if (!_currentClient) return;

            console.log("[ClientManager] Starting auto-save timer for", _currentClient.name);

            // Create new timer
            _autoSaveTimer = setInterval(() => {
                // Only auto-save if we have a current client and no active user inputs
                // (to avoid saving partially entered data)
                if (_currentClient && (!document.activeElement || !document.activeElement.matches('input, textarea, select'))) {
                    console.log("[ClientManager] Auto-saving client data...");
                    // We'll just update the client to save all data
                    this.updateClient(_currentClient, (success, error) => {
                         if (!success) {
                              console.error("[ClientManager] Auto-save failed:", error);
                         } else {
                              console.log("[ClientManager] Auto-save successful.");
                         }
                    });
                } else {
                     // console.log("[ClientManager] Auto-save skipped (client null or input active)."); // Can be noisy
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
        onClientChanged: null // Initialized to null
    };

    // Export the ClientManager
    window.ConstructionApp.ClientManager = ClientManager;

    // Add window beforeunload handler to warn about unsaved changes
    // Note: This relies on ModuleUtils potentially setting a flag, or ClientManager tracking saves
    // window.addEventListener('beforeunload', function(e) {
    //     // Check if ModuleUtils indicates unsaved changes OR if ClientManager has pending saves
    //     const moduleHasUnsaved = window.ConstructionApp?.ModuleUtils?.hasUnsavedChanges();
    //     const clientHasPending = ClientManager.hasPendingSaves(); // Check if this is still relevant

    //     if (moduleHasUnsaved /* || clientHasPending */) { // Decide if clientHasPending is needed
    //         console.warn("[ClientManager] Unsaved changes detected on beforeunload.");
    //         // This will trigger the browser's "unsaved changes" warning
    //         const message = 'You have unsaved changes. Are you sure you want to leave?';
    //         e.returnValue = message; // Standard way to trigger prompt
    //         return message; // For older browsers
    //     }
    // });
})();
