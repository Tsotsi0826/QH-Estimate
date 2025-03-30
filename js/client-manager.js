// client-manager.js - Client data management with enhanced data persistence

// Client manager for the Construction Estimator app
(function() {
    // Ensure our namespace exists
    window.ConstructionApp = window.ConstructionApp || {};
    
    // Private data
    let _clients = [];
    let _currentClient = null;
    let _saveInProgress = false;
    let _pendingSaves = {};
    let _lastSaveTime = 0;
    
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
                        console.log("[ClientManager] Restored client from sessionStorage:", _currentClient.name);
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
            console.log("[ClientManager] Setting current client:", client ? client.name : "None");
            _currentClient = client;
            
            // Save to sessionStorage for persistence between pages
            if (client) {
                sessionStorage.setItem('currentClient', JSON.stringify(client));
                console.log("[ClientManager] Client saved to sessionStorage");
            } else {
                sessionStorage.removeItem('currentClient');
                console.log("[ClientManager] Client removed from sessionStorage");
            }
            
            // Notify any listeners
            if (typeof this.onClientChanged === 'function') {
                this.onClientChanged(client);
            }
            
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
                        if (callback) callback(true, null, client);
                    })
                    .catch(error => {
                        console.error("[ClientManager] Error saving client to Firebase:", error);
                        if (callback) callback(false, error.message, client);
                    });
            } else {
                if (callback) callback(true, "Firebase not available, saved locally only", client);
            }
            
            return client;
        },
        
        // Update an existing client
        updateClient: function(client, callback) {
            console.log("[ClientManager] Updating client:", client.name);
            
            // Update the last modified timestamp
            client.lastModified = new Date().toISOString();
            
            // Find and update the client in the array
            const index = _clients.findIndex(c => c.id === client.id);
            if (index >= 0) {
                _clients[index] = client;
                
                // If this is the current client, update it
                if (_currentClient && _currentClient.id === client.id) {
                    _currentClient = client;
                    sessionStorage.setItem('currentClient', JSON.stringify(client));
                    console.log("[ClientManager] Updated current client in sessionStorage");
                }
                
                // Save to Firestore if available
                if (window.ConstructionApp.Firebase) {
                    window.ConstructionApp.Firebase.saveClient(client)
                        .then(() => {
                            console.log("[ClientManager] Client updated in Firebase successfully");
                            if (callback) callback(true, null, client);
                        })
                        .catch(error => {
                            console.error("[ClientManager] Error updating client in Firebase:", error);
                            if (callback) callback(false, error.message, client);
                        });
                } else {
                    if (callback) callback(true, "Firebase not available, updated locally only", client);
                }
                
                return true;
            }
            
            if (callback) callback(false, "Client not found in local array", null);
            return false;
        },
        
        // Load clients from Firestore
        loadClients: async function() {
            console.log("[ClientManager] Loading clients from Firestore");
            if (window.ConstructionApp.Firebase) {
                try {
                    const loadedClients = await window.ConstructionApp.Firebase.loadClients();
                    if (loadedClients.length > 0) {
                        _clients = loadedClients;
                        console.log("[ClientManager] Loaded", loadedClients.length, "clients");
                    }
                    return _clients;
                } catch (error) {
                    console.error("[ClientManager] Error loading clients from Firebase:", error);
                    return _clients; // Return whatever clients we have locally
                }
            }
            return _clients;
        },
        
        // Save module data for the current client with enhanced error handling and throttling
        saveModuleData: function(moduleId, data, callback) {
            if (!_currentClient) {
                console.error("[ClientManager] No current client to save module data for");
                if (callback) callback(false, "No client selected");
                return false;
            }
            
            console.log("[ClientManager] Preparing to save module data for", moduleId, "to client", _currentClient.name);
            
            // Ensure moduleData exists
            if (!_currentClient.moduleData) {
                _currentClient.moduleData = {};
            }
            
            // Update the module data
            _currentClient.moduleData[moduleId] = data;
            
            // Update the last modified timestamp
            _currentClient.lastModified = new Date().toISOString();
            
            // Update sessionStorage for immediate local persistence
            sessionStorage.setItem('currentClient', JSON.stringify(_currentClient));
            console.log("[ClientManager] Updated client in sessionStorage with new module data");
            
            // Save to Firestore with throttling and batching
            this._throttledSaveToFirebase(moduleId, callback);
            
            return true;
        },
        
        // Internal method for throttled saving to Firebase
        _throttledSaveToFirebase: function(moduleId, callback) {
            const now = Date.now();
            const clientId = _currentClient.id;
            
            // Add to pending saves
            _pendingSaves[moduleId] = {
                timestamp: now,
                callback: callback
            };
            
            // If a save is already in progress or we haven't waited long enough since the last save,
            // don't trigger another save immediately
            if (_saveInProgress || (now - _lastSaveTime < 2000)) {
                console.log("[ClientManager] Save already in progress or throttled, will batch with next save");
                return;
            }
            
            // Otherwise, schedule a save
            setTimeout(() => this._executeSaveToFirebase(), 500);
        },
        
        // Execute the actual save to Firebase
        _executeSaveToFirebase: function() {
            if (_saveInProgress || !_currentClient || Object.keys(_pendingSaves).length === 0) {
                return;
            }
            
            _saveInProgress = true;
            _lastSaveTime = Date.now();
            
            const currentPendingSaves = {..._pendingSaves};
            _pendingSaves = {}; // Clear pending saves
            
            const client = {..._currentClient}; // Clone to avoid reference issues
            
            console.log("[ClientManager] Executing save to Firebase for modules:", Object.keys(currentPendingSaves));
            
            // Save to Firestore if available
            if (window.ConstructionApp.Firebase) {
                window.ConstructionApp.Firebase.saveClient(client)
                    .then(() => {
                        console.log("[ClientManager] Client data saved to Firebase successfully");
                        
                        // Call all callbacks with success
                        Object.keys(currentPendingSaves).forEach(moduleId => {
                            const saveInfo = currentPendingSaves[moduleId];
                            if (saveInfo.callback) {
                                saveInfo.callback(true, null);
                            }
                        });
                        
                        _saveInProgress = false;
                        
                        // Check if more saves have been requested while we were saving
                        if (Object.keys(_pendingSaves).length > 0) {
                            setTimeout(() => this._executeSaveToFirebase(), 100);
                        }
                    })
                    .catch(error => {
                        console.error("[ClientManager] Error saving to Firebase:", error);
                        
                        // Call all callbacks with the error
                        Object.keys(currentPendingSaves).forEach(moduleId => {
                            const saveInfo = currentPendingSaves[moduleId];
                            if (saveInfo.callback) {
                                saveInfo.callback(false, error.message);
                            }
                        });
                        
                        _saveInProgress = false;
                        
                        // Retry failed saves after a delay
                        setTimeout(() => {
                            // Add back the failed saves to pending saves
                            Object.keys(currentPendingSaves).forEach(moduleId => {
                                _pendingSaves[moduleId] = currentPendingSaves[moduleId];
                            });
                            
                            // Try again
                            this._executeSaveToFirebase();
                        }, 5000); // Retry after 5 seconds
                    });
            } else {
                // Firebase not available, just call callbacks
                Object.keys(currentPendingSaves).forEach(moduleId => {
                    const saveInfo = currentPendingSaves[moduleId];
                    if (saveInfo.callback) {
                        saveInfo.callback(true, "Firebase not available, saved locally only");
                    }
                });
                
                _saveInProgress = false;
            }
        },
        
        // Get module data for the current client
        getModuleData: function(moduleId) {
            const client = this.getCurrentClient();
            if (!client || !client.moduleData) {
                return null;
            }
            return client.moduleData[moduleId] || null;
        },
        
        // Clear the current client
        clearCurrentClient: function() {
            console.log("[ClientManager] Clearing current client");
            _currentClient = null;
            sessionStorage.removeItem('currentClient'); // Remove from sessionStorage
            
            // Notify any listeners
            if (typeof this.onClientChanged === 'function') {
                this.onClientChanged(null);
            }
            
            return true;
        },
        
        // Force a refresh of the current client from sessionStorage
        refreshCurrentClient: function() {
            const clientData = sessionStorage.getItem('currentClient');
            if (clientData) {
                try {
                    _currentClient = JSON.parse(clientData);
                    console.log("[ClientManager] Refreshed current client from sessionStorage:", _currentClient.name);
                    
                    // Notify any listeners
                    if (typeof this.onClientChanged === 'function') {
                        this.onClientChanged(_currentClient);
                    }
                    
                    return _currentClient;
                } catch (error) {
                    console.error("[ClientManager] Error refreshing client from sessionStorage:", error);
                    sessionStorage.removeItem('currentClient');
                    _currentClient = null;
                    
                    // Notify any listeners
                    if (typeof this.onClientChanged === 'function') {
                        this.onClientChanged(null);
                    }
                }
            } else {
                console.log("[ClientManager] No client found in sessionStorage during refresh");
                _currentClient = null;
                
                // Notify any listeners
                if (typeof this.onClientChanged === 'function') {
                    this.onClientChanged(null);
                }
            }
            
            return null;
        },
        
        // Force an immediate save of the current client
        forceSave: function(callback) {
            if (!_currentClient) {
                if (callback) callback(false, "No client selected");
                return false;
            }
            
            // Add a generic save request
            _pendingSaves['_forceSave_'] = {
                timestamp: Date.now(),
                callback: callback
            };
            
            // Execute save immediately
            this._executeSaveToFirebase();
            return true;
        },
        
        // Event handler for client changes - to be implemented by consumers
        onClientChanged: null,
        
        // Get save status
        getSaveStatus: function() {
            return {
                saveInProgress: _saveInProgress,
                pendingSaves: Object.keys(_pendingSaves),
                lastSaveTime: _lastSaveTime
            };
        }
    };
    
    // Export the ClientManager
    window.ConstructionApp.ClientManager = ClientManager;
})();
