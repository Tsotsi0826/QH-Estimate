// client-manager.js - Client data management

// Client manager for the Construction Estimator app
(function() {
    // Ensure our namespace exists
    window.ConstructionApp = window.ConstructionApp || {};
    
    // Private data
    let _clients = [];
    let _currentClient = null;
    
    // Client Manager object
    const ClientManager = {
        // Get all clients
        getAllClients: function() {
            return _clients;
        },
        
        // Get current client
        getCurrentClient: function() {
            // If _currentClient is null, try to get from localStorage
            if (!_currentClient) {
                const clientData = localStorage.getItem('currentClient');
                if (clientData) {
                    try {
                        _currentClient = JSON.parse(clientData);
                        console.log("[ClientManager] Restored client from localStorage:", _currentClient.name);
                    } catch (error) {
                        console.error("[ClientManager] Error parsing stored client:", error);
                        localStorage.removeItem('currentClient');
                    }
                }
            }
            return _currentClient;
        },
        
        // Set current client
        setCurrentClient: function(client) {
            console.log("[ClientManager] Setting current client:", client ? client.name : "None");
            _currentClient = client;
            
            // Save to localStorage for persistence between pages
            if (client) {
                localStorage.setItem('currentClient', JSON.stringify(client));
                console.log("[ClientManager] Client saved to localStorage");
            } else {
                localStorage.removeItem('currentClient');
                console.log("[ClientManager] Client removed from localStorage");
            }
            
            // Notify any listeners
            if (typeof this.onClientChanged === 'function') {
                this.onClientChanged(client);
            }
            
            return client;
        },
        
        // Add a new client
        addClient: function(clientData) {
            // Create a new client with a unique ID if not provided
            const client = {
                id: clientData.id || `client-${Date.now()}`,
                name: clientData.name,
                address: clientData.address || '',
                moduleData: clientData.moduleData || {}
            };
            
            console.log("[ClientManager] Adding new client:", client.name);
            
            // Add to the clients array
            _clients.push(client);
            
            // Save to Firestore if available
            if (window.ConstructionApp.Firebase) {
                window.ConstructionApp.Firebase.saveClient(client);
            }
            
            return client;
        },
        
        // Update an existing client
        updateClient: function(client) {
            console.log("[ClientManager] Updating client:", client.name);
            
            // Find and update the client in the array
            const index = _clients.findIndex(c => c.id === client.id);
            if (index >= 0) {
                _clients[index] = client;
                
                // If this is the current client, update it
                if (_currentClient && _currentClient.id === client.id) {
                    _currentClient = client;
                    localStorage.setItem('currentClient', JSON.stringify(client));
                    console.log("[ClientManager] Updated current client in localStorage");
                }
                
                // Save to Firestore if available
                if (window.ConstructionApp.Firebase) {
                    window.ConstructionApp.Firebase.saveClient(client);
                }
                
                return true;
            }
            return false;
        },
        
        // Load clients from Firestore
        loadClients: async function() {
            console.log("[ClientManager] Loading clients from Firestore");
            if (window.ConstructionApp.Firebase) {
                const loadedClients = await window.ConstructionApp.Firebase.loadClients();
                if (loadedClients.length > 0) {
                    _clients = loadedClients;
                    console.log("[ClientManager] Loaded", loadedClients.length, "clients");
                }
            }
            return _clients;
        },
        
        // Save module data for the current client
        saveModuleData: function(moduleId, data) {
            if (!_currentClient) {
                console.error("[ClientManager] No current client to save module data for");
                return false;
            }
            
            console.log("[ClientManager] Saving module data for", moduleId, "to client", _currentClient.name);
            
            // Ensure moduleData exists
            if (!_currentClient.moduleData) {
                _currentClient.moduleData = {};
            }
            
            // Update the module data
            _currentClient.moduleData[moduleId] = data;
            
            // Update localStorage
            localStorage.setItem('currentClient', JSON.stringify(_currentClient));
            console.log("[ClientManager] Updated client in localStorage with new module data");
            
            // Save to Firestore if available
            if (window.ConstructionApp.Firebase) {
                window.ConstructionApp.Firebase.saveModuleData(_currentClient.id, moduleId, data);
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
            localStorage.removeItem('currentClient'); // Remove from localStorage
            
            // Notify any listeners
            if (typeof this.onClientChanged === 'function') {
                this.onClientChanged(null);
            }
            
            return true;
        },
        
        // Force a refresh of the current client from localStorage
        refreshCurrentClient: function() {
            const clientData = localStorage.getItem('currentClient');
            if (clientData) {
                try {
                    _currentClient = JSON.parse(clientData);
                    console.log("[ClientManager] Refreshed current client from localStorage:", _currentClient.name);
                    
                    // Notify any listeners
                    if (typeof this.onClientChanged === 'function') {
                        this.onClientChanged(_currentClient);
                    }
                    
                    return _currentClient;
                } catch (error) {
                    console.error("[ClientManager] Error refreshing client from localStorage:", error);
                    localStorage.removeItem('currentClient');
                    _currentClient = null;
                    
                    // Notify any listeners
                    if (typeof this.onClientChanged === 'function') {
                        this.onClientChanged(null);
                    }
                }
            } else {
                console.log("[ClientManager] No client found in localStorage during refresh");
                _currentClient = null;
                
                // Notify any listeners
                if (typeof this.onClientChanged === 'function') {
                    this.onClientChanged(null);
                }
            }
            
            return null;
        },
        
        // Event handler for client changes - to be implemented by consumers
        onClientChanged: null
    };
    
    // Export the ClientManager
    window.ConstructionApp.ClientManager = ClientManager;
})();
