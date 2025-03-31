// dashboard-extension.js - Dashboard enhancements for module integration

// Dashboard Extensions for the Construction Estimator app
(function() {
    // Ensure our namespace exists
    window.ConstructionApp = window.ConstructionApp || {};
    
    // Private data
    let _tileHandlers = [];
    let _moduleFilters = [];
    
    // Dashboard helper object
    const Dashboard = {
        // Register a new tile handler function
        registerTileHandler: function(handlerFn) {
            if (typeof handlerFn === 'function') {
                console.log("[Dashboard] Registered new tile handler");
                _tileHandlers.push(handlerFn);
                return true;
            }
            return false;
        },
        
        // Register a module filter function
        registerModuleFilter: function(filterFn) {
            if (typeof filterFn === 'function') {
                console.log("[Dashboard] Registered new module filter");
                _moduleFilters.push(filterFn);
                return true;
            }
            return false;
        },
        
        // Process module elements through all registered handlers
        processTileHandlers: function(client, moduleElements) {
            if (!client || !moduleElements) return moduleElements;
            
            // Apply all registered tile handlers
            let processedElements = [...moduleElements];
            
            _tileHandlers.forEach(handler => {
                try {
                    processedElements = handler(client, processedElements) || processedElements;
                } catch (error) {
                    console.error("[Dashboard] Error in tile handler:", error);
                }
            });
            
            return processedElements;
        },
        
        // Filter module elements through all registered filters
        applyModuleFilters: function(moduleElements) {
            if (!moduleElements) return moduleElements;
            
            // Apply all registered module filters
            let filteredElements = [...moduleElements];
            
            _moduleFilters.forEach(filter => {
                try {
                    filteredElements = filter(filteredElements) || filteredElements;
                } catch (error) {
                    console.error("[Dashboard] Error in module filter:", error);
                }
            });
            
            return filteredElements;
        },
        
        // Inject into the renderDashboardContent function
        enhanceRenderDashboardContent: function() {
            // Store reference to the original function
            if (window.renderDashboardContent && !window.renderDashboardContent._enhanced) {
                const originalRender = window.renderDashboardContent;
                
                // Replace with enhanced version
                window.renderDashboardContent = function(client) {
                    // If the Foundation dashboard is available, register its filter
                    if (window.ConstructionApp.FoundationsDashboard && 
                        !window._registeredFoundationsFilter) {
                        window.ConstructionApp.Dashboard.registerModuleFilter(
                            window.ConstructionApp.FoundationsDashboard.filterDashboardModules.bind(
                                window.ConstructionApp.FoundationsDashboard
                            )
                        );
                        window._registeredFoundationsFilter = true;
                    }
                    
                    // Call the original function
                    originalRender(client);
                    
                    // After rendering, collect module tiles and apply enhancements
                    setTimeout(() => {
                        const moduleTilesContainer = document.getElementById('module-tiles');
                        if (moduleTilesContainer) {
                            const moduleTiles = Array.from(moduleTilesContainer.children);
                            
                            // Apply handlers to add new tiles
                            const processedTiles = window.ConstructionApp.Dashboard.processTileHandlers(client, moduleTiles);
                            
                            // Apply filters to remove unwanted tiles
                            const filteredTiles = window.ConstructionApp.Dashboard.applyModuleFilters(processedTiles);
                            
                            // Only update DOM if changes were made
                            if (processedTiles.length !== moduleTiles.length || filteredTiles.length !== moduleTiles.length) {
                                // Clear existing tiles
                                moduleTilesContainer.innerHTML = '';
                                
                                // Add processed and filtered tiles
                                filteredTiles.forEach(tile => {
                                    moduleTilesContainer.appendChild(tile);
                                });
                            }
                        }
                    }, 0);
                };
                
                // Mark as enhanced to prevent multiple enhancements
                window.renderDashboardContent._enhanced = true;
                console.log("[Dashboard] Enhanced renderDashboardContent function");
            }
        },
        
        // Intercept module data saves to update foundation totals
        enhanceClientManager: function() {
            // Enhance saveModuleData method to notify foundations dashboard
            if (window.ConstructionApp.ClientManager && 
                window.ConstructionApp.ClientManager.saveModuleData && 
                !window.ConstructionApp.ClientManager.saveModuleData._enhanced) {
                
                const originalSaveModuleData = window.ConstructionApp.ClientManager.saveModuleData;
                
                window.ConstructionApp.ClientManager.saveModuleData = function(moduleId, data, callback) {
                    // Call original method
                    const result = originalSaveModuleData.call(this, moduleId, data, callback);
                    
                    // Notify foundation dashboard if it's a foundation module
                    if (window.ConstructionApp.FoundationsDashboard && 
                        window.ConstructionApp.FoundationsDashboard.notifyModuleUpdated) {
                        setTimeout(() => {
                            window.ConstructionApp.FoundationsDashboard.notifyModuleUpdated(moduleId);
                        }, 0);
                    }
                    
                    return result;
                };
                
                // Mark as enhanced
                window.ConstructionApp.ClientManager.saveModuleData._enhanced = true;
                console.log("[Dashboard] Enhanced ClientManager.saveModuleData");
            }
        },
        
        // Initialize dashboard enhancements
        initialize: function() {
            console.log("[Dashboard] Initializing dashboard enhancements");
            
            // Enhance renderDashboardContent
            this.enhanceRenderDashboardContent();
            
            // Enhance ClientManager
            this.enhanceClientManager();
            
            // Register foundation dashboard module filter
            if (window.ConstructionApp.FoundationsDashboard) {
                this.registerModuleFilter(
                    window.ConstructionApp.FoundationsDashboard.filterDashboardModules.bind(
                        window.ConstructionApp.FoundationsDashboard
                    )
                );
                window._registeredFoundationsFilter = true;
            }
        }
    };
    
    // Export the Dashboard helper
    window.ConstructionApp.Dashboard = Dashboard;
    
    // Initialize immediately if window.renderDashboardContent exists
    if (window.renderDashboardContent) {
        console.log("[Dashboard] Initializing dashboard extensions for existing renderDashboardContent");
        window.ConstructionApp.Dashboard.initialize();
    } else {
        // Otherwise initialize on DOMContentLoaded
        document.addEventListener('DOMContentLoaded', function() {
            // Wait a bit for other scripts to load
            setTimeout(() => {
                if (window.renderDashboardContent && window.ConstructionApp.Dashboard) {
                    window.ConstructionApp.Dashboard.initialize();
                }
            }, 100);
        });
    }
})();
