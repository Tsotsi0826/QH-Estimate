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
            return _currentClient;
        },
        
        // Set current client
        setCurrentClient: function(client) {
            _currentClient = client;
            
            // Save to localStorage for persistence between pages
            localStorage.setItem('currentClient', JSON.stringify(client));
            
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
            // Find and update the client in the array
            const index = _clients.findIndex(c => c.id === client.id);
            if (index >= 0) {
                _clients[index] = client;
                
                // If this is the current client, update it
                if (_currentClient && _currentClient.id === client.id) {
                    _currentClient = client;
                    localStorage.setItem('currentClient', JSON.stringify(client));
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
            if (window.ConstructionApp.Firebase) {
                const loadedClients = await window.ConstructionApp.Firebase.loadClients();
                if (loadedClients.length > 0) {
                    _clients = loadedClients;
                }
            }
            return _clients;
        },
        
        // Load current client from localStorage
        loadCurrentClientFromStorage: function() {
            const clientData = localStorage.getItem('currentClient');
            if (clientData) {
                try {
                    _currentClient = JSON.parse(clientData);
                    
                    // Check if this client exists in our clients array
                    const existingClient = _clients.find(c => c.id === _currentClient.id);
                    if (!existingClient) {
                        // Add to clients array if it doesn't exist
                        _clients.push(_currentClient);
                    }
                    
                    return _currentClient;
                } catch (error) {
                    console.error("Error parsing stored client:", error);
                    return null;
                }
            }
            return null;
        },
        
        // Save module data for the current client
        saveModuleData: function(moduleId, data) {
            if (!_currentClient) {
                console.error("No current client to save module data for");
                return false;
            }
            
            // Ensure moduleData exists
            if (!_currentClient.moduleData) {
                _currentClient.moduleData = {};
            }
            
            // Update the module data
            _currentClient.moduleData[moduleId] = data;
            
            // Update localStorage
            localStorage.setItem('currentClient', JSON.stringify(_currentClient));
            
            // Save to Firestore if available
            if (window.ConstructionApp.Firebase) {
                window.ConstructionApp.Firebase.saveModuleData(_currentClient.id, moduleId, data);
            }
            
            return true;
        },
        
        // Get module data for the current client
        getModuleData: function(moduleId) {
            if (!_currentClient || !_currentClient.moduleData) {
                return null;
            }
            return _currentClient.moduleData[moduleId] || null;
        },
        
        // Clear the current client
        clearCurrentClient: function() {
            _currentClient = null;
            localStorage.removeItem('currentClient'); // Remove from localStorage
            
            // Notify any listeners
            if (typeof this.onClientChanged === 'function') {
                this.onClientChanged(null);
            }
            
            return true;
        },
        
        // Event handler for client changes - to be implemented by consumers
        onClientChanged: null
    };
    
    // Export the ClientManager
    window.ConstructionApp.ClientManager = ClientManager;
})();
