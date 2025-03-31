// foundations-dashboard.js - Foundation modules integration

// Foundations Dashboard for the Construction Estimator app
(function() {
    // Ensure our namespace exists
    window.ConstructionApp = window.ConstructionApp || {};
    
    // Private data
    const _foundationModules = ['excavation', 'concrete', 'steel'];
    let _initialized = false;
    
    // Foundations Dashboard object
    const FoundationsDashboard = {
        // Check if a module is a foundation module
        isFoundationModule: function(moduleId) {
            return _foundationModules.includes(moduleId.toLowerCase());
        },
        
        // Get all registered foundation modules
        getFoundationModules: function() {
            return [..._foundationModules];
        },
        
        // Initialize the foundations dashboard
        initialize: function() {
            if (_initialized) return;
            
            console.log("[FoundationsDashboard] Initializing foundations dashboard");
            
            // Register as a dashboard handler
            if (window.ConstructionApp.Dashboard && 
                typeof window.ConstructionApp.Dashboard.registerTileHandler === 'function') {
                window.ConstructionApp.Dashboard.registerTileHandler(this.renderFoundationsTile);
            }
            
            _initialized = true;
        },
        
        // Calculate foundation totals for a client
        calculateFoundationTotals: function(client) {
            if (!client || !client.moduleData) return { total: 0, modules: {} };
            
            const totals = {
                total: 0,
                modules: {}
            };
            
            // Calculate from each foundation module
            _foundationModules.forEach(moduleId => {
                const moduleData = client.moduleData[moduleId];
                
                // Skip if moduleData is null or empty
                if (!moduleData) return;
                
                // Check if the module has a totalCost property
                if (moduleData.totalCost !== undefined) {
                    const cost = parseFloat(moduleData.totalCost) || 0;
                    totals.modules[moduleId] = {
                        cost: cost,
                        name: this.getModuleName(moduleId)
                    };
                    totals.total += cost;
                }
                // Alternative: if the module has 'items' array, calculate from items
                else if (moduleData.items && Array.isArray(moduleData.items)) {
                    let moduleCost = 0;
                    moduleData.items.forEach(item => {
                        if (item.qty > 0) {
                            moduleCost += (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
                        }
                    });
                    totals.modules[moduleId] = {
                        cost: moduleCost,
                        name: this.getModuleName(moduleId)
                    };
                    totals.total += moduleCost;
                }
            });
            
            return totals;
        },
        
        // Get a friendly module name
        getModuleName: function(moduleId) {
            // Get from appData.modules if available
            if (window.appData && window.appData.modules) {
                const module = window.appData.modules.find(m => m.id === moduleId);
                if (module) return module.name;
            }
            
            // Fallback to capitalized moduleId
            return moduleId.charAt(0).toUpperCase() + moduleId.slice(1);
        },
        
        // Render the foundations tile for the dashboard
        renderFoundationsTile: function(client, moduleElements) {
            // Skip if no client
            if (!client || !client.moduleData) return moduleElements;
            
            console.log("[FoundationsDashboard] Rendering foundations tile");
            
            // Calculate foundation totals
            const foundationTotals = window.ConstructionApp.FoundationsDashboard.calculateFoundationTotals(client);
            
            // Only show tile if there are foundation costs
            if (foundationTotals.total <= 0) {
                console.log("[FoundationsDashboard] No foundation costs, skipping tile");
                return moduleElements;
            }
            
            // Format the total cost
            const formattedTotal = window.ConstructionApp.ModuleUtils.formatCurrency(foundationTotals.total);
            
            // Create foundations tile
            const foundationsTile = document.createElement('div');
            foundationsTile.style.cssText = `
                background-color: white;
                padding: 15px;
                border-radius: 5px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                position: relative;
                border-left: 4px solid #1c87c9;
            `;
            foundationsTile.id = 'foundations-tile';
            
            // Generate content for the tile
            let moduleListHtml = '';
            Object.keys(foundationTotals.modules).forEach(moduleId => {
                const moduleInfo = foundationTotals.modules[moduleId];
                
                // Only include modules with cost > 0
                if (moduleInfo.cost > 0) {
                    const formattedCost = window.ConstructionApp.ModuleUtils.formatCurrency(moduleInfo.cost);
                    
                    moduleListHtml += `
                        <div style="display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f0f0f0;">
                            <span>${moduleInfo.name}</span>
                            <span style="margin: 0 10px;">${formattedCost}</span>
                            <button class="btn module-open-btn" style="padding: 2px 8px; font-size: 0.8em;" data-module-id="${moduleId}">View</button>
                        </div>
                    `;
                }
            });
            
            // Complete the tile HTML
            foundationsTile.innerHTML = `
                <h5 style="margin-bottom: 10px; color: #1c87c9;">Foundations</h5>
                <p style="font-size: 20px; margin: 10px 0; color: #4eca8b; font-weight: bold;">${formattedTotal}</p>
                <div style="margin-top: 15px;">
                    ${moduleListHtml}
                </div>
            `;
            
            // Insert at the beginning of module elements
            moduleElements.unshift(foundationsTile);
            
            // Add event listeners to the module open buttons after the tile is added to DOM
            setTimeout(() => {
                const moduleButtons = foundationsTile.querySelectorAll('.module-open-btn');
                moduleButtons.forEach(button => {
                    button.addEventListener('click', function() {
                        const moduleId = this.getAttribute('data-module-id');
                        
                        // Save navigation state
                        sessionStorage.setItem('navigationState', 'fromDashboard');
                        
                        // Save current client to sessionStorage
                        const client = window.ConstructionApp.ClientManager.getCurrentClient();
                        if (client) {
                            sessionStorage.setItem('currentClient', JSON.stringify(client));
                        }
                        
                        // Navigate to the module
                        window.location.href = moduleId + '.html';
                    });
                });
            }, 0);
            
            return moduleElements;
        },
        
        // Filter out individual foundation modules from dashboard tiles
        filterDashboardModules: function(moduleElements) {
            // Skip if no elements
            if (!moduleElements || !Array.isArray(moduleElements)) return moduleElements;
            
            // Filter out individual foundation module tiles
            return moduleElements.filter(element => {
                if (!element.id) return true; // Keep elements without ID
                
                const moduleId = element.id.replace('-tile', '');
                return !this.isFoundationModule(moduleId);
            });
        },
        
        // Update all foundation modules totals in client data
        updateTotals: function(client) {
            if (!client || !client.moduleData) return;
            
            const foundationTotals = this.calculateFoundationTotals(client);
            
            // Update the client's foundationTotals property
            client.foundationTotals = foundationTotals;
            
            // Update the client via the ClientManager
            window.ConstructionApp.ClientManager.setCurrentClient(client);
            
            console.log("[FoundationsDashboard] Updated foundation totals:", foundationTotals.total);
            return foundationTotals;
        },
        
        // Notify that a foundation module was updated
        notifyModuleUpdated: function(moduleId) {
            if (!this.isFoundationModule(moduleId)) return;
            
            console.log("[FoundationsDashboard] Foundation module updated:", moduleId);
            
            // Get current client
            const client = window.ConstructionApp.ClientManager.getCurrentClient();
            if (client) {
                // Update totals
                this.updateTotals(client);
            }
        }
    };
    
    // Export the FoundationsDashboard
    window.ConstructionApp.FoundationsDashboard = FoundationsDashboard;
    
    // Initialize the dashboard automatically
    document.addEventListener('DOMContentLoaded', function() {
        if (window.ConstructionApp.FoundationsDashboard) {
            window.ConstructionApp.FoundationsDashboard.initialize();
        }
    });
})();
