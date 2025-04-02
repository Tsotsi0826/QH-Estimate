// Client management for the Construction Estimator
(function() {
    // Ensure our namespace exists
    window.ConstructionApp = window.ConstructionApp || {};
    
    // Client manager object
    const ClientManager = {
        // Internal storage for clients and current client
        _clients: [],
        _currentClient: null,
        
        // Client changed event handler
        onClientChanged: null,
        
        // Initialize the client manager
        init: function() {
            console.log("[ClientManager] Initializing client manager");
            return this.loadClients();
        },
        
        // Load clients from storage
        loadClients: function() {
            return new Promise((resolve, reject) => {
                if (window.ConstructionApp.Firebase) {
                    window.ConstructionApp.Firebase.loadClients()
                        .then(clients => {
                            this._clients = clients || [];
                            console.log("[ClientManager] Loaded", this._clients.length, "clients from Firebase");
                            resolve(this._clients);
                        })
                        .catch(error => {
                            console.error("[ClientManager] Error loading clients from Firebase:", error);
                            this._clients = this.loadClientsFromBackup() || [];
                            console.log("[ClientManager] Loaded", this._clients.length, "clients from backup");
                            resolve(this._clients);
                        });
                } else {
                    console.warn("[ClientManager] Firebase not available, loading from backup");
                    this._clients = this.loadClientsFromBackup() || [];
                    console.log("[ClientManager] Loaded", this._clients.length, "clients from backup");
                    resolve(this._clients);
                }
            });
        },
        
        // Get all clients
        getAllClients: function() {
            return this._clients;
        },
        
        // Get current client
        getCurrentClient: function() {
            // If we have client in memory, return it
            if (this._currentClient) {
                return this._currentClient;
            }
            
            // Try to restore from sessionStorage as fallback
            const storedClientStr = sessionStorage.getItem('currentClient');
            if (storedClientStr) {
                try {
                    const restoredClient = JSON.parse(storedClientStr);
                    console.log("[ClientManager] Restored client from sessionStorage:", restoredClient.name);
                    this._currentClient = restoredClient;
                    return restoredClient;
                } catch (error) {
                    console.error("[ClientManager] Error parsing stored client:", error);
                    sessionStorage.removeItem('currentClient');
                }
            }
            
            return null;
        },
        
        // Set current client
        setCurrentClient: function(client) {
            console.log("[ClientManager] Setting current client:", client ? client.name : "None");
            
            // Store internally in the ClientManager object
            this._currentClient = client;
            
            // Always save to sessionStorage if we have a client
            if (client) {
                sessionStorage.setItem('currentClient', JSON.stringify(client));
                console.log("[ClientManager] Client saved to sessionStorage:", client.name);
            } else {
                // Only remove if explicitly setting to null
                sessionStorage.removeItem('currentClient');
                console.log("[ClientManager] Client removed from sessionStorage");
            }
            
            // Trigger client changed event if we have one
            if (typeof this.onClientChanged === 'function') {
                console.log("[ClientManager] Triggering onClientChanged");
                this.onClientChanged(client);
            }
            
            return client;
        },
        
        // Clear current client
        clearCurrentClient: function() {
            console.log("[ClientManager] Clearing current client");
            this._currentClient = null;
            sessionStorage.removeItem('currentClient');
            
            // Trigger client changed event if we have one
            if (typeof this.onClientChanged === 'function') {
                console.log("[ClientManager] Triggering onClientChanged after clear");
                this.onClientChanged(null);
            }
            
            return null;
        },
        
        // Add a new client
        addClient: function(clientData) {
            if (!clientData || !clientData.name) {
                console.error("[ClientManager] Cannot add client: Invalid client data");
                return null;
            }
            
            console.log("[ClientManager] Adding new client:", clientData.name);
            
            // Generate unique ID if not provided
            if (!clientData.id) {
                clientData.id = 'client-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            }
            
            // Initialize module data if not provided
            if (!clientData.moduleData) {
                clientData.moduleData = {};
            }
            
            // Create timestamps
            const now = new Date().toISOString();
            clientData.createdAt = clientData.createdAt || now;
            clientData.updatedAt = now;
            
            // Add to clients array
            this._clients.push(clientData);
            
            // Save clients to storage
            this.saveClients();
            
            // Save to backup
            this.saveClientsToBackup();
            
            // Set as current client
            this.setCurrentClient(clientData);
            
            return clientData;
        },
        
        // Update an existing client
        updateClient: function(clientId, updatedData) {
            if (!clientId || !updatedData) {
                console.error("[ClientManager] Cannot update client: Missing ID or data");
                return null;
            }
            
            console.log("[ClientManager] Updating client:", clientId);
            
            // Find the client
            const clientIndex = this._clients.findIndex(client => client.id === clientId);
            if (clientIndex === -1) {
                console.error("[ClientManager] Cannot update client: Client not found");
                return null;
            }
            
            // Get the existing client
            const existingClient = this._clients[clientIndex];
            
            // Create an updated client object
            const updatedClient = {
                ...existingClient,
                ...updatedData,
                id: clientId, // Ensure ID doesn't change
                updatedAt: new Date().toISOString()
            };
            
            // Update the clients array
            this._clients[clientIndex] = updatedClient;
            
            // Save clients to storage
            this.saveClients();
            
            // Save to backup
            this.saveClientsToBackup();
            
            // Update current client if this is the current client
            if (this._currentClient && this._currentClient.id === clientId) {
                this.setCurrentClient(updatedClient);
            }
            
            return updatedClient;
        },
        
        // Delete a client
        deleteClient: function(clientId) {
            if (!clientId) {
                console.error("[ClientManager] Cannot delete client: Missing ID");
                return false;
            }
            
            console.log("[ClientManager] Deleting client:", clientId);
            
            // Find the client
            const clientIndex = this._clients.findIndex(client => client.id === clientId);
            if (clientIndex === -1) {
                console.error("[ClientManager] Cannot delete client: Client not found");
                return false;
            }
            
            // Remove from clients array
            this._clients.splice(clientIndex, 1);
            
            // Save clients to storage
            this.saveClients();
            
            // Save to backup
            this.saveClientsToBackup();
            
            // Clear current client if this is the current client
            if (this._currentClient && this._currentClient.id === clientId) {
                this.clearCurrentClient();
            }
            
            return true;
        },
        
        // Save module data for current client
        saveModuleData: function(moduleId, moduleData, callback) {
            console.log("[ClientManager] Saving module data for:", moduleId);
            
            const client = this.getCurrentClient();
            if (!client) {
                console.error("[ClientManager] Cannot save module data: No client selected");
                if (callback) callback(false, "No client selected");
                return false;
            }
            
            // Make sure moduleData property exists
            if (!client.moduleData) {
                client.moduleData = {};
            }
            
            // Update the module data with version tracking
            if (moduleData === null) {
                // Clear module data if null is passed
                delete client.moduleData[moduleId];
            } else {
                // Otherwise update with the new data
                client.moduleData[moduleId] = {
                    data: moduleData,
                    lastUpdated: new Date().toISOString()
                };
            }
            
            // Update timestamp
            client.updatedAt = new Date().toISOString();
            
            // Update sessionStorage with the updated client
            sessionStorage.setItem('currentClient', JSON.stringify(client));
            console.log("[ClientManager] Updated client in sessionStorage after module save");
            
            // Update the client in the clients array
            const clientIndex = this._clients.findIndex(c => c.id === client.id);
            if (clientIndex !== -1) {
                this._clients[clientIndex] = client;
            }
            
            // Save to Firebase if available
            if (window.ConstructionApp.Firebase) {
                window.ConstructionApp.Firebase.saveClient(client)
                    .then(success => {
                        console.log("[ClientManager] Client saved to Firebase:", success);
                        if (callback) callback(success);
                    })
                    .catch(error => {
                        console.error("[ClientManager] Error saving client to Firebase:", error);
                        if (callback) callback(false, error.message);
                    });
            } else {
                console.warn("[ClientManager] Firebase not available, client only saved to sessionStorage");
                if (callback) callback(true);
            }
            
            // Also update backup
            this.saveClientsToBackup();
            
            // Make sure we update the internal client reference
            this._currentClient = client;
            
            return true;
        },
        
        // Save clients to storage
        saveClients: function() {
            console.log("[ClientManager] Saving all clients");
            
            // Save to Firebase if available
            if (window.ConstructionApp.Firebase) {
                window.ConstructionApp.Firebase.saveClients(this._clients)
                    .then(success => {
                        console.log("[ClientManager] Clients saved to Firebase:", success);
                    })
                    .catch(error => {
                        console.error("[ClientManager] Error saving clients to Firebase:", error);
                        // Save to backup on error
                        this.saveClientsToBackup();
                    });
            } else {
                console.warn("[ClientManager] Firebase not available, clients only saved to backup");
                this.saveClientsToBackup();
            }
            
            return true;
        },
        
        // Save clients to local storage backup
        saveClientsToBackup: function() {
            try {
                localStorage.setItem('clientsBackup', JSON.stringify(this._clients));
                console.log("[ClientManager] Clients saved to backup");
                return true;
            } catch (error) {
                console.error("[ClientManager] Error saving clients to backup:", error);
                return false;
            }
        },
        
        // Load clients from local storage backup
        loadClientsFromBackup: function() {
            try {
                const clientsStr = localStorage.getItem('clientsBackup');
                if (clientsStr) {
                    const clients = JSON.parse(clientsStr);
                    console.log("[ClientManager] Loaded clients from backup:", clients.length);
                    return clients;
                }
            } catch (error) {
                console.error("[ClientManager] Error loading clients from backup:", error);
            }
            
            return [];
        }
    };
    
    // Export the ClientManager
    window.ConstructionApp.ClientManager = ClientManager;
})();
