// module-utils.js - Enhanced shared module utilities

// Module utilities for the Construction Estimator app
(function() {
    // Ensure our namespace exists
    window.ConstructionApp = window.ConstructionApp || {};
    
    // Track changes state
    let _hasUnsavedChanges = false;
    let _saveStatusElement = null;
    
    // Module utilities object
    const ModuleUtils = {
        // Navigate to a specific module
        navigateToModule: function(moduleId) {
            console.log("[ModuleUtils] Navigating to module:", moduleId);
            
            // Check if there are unsaved changes
            if (_hasUnsavedChanges) {
                const confirmNavigation = confirm("You have unsaved changes. Are you sure you want to navigate away?");
                if (!confirmNavigation) {
                    return false;
                }
            }
            
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
            
            // Ensure the client is properly saved to sessionStorage
            if (currentClient) {
                console.log("[ModuleUtils] Saving current client before navigation:", currentClient.name);
                sessionStorage.setItem('currentClient', JSON.stringify(currentClient));
            }
            
            // Set a flag to indicate we're navigating to a module
            sessionStorage.setItem('navigationState', 'fromDashboard');
            console.log("[ModuleUtils] Set navigation state: fromDashboard");
            
            // Navigate to the module page
            window.location.href = moduleId + '.html';
            return true;
        },
        
        // Return to dashboard
        returnToDashboard: function() {
            console.log("[ModuleUtils] Returning to dashboard");
            
            // Check if there are unsaved changes
            if (_hasUnsavedChanges) {
                const confirmNavigation = confirm("You have unsaved changes. Are you sure you want to return to the dashboard?");
                if (!confirmNavigation) {
                    return false;
                }
            }
            
            // Ensure the current client is properly stored
            const currentClient = window.ConstructionApp.ClientManager.getCurrentClient();
            if (currentClient) {
                console.log("[ModuleUtils] Saving client before return:", currentClient.name);
                sessionStorage.setItem('currentClient', JSON.stringify(currentClient));
            }
            
            // Set the navigation state to indicate we're returning from a module
            sessionStorage.setItem('navigationState', 'returningToDashboard');
            console.log("[ModuleUtils] Set navigation state: returningToDashboard");
            
            // Navigate back to the index page
            window.location.href = 'index.html';
            return true;
        },
        
        // Log out the current client
        logoutClient: function() {
            console.log("[ModuleUtils] Logging out client");
            
            // Check if there are unsaved changes
            if (_hasUnsavedChanges) {
                const confirmLogout = confirm("You have unsaved changes. Are you sure you want to logout?");
                if (!confirmLogout) {
                    return false;
                }
            }
            
            // Clear the client using the client manager
            window.ConstructionApp.ClientManager.clearCurrentClient();
            
            // Set the navigation state to indicate manual logout
            sessionStorage.setItem('navigationState', 'manualLogout');
            console.log("[ModuleUtils] Set navigation state: manualLogout");
            
            // Reset unsaved changes flag
            _hasUnsavedChanges = false;
            
            // Refresh the page to update the UI
            window.location.reload();
            return true;
        },
        
        // Check if the page was accessed correctly and handle if not
        checkModuleAccess: function() {
            const navigationState = sessionStorage.getItem('navigationState');
            const currentClient = window.ConstructionApp.ClientManager.getCurrentClient();
            
            console.log("[ModuleUtils] Checking module access. Nav state:", navigationState, "Client:", currentClient?.name);
            
            // If this module requires a client but none is selected, or accessed directly without navigation
            if ((!currentClient || navigationState !== 'fromDashboard') && window.location.pathname !== '/index.html') {
                console.log("[ModuleUtils] Invalid module access, redirecting to dashboard");
                // Redirect to the dashboard
                sessionStorage.setItem('navigationState', 'invalidAccess');
                window.location.href = 'index.html';
                return false;
            }
            
            return true;
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
        
        // Show a success message with enhanced styling and positioning
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
                    padding: 15px 20px;
                    border-radius: 4px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    z-index: 9999;
                    display: none;
                    font-weight: bold;
                    transition: opacity 0.3s;
                `;
                document.body.appendChild(alertElement);
            }
            
            // Set the message and show
            alertElement.textContent = message || 'Successfully saved!';
            alertElement.style.display = 'block';
            alertElement.style.opacity = '1';
            
            // Hide after the specified duration with fade effect
            setTimeout(() => {
                alertElement.style.opacity = '0';
                setTimeout(() => {
                    alertElement.style.display = 'none';
                }, 300);
            }, duration);
        },
        
        // Show an error message
        showErrorMessage: function(message, duration = 5000) {
            // Look for an element with id 'error-alert' or 'error-message'
            let alertElement = document.getElementById('error-alert') || 
                              document.getElementById('error-message');
            
            // If not found, create one
            if (!alertElement) {
                alertElement = document.createElement('div');
                alertElement.id = 'error-alert';
                alertElement.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background-color: #f8d7da;
                    color: #721c24;
                    padding: 15px 20px;
                    border-radius: 4px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    z-index: 9999;
                    display: none;
                    font-weight: bold;
                    transition: opacity 0.3s;
                `;
                document.body.appendChild(alertElement);
            }
            
            // Set the message and show
            alertElement.textContent = message || 'An error occurred';
            alertElement.style.display = 'block';
            alertElement.style.opacity = '1';
            
            // Hide after the specified duration with fade effect
            setTimeout(() => {
                alertElement.style.opacity = '0';
                setTimeout(() => {
                    alertElement.style.display = 'none';
                }, 300);
            }, duration);
        },
        
        // Initialize save status element in a module
        initSaveStatus: function(elementId = 'save-status') {
            // Find or create the save status element
            _saveStatusElement = document.getElementById(elementId);
            
            if (!_saveStatusElement) {
                // Create it if not found
                _saveStatusElement = document.createElement('div');
                _saveStatusElement.id = elementId;
                _saveStatusElement.style.cssText = `
                    display: inline-block;
                    padding: 5px 10px;
                    margin-left: 10px;
                    font-size: 0.9em;
                `;
                
                // Find a good place to add it (usually next to save button)
                const saveBtn = document.getElementById('save-btn');
                if (saveBtn && saveBtn.parentNode) {
                    saveBtn.parentNode.insertBefore(_saveStatusElement, saveBtn.nextSibling);
                } else {
                    // Fallback - add to body
                    document.body.appendChild(_saveStatusElement);
                }
            }
            
            return _saveStatusElement;
        },
        
        // Update save status indicator
        updateSaveStatus: function(status, message) {
            if (!_saveStatusElement) {
                this.initSaveStatus();
            }
            
            switch (status) {
                case 'saving':
                    _saveStatusElement.textContent = 'Saving...';
                    _saveStatusElement.style.color = '#f39c12'; // Orange
                    break;
                case 'saved':
                    _saveStatusElement.textContent = message || 'Saved';
                    _saveStatusElement.style.color = '#2ecc71'; // Green
                    _hasUnsavedChanges = false;
                    
                    // Clear status after a delay
                    setTimeout(() => {
                        if (_saveStatusElement.textContent === 'Saved') {
                            _saveStatusElement.textContent = '';
                        }
                    }, 3000);
                    break;
                case 'error':
                    _saveStatusElement.textContent = message || 'Error saving';
                    _saveStatusElement.style.color = '#e74c3c'; // Red
                    break;
                case 'unsaved':
                    _saveStatusElement.textContent = 'Unsaved changes';
                    _saveStatusElement.style.color = '#f39c12'; // Orange
                    _hasUnsavedChanges = true;
                    break;
                default:
                    _saveStatusElement.textContent = message || '';
            }
        },
        
        // Mark that there are unsaved changes
        markUnsavedChanges: function() {
            _hasUnsavedChanges = true;
            this.updateSaveStatus('unsaved');
        },
        
        // Check if there are unsaved changes
        hasUnsavedChanges: function() {
            return _hasUnsavedChanges;
        },
        
        // Reset unsaved changes flag
        resetUnsavedChanges: function() {
            _hasUnsavedChanges = false;
            if (_saveStatusElement) {
                _saveStatusElement.textContent = '';
            }
        },
        
        // Set up auto-save for a module
        setupAutoSave: function(saveFunction, interval = 2 * 60 * 1000) { // Default: 2 minutes
            let autoSaveTimer = null;
            
            // Clear any existing timer
            if (autoSaveTimer) {
                clearInterval(autoSaveTimer);
            }
            
            console.log("[ModuleUtils] Setting up auto-save with interval", interval, "ms");
            
            // Set up new timer
            autoSaveTimer = setInterval(() => {
                // Only auto-save if we have unsaved changes and no active inputs
                if (_hasUnsavedChanges && 
                    (!document.activeElement || !document.activeElement.matches('input, textarea, select'))) {
                    console.log("[ModuleUtils] Auto-saving changes");
                    
                    // Call the provided save function
                    if (typeof saveFunction === 'function') {
                        this.updateSaveStatus('saving');
                        
                        try {
                            saveFunction(true); // Pass true to indicate it's an auto-save
                        } catch (error) {
                            console.error("[ModuleUtils] Error during auto-save:", error);
                            this.updateSaveStatus('error', 'Auto-save failed');
                        }
                    }
                }
            }, interval);
            
            // Return a function to cancel the auto-save
            return function cancelAutoSave() {
                if (autoSaveTimer) {
                    clearInterval(autoSaveTimer);
                    autoSaveTimer = null;
                    console.log("[ModuleUtils] Auto-save cancelled");
                }
            };
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
        },
        
        // Set up module form change tracking
        setupChangeTracking: function(containerSelector = 'form, table, .module-content') {
            const containers = document.querySelectorAll(containerSelector);
            
            if (containers.length === 0) {
                console.warn("[ModuleUtils] No containers found for change tracking with selector:", containerSelector);
                return;
            }
            
            console.log("[ModuleUtils] Setting up change tracking for", containers.length, "containers");
            
            // Listen for input events on form elements
            containers.forEach(container => {
                container.addEventListener('input', () => {
                    this.markUnsavedChanges();
                });
                
                container.addEventListener('change', () => {
                    this.markUnsavedChanges();
                });
            });
            
            // Setup warning before page unload if there are unsaved changes
            window.addEventListener('beforeunload', (e) => {
                if (_hasUnsavedChanges) {
                    // This will trigger the browser's "unsaved changes" warning
                    const message = 'You have unsaved changes. Are you sure you want to leave?';
                    e.returnValue = message;
                    return message;
                }
            });
        }
    };
    
    // Export the ModuleUtils
    window.ConstructionApp.ModuleUtils = ModuleUtils;
})();
