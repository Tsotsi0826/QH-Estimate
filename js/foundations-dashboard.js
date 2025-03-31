/**
 * Foundations Dashboard Module
 * 
 * Integrates the three foundation modules (Excavation, Concrete, Steel)
 * into a single combined display on the dashboard.
 */
const FoundationsDashboard = (function() {
    // Private variables and functions
    const MODULE_IDS = {
        EXCAVATION: 'foundations-excavation',
        CONCRETE: 'foundations-concrete',
        STEEL: 'foundations-steel'
    };

    const MODULE_NAMES = {
        [MODULE_IDS.EXCAVATION]: 'Excavation',
        [MODULE_IDS.CONCRETE]: 'Concrete',
        [MODULE_IDS.STEEL]: 'Steel'
    };

    /**
     * Register the foundation modules to ensure they appear in the sidebar
     */
    function registerFoundationModules() {
        if (!window.appData || !window.appData.modules) {
            console.error("[FoundationsDashboard] appData not available");
            return;
        }

        // Define foundation modules
        const foundationModules = [
            { id: MODULE_IDS.EXCAVATION, name: 'Foundations Excavation', requiresClient: true },
            { id: MODULE_IDS.CONCRETE, name: 'Foundations Concrete', requiresClient: true },
            { id: MODULE_IDS.STEEL, name: 'Foundations Steel', requiresClient: true }
        ];
        
        console.log("[FoundationsDashboard] Registering foundation modules");
        
        // Add foundation modules to known modules
        foundationModules.forEach(foundationModule => {
            // Check if the module is already registered
            const exists = window.appData.modules.some(m => m.id === foundationModule.id);
            
            if (!exists) {
                console.log(`[FoundationsDashboard] Registering module: ${foundationModule.name}`);
                
                // Add the module to appData.modules
                window.appData.modules.push({
                    id: foundationModule.id,
                    name: foundationModule.name,
                    requiresClient: foundationModule.requiresClient,
                    renderTemplate: function(client) {
                        return `
                            <h3>${foundationModule.name}</h3>
                            <p>This module can be accessed from the sidebar.</p>
                        `;
                    },
                    saveData: function() {
                        return {};
                    }
                });
                
                // Add to the sidebar if not already present
                const modulesContainer = document.getElementById('modules-container');
                if (modulesContainer && !modulesContainer.querySelector(`[data-module-id="${foundationModule.id}"]`)) {
                    const moduleElement = document.createElement('div');
                    moduleElement.className = 'module-item';
                    moduleElement.draggable = true;
                    moduleElement.setAttribute('data-module-id', foundationModule.id);
                    moduleElement.setAttribute('data-requires-client', 'true');
                    
                    moduleElement.innerHTML = `
                        <div class="module-drag-handle">≡</div>
                        <div class="module-icon">
                            ...
                            <div class="dropdown-menu">
                                <div class="dropdown-item edit-module">Edit</div>
                                <div class="dropdown-item delete-module">Delete</div>
                            </div>
                        </div>
                        <span>${foundationModule.name}</span>
                    `;
                    
                    modulesContainer.appendChild(moduleElement);
                    
                    // Set up event listeners if the function exists
                    if (typeof window.setupModuleEventListeners === 'function') {
                        window.setupModuleEventListeners(moduleElement);
                    }
                }
            }
        });
    }

    /**
     * Create or update the combined foundations tile on the dashboard
     * @param {Object} client - The client object with module data
     */
    function updateFoundationsTile(client) {
        if (!client || !client.moduleData) {
            console.log("[FoundationsDashboard] No client data available");
            return;
        }
        
        // Get data from the three foundation modules
        const excavationData = client.moduleData[MODULE_IDS.EXCAVATION] || { totals: { totalCost: 0 } };
        const concreteData = client.moduleData[MODULE_IDS.CONCRETE] || { totals: { totalCost: 0 } };
        const steelData = client.moduleData[MODULE_IDS.STEEL] || { totals: { totalCost: 0 } };
        
        // Calculate total cost across all foundation modules
        const excavationCost = excavationData.totals?.totalCost || 0;
        const concreteCost = concreteData.totals?.totalCost || 0;
        const steelCost = steelData.totals?.totalCost || 0;
        const totalFoundationsCost = excavationCost + concreteCost + steelCost;
        
        console.log(`[FoundationsDashboard] Foundations total: ${totalFoundationsCost} (Excavation: ${excavationCost}, Concrete: ${concreteCost}, Steel: ${steelCost})`);
        
        // Find the content element and module tiles container
        const contentElement = document.getElementById('module-content');
        if (!contentElement) {
            console.error("[FoundationsDashboard] Module content element not found");
            return;
        }
        
        // Get the module tiles container
        const tilesContainer = contentElement.querySelector('#module-tiles');
        if (!tilesContainer) {
            console.error("[FoundationsDashboard] Module tiles container not found");
            return;
        }
        
        // Only continue if at least one module has a positive value
        if (totalFoundationsCost <= 0) {
            // Remove the tile if it exists but should no longer be shown
            const existingTile = document.getElementById('foundations-combined-tile');
            if (existingTile) {
                existingTile.remove();
            }
            return;
        }
        
        // Check if foundations tile already exists
        let foundationsTile = document.getElementById('foundations-combined-tile');
        
        // Create a new tile if it doesn't exist
        if (!foundationsTile) {
            foundationsTile = document.createElement('div');
            foundationsTile.id = 'foundations-combined-tile';
            foundationsTile.style.cssText = 'background-color: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: relative; grid-column: 1 / -1;';
            
            // Insert at the beginning of the tiles container
            if (tilesContainer.firstChild) {
                tilesContainer.insertBefore(foundationsTile, tilesContainer.firstChild);
            } else {
                tilesContainer.appendChild(foundationsTile);
            }
        }
        
        // Format the costs
        const formatCurrency = window.ConstructionApp.ModuleUtils.formatCurrency;
        const formattedTotal = formatCurrency(totalFoundationsCost);
        const formattedExcavation = formatCurrency(excavationCost);
        const formattedConcrete = formatCurrency(concreteCost);
        const formattedSteel = formatCurrency(steelCost);
        
        // Update the tile content with breakdown of costs
        foundationsTile.innerHTML = `
            <h4 style="margin-bottom: 10px; color: #1c2639;">Foundations Total</h4>
            <div style="font-size: 24px; margin: 10px 0; color: #4eca8b; font-weight: bold;">${formattedTotal}</div>
            <button class="clear-module-btn" data-module-group="foundations" style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: #dc3545; cursor: pointer; font-size: 16px;" title="Clear all foundation data">×</button>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 15px;">
                <div class="foundation-module-link" style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; cursor: pointer; ${excavationCost <= 0 ? 'opacity: 0.5;' : ''}" data-module="${MODULE_IDS.EXCAVATION}">
                    <div style="font-weight: bold;">Excavation</div>
                    <div style="color: #4eca8b;">${formattedExcavation}</div>
                </div>
                <div class="foundation-module-link" style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; cursor: pointer; ${concreteCost <= 0 ? 'opacity: 0.5;' : ''}" data-module="${MODULE_IDS.CONCRETE}">
                    <div style="font-weight: bold;">Concrete</div>
                    <div style="color: #4eca8b;">${formattedConcrete}</div>
                </div>
                <div class="foundation-module-link" style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; cursor: pointer; ${steelCost <= 0 ? 'opacity: 0.5;' : ''}" data-module="${MODULE_IDS.STEEL}">
                    <div style="font-weight: bold;">Steel</div>
                    <div style="color: #4eca8b;">${formattedSteel}</div>
                </div>
            </div>
        `;
        
        // Add event listeners to the foundation module links
        foundationsTile.querySelectorAll('.foundation-module-link').forEach(link => {
            link.addEventListener('click', function() {
                const moduleId = this.getAttribute('data-module');
                
                // Save navigation state
                sessionStorage.setItem('navigationState', 'fromDashboard');
                
                // Save current client to sessionStorage
                if (client) {
                    sessionStorage.setItem('currentClient', JSON.stringify(client));
                }
                
                // Navigate to the module
                window.location.href = moduleId + '.html';
            });
        });
        
        // Add event listener to the clear button
        const clearBtn = foundationsTile.querySelector('.clear-module-btn[data-module-group="foundations"]');
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                if (confirm('Are you sure you want to clear ALL foundation module data?')) {
                    clearAllFoundationData(client);
                }
            });
        }
    }
    
    /**
     * Clears all foundation module data
     * @param {Object} client - The client object
     */
    function clearAllFoundationData(client) {
        if (!client) return;
        
        // Clear each foundation module
        [MODULE_IDS.EXCAVATION, MODULE_IDS.CONCRETE, MODULE_IDS.STEEL].forEach(moduleId => {
            if (client.moduleData && client.moduleData[moduleId]) {
                // Delete the module data
                delete client.moduleData[moduleId];
                
                // Update via API if available
                if (window.ConstructionApp && window.ConstructionApp.ClientManager) {
                    window.ConstructionApp.ClientManager.saveModuleData(moduleId, null);
                }
            }
        });
        
        // Update client's lastModified timestamp
        client.lastModified = new Date().toISOString();
        
        // Update the client reference
        if (window.ConstructionApp && window.ConstructionApp.ClientManager) {
            window.ConstructionApp.ClientManager.setCurrentClient(client);
        }
        
        // Show success message
        if (window.ConstructionApp && window.ConstructionApp.ModuleUtils) {
            window.ConstructionApp.ModuleUtils.showSuccessMessage('All foundation module data cleared successfully');
        }
        
        // Remove the foundations tile
        const foundationsTile = document.getElementById('foundations-combined-tile');
        if (foundationsTile) {
            foundationsTile.remove();
        }
        
        // Update the dashboard
        if (typeof window.updateDashboard === 'function') {
            window.updateDashboard(client);
        }
        
        // Update project total
        if (typeof window.updateTotalProjectCost === 'function') {
            window.updateTotalProjectCost();
        }
    }
    
    /**
     * Modify the dashboard's renderDashboardContent function to exclude foundation modules
     * This is done by wrapping the original function
     */
    function wrapRenderDashboardContent() {
        // If the function doesn't exist, we can't wrap it
        if (typeof window.renderDashboardContent !== 'function') {
            console.error('[FoundationsDashboard] renderDashboardContent function not found');
            return;
        }
        
        // Store the original function
        const originalRenderDashboard = window.renderDashboardContent;
        
        // Replace with wrapped version
        window.renderDashboardContent = function(client) {
            // Get all module IDs before filtering
            const allModuleIds = [];
            if (client && client.moduleData) {
                Object.keys(client.moduleData).forEach(id => allModuleIds.push(id));
            }
            
            // Create an object that will track which modules to filter
            if (!client._moduleFilters) {
                client._moduleFilters = {};
            }
            
            // Mark foundation modules to be filtered out
            [MODULE_IDS.EXCAVATION, MODULE_IDS.CONCRETE, MODULE_IDS.STEEL].forEach(id => {
                client._moduleFilters[id] = true;
            });
            
            // Call the original function
            originalRenderDashboard(client);
            
            // Our updateFoundationsTile function will be called from initialize
        };
    }
    
    /**
     * Handle when a module is cleared from the dashboard
     */
    function wrapClearModuleData() {
        // If the function doesn't exist, we can't wrap it
        if (typeof window.clearModuleData !== 'function') {
            console.error('[FoundationsDashboard] clearModuleData function not found');
            return;
        }
        
        // Store the original function
        const originalClearModule = window.clearModuleData;
        
        // Replace with wrapped version
        window.clearModuleData = function(moduleId) {
            // Call the original clear function
            originalClearModule(moduleId);
            
            // Check if this was a foundation module
            if ([MODULE_IDS.EXCAVATION, MODULE_IDS.CONCRETE, MODULE_IDS.STEEL].includes(moduleId)) {
                // Get the current client
                const client = window.ConstructionApp.ClientManager.getCurrentClient();
                if (client) {
                    // Update the foundations tile
                    updateFoundationsTile(client);
                }
            }
        };
    }

    // Public API
    return {
        /**
         * Initialize the foundations dashboard integration
         * @param {Object} client - The client object with module data
         */
        initialize: function(client) {
            console.log('[FoundationsDashboard] Initializing foundations dashboard integration');
            
            // Register foundation modules
            registerFoundationModules();
            
            // Wrap the dashboard rendering function to filter foundation modules
            wrapRenderDashboardContent();
            
            // Wrap the clear module function to handle foundation modules
            wrapClearModuleData();
            
            // Create or update the foundations tile if applicable
            updateFoundationsTile(client);
            
            console.log('[FoundationsDashboard] Initialization complete');
        }
    };
})();

// Set up event handler for when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait for client to be loaded then initialize
    // This runs even if we navigate directly to this page
    const client = window.ConstructionApp?.ClientManager?.getCurrentClient();
    if (client) {
        FoundationsDashboard.initialize(client);
    }
    
    console.log('[FoundationsDashboard] Ready');
});
