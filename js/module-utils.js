// module-utils.js - Shared module utilities

// Module utilities for the Construction Estimator app
(function() {
    // Ensure our namespace exists
    window.ConstructionApp = window.ConstructionApp || {};
    
    // Module utilities object
    const ModuleUtils = {
        // Navigate to a specific module
        navigateToModule: function(moduleId) {
            // Check if we have a current client
            const currentClient = window.ConstructionApp.ClientManager.getCurrentClient();
            
            // List of modules that require a client
            const clientRequiredModules = [
                'notes', 'p-and-gs', 'demolish', 'concrete', 'toolhire', 'earthworks',
                'foundations', 'brickwork', 'surfacebeds', 'plaster', 'steel',
                'roofing', 'windows', 'ceilings', 'flooring', 'carpentry',
                'painting', 'plumbing', 'electrical', 'waterproofing', 'fireplaces',
                'external', 'fees'
            ];
            
            // Check if this module requires a client
            const requiresClient = clientRequiredModules.includes(moduleId);
            
            if (requiresClient && !currentClient) {
                alert("Please select or create a client first to access this module.");
                return false;
            }
            
            // Set a flag to indicate we're navigating to a module
            localStorage.setItem('navigationState', 'fromModulePage');
            
            // Navigate to the module page
            window.location.href = moduleId + '.html';
            return true;
        },
        
        // Return to dashboard
        returnToDashboard: function() {
            // Set the navigation state to indicate we're returning from a module
            localStorage.setItem('navigationState', 'returningToDashboard');
            
            // Ensure the current client is properly stored
            const currentClient = window.ConstructionApp.ClientManager.getCurrentClient();
            if (currentClient) {
                localStorage.setItem('currentClient', JSON.stringify(currentClient));
            }
            
            // Navigate back to the index page
            window.location.href = 'index.html';
        },
        
        // Log out the current client
        logoutClient: function() {
            // Clear the client
            window.ConstructionApp.ClientManager.clearCurrentClient();
            
            // Set the navigation state to indicate manual logout
            localStorage.setItem('navigationState', 'manualLogout');
            
            // Refresh the page to update the UI
            window.location.reload();
        },
        
        // Format currency (Rand)
        formatCurrency: function(value) {
            return 'R' + (parseFloat(value) || 0).toFixed(2);
        },
        
        // Calculate module total
        calculateModuleTotal: function(items) {
            if (!items || !Array.isArray(items)) return 0;
            
            let total = 0;
            items.forEach(item => {
                // Use allow flag if present (P&Gs style)
                if (item.hasOwnProperty('allow')) {
                    if (item.allow) {
                        total += (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
                    }
                } 
                // Otherwise use quantity and rate directly
                else if (item.hasOwnProperty('quantity') && item.hasOwnProperty('rate')) {
                    total += (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
                }
            });
            
            return total;
        },
        
        // Update a specific item's total calculation
        calculateItemTotal: function(item) {
            if (!item) return 0;
            
            if (item.hasOwnProperty('allow')) {
                return item.allow ? (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0) : 0;
            } else if (item.hasOwnProperty('quantity')) {
                return (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
            }
            
            return 0;
        },
        
        // Show a success message
        showSuccessMessage: function(message, duration = 3000) {
            // Look for an element with id 'success-alert' or 'success-message'
            let alertElement = document.getElementById('success-alert') || 
                              document.getElementById('success-message');
            
            // If not found, create one
            if (!alertElement) {
                alertElement = document.createElement('div');
                alertElement.id = 'success-alert';
                alertElement.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background-color: #d4edda;
                    color: #155724;
                    padding: 15px;
                    border-radius: 4px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    z-index: 9999;
                    display: none;
                `;
                document.body.appendChild(alertElement);
            }
            
            // Set the message and show
            alertElement.textContent = message || 'Successfully saved!';
            alertElement.style.display = 'block';
            
            // Hide after the specified duration
            setTimeout(() => {
                alertElement.style.display = 'none';
            }, duration);
        },
        
        // Common available units
        commonUnits: [
            'Weeks', 
            'Months', 
            'Days', 
            'm', 
            'm²', 
            'm³', 
            'kg', 
            'ton', 
            'each', 
            '1', 
            'sum'
        ],
        
        // Get HTML for a unit selection dropdown
        getUnitSelectHtml: function(selectedUnit) {
            let options = '';
            this.commonUnits.forEach(unit => {
                options += `<option value="${unit}" ${unit === selectedUnit ? 'selected' : ''}>${unit}</option>`;
            });
            return options;
        }
    };
    
    // Export the ModuleUtils
    window.ConstructionApp.ModuleUtils = ModuleUtils;
})();
