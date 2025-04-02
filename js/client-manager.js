// client-manager.js - Enhanced Client data management with improved saving

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
                
                // Start auto-save timer for this client
                this.startAutoSave();
            } else {
                sessionStorage.removeItem('currentClient');
                console.log("[ClientManager] Client removed from sessionStorage");
                
                // Stop auto-save timer when no client is selected
                this.stopAutoSave();
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
                        if (callback) callback(true, client);
                    })
                    .catch(error => {
                        console.error("[ClientManager] Error saving client to Firebase:", error);
                        if (callback) callback(false, error.message);
                    });
            } else {
                if (callback) callback(true, client);
            }
            
            return client;
        },
        
        // Update an existing client
        updateClient: function(client, callback) {
            console.log("[ClientManager] Updating client:", client.name);
            
            // Update last modified timestamp
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
                            if (callback) callback(true, null);
                        })
                        .catch(error => {
                            console.error("[ClientManager] Error updating client in Firebase:", error);
                            if (callback) callback(false, error.message);
                        });
                } else {
                    if (callback) callback(true, "Firebase not available, updated locally only");
                }
                
                return true;
            }
            
            if (callback) callback(false, "Client not found");
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
                    console.error("[ClientManager] Error loading clients:", error);
                    return [];
                }
            }
            return _clients;
        },
        
        // Save module data for the current client with enhanced error handling
        saveModuleData: function(moduleId, data, callback) {
            if (!_currentClient) {
                console.error("[ClientManager] No current client to save module data for");
                if (callback) callback(false, "No client selected");
                return false;
            }
            
            console.log("[ClientManager] Saving module data for", moduleId, "to client", _currentClient.name);
            
            // Generate a save operation ID
            const saveOpId = `${moduleId}-${Date.now()}`;
            _pendingSaves[saveOpId] = true;
            
            // Update last modified timestamp
            _currentClient.lastModified = new Date().toISOString();
            
            // Ensure moduleData exists
            if (!_currentClient.moduleData) {
                _currentClient.moduleData = {};
            }
            
            // Update the module data
            _currentClient.moduleData[moduleId] = data;
            
            // Update sessionStorage
            sessionStorage.setItem('currentClient', JSON.stringify(_currentClient));
            console.log("[ClientManager] Updated client in sessionStorage with new module data");
            
            // Save to Firestore if available
            if (window.ConstructionApp.Firebase) {
                window.ConstructionApp.Firebase.saveModuleData(_currentClient.id, moduleId, data)
                    .then(() => {
                        console.log("[ClientManager] Module data saved to Firebase successfully");
                        delete _pendingSaves[saveOpId];
                        if (callback) callback(true, null);
                    })
                    .catch(error => {
                        console.error("[ClientManager] Error saving module data to Firebase:", error);
                        delete _pendingSaves[saveOpId];
                        
                        // Retry logic could be added here
                        
                        if (callback) callback(false, error.message);
                    });
            } else {
                delete _pendingSaves[saveOpId];
                if (callback) callback(true, "Firebase not available, saved locally only");
            }
            
            return true;
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
            
            // Stop auto-save timer
            this.stopAutoSave();
            
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
                    
                    // Restart auto-save timer
                    this.startAutoSave();
                    
                    // Notify any listeners
                    if (typeof this.onClientChanged === 'function') {
                        this.onClientChanged(_currentClient);
                    }
                    
                    return _currentClient;
                } catch (error) {
                    console.error("[ClientManager] Error refreshing client from sessionStorage:", error);
                    sessionStorage.removeItem('currentClient');
                    _currentClient = null;
                    
                    // Stop auto-save timer
                    this.stopAutoSave();
                    
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
        
        // Check if there are pending save operations
        hasPendingSaves: function() {
            return Object.keys(_pendingSaves).length > 0;
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
                if (_currentClient && (!document.activeElement || !document.activeElement.matches('input, textarea, select'))) {
                    // We'll just update the client to save all data
                    this.updateClient(_currentClient);
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
    
    // Add window beforeunload handler to warn about unsaved changes
    window.addEventListener('beforeunload', function(e) {
        if (ClientManager.hasPendingSaves()) {
            // This will trigger the browser's "unsaved changes" warning
            const message = 'You have unsaved changes. Are you sure you want to leave?';
            e.returnValue = message;
            return message;
        }
    });
})();
