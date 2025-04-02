// module-utils.js - Enhanced shared module utilities
// Minimal Fix: Removed redundant sessionStorage.setItem in returnToDashboard

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
                // If confirmed, reset flag
                this.resetUnsavedChanges();
            }

            // Check if we have a current client
            const currentClient = window.ConstructionApp.ClientManager.getCurrentClient();

            // List of modules that require a client (Consider making this dynamic if possible)
            const clientRequiredModules = [
                'notes', 'p-and-gs', 'demolish', 'concrete', 'toolhire', 'earthworks',
                'foundations', 'brickwork', 'surfacebeds', 'plaster', 'steel',
                'roofing', 'windows', 'ceilings', 'flooring', 'carpentry',
                'painting', 'plumbing', 'electrical', 'waterproofing', 'fireplaces',
                'external', 'fees'
            ];

            // Check if this module requires a client
            // Attempt to get definitive requiresClient flag from loaded module data first
            const moduleInfo = window.ConstructionApp?.appData?.modules?.find(m => m.id === moduleId);
            const requiresClient = moduleInfo ? moduleInfo.requiresClient : clientRequiredModules.includes(moduleId); // Fallback to list

            if (requiresClient && !currentClient) {
                alert("Please select or create a client first to access this module.");
                return false;
            }

            // Ensure the client is properly saved to sessionStorage before navigating away
            // This ensures the state is captured even if no save happened on the dashboard itself.
            if (currentClient) {
                console.log("[ModuleUtils] Ensuring current client is in sessionStorage before navigation:", currentClient.name);
                 try {
                    sessionStorage.setItem('currentClient', JSON.stringify(currentClient));
                 } catch (error) {
                     console.error("[ModuleUtils] Error saving client to sessionStorage before navigation:", error);
                     // Optionally alert the user or prevent navigation
                 }
            }

            // Set a flag to indicate we're navigating to a module
            sessionStorage.setItem('navigationState', 'fromDashboard');
            console.log("[ModuleUtils] Set navigation state: fromDashboard");

            // Reset unsaved changes flag before navigating
            this.resetUnsavedChanges();

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
                 // If confirmed, reset flag
                 this.resetUnsavedChanges();
            }

            // Ensure the current client is properly stored
            // const currentClient = window.ConstructionApp.ClientManager.getCurrentClient(); // No longer needed here
            // if (currentClient) {
            //     console.log("[ModuleUtils] Saving client before return:", currentClient.name);
            //     // *** THE FOLLOWING LINE IS THE ONLY CHANGE - IT HAS BEEN REMOVED ***
            //     // sessionStorage.setItem('currentClient', JSON.stringify(currentClient));
            // }

            // Set the navigation state to indicate we're returning from a module
            sessionStorage.setItem('navigationState', 'returningToDashboard');
            console.log("[ModuleUtils] Set navigation state: returningToDashboard");

            // Reset unsaved changes flag before navigating
            this.resetUnsavedChanges();

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
                 // If confirmed, reset flag
                 this.resetUnsavedChanges();
            }

            // Clear the client using the client manager
            window.ConstructionApp.ClientManager.clearCurrentClient();

            // Set the navigation state to indicate manual logout
            sessionStorage.setItem('navigationState', 'manualLogout');
            console.log("[ModuleUtils] Set navigation state: manualLogout");

            // Reset unsaved changes flag (safe redundancy)
            this.resetUnsavedChanges();

            // Navigate to index page, which will handle the state
            window.location.href = 'index.html';
            // window.location.reload(); // Avoid reload, let index handle state
            return true;
        },

        // Check if the page was accessed correctly and handle if not
        checkModuleAccess: function() {
            const navigationState = sessionStorage.getItem('navigationState');
            const currentClient = window.ConstructionApp.ClientManager.getCurrentClient(); // Get client state

            console.log("[ModuleUtils] Checking module access. Nav state:", navigationState, "Client:", currentClient?.name);

             // Determine module ID from URL
             const pathParts = window.location.pathname.split('/');
             const pageName = pathParts.pop() || pathParts.pop(); // Handle potential trailing slash
             const moduleId = pageName.endsWith('.html') ? pageName.slice(0, -5) : null;


             // Determine if the module requires a client
             let requiresClient = false;
             if (moduleId) {
                 const moduleInfo = window.ConstructionApp?.appData?.modules?.find(m => m.id === moduleId);
                 if (moduleInfo) {
                     requiresClient = moduleInfo.requiresClient;
                 } else {
                     // Fallback if appData isn't loaded or module missing
                     const clientRequiredModules = [ /* ... list from navigateToModule ... */ ];
                     requiresClient = clientRequiredModules.includes(moduleId);
                     console.warn(`[ModuleUtils] Module info for ${moduleId} not found, using fallback list.`);
                 }
             }


            // If this module requires a client but none is selected, OR
            // if accessed directly without navigation state 'fromDashboard' (and not index.html itself)
             const isDashboard = window.location.pathname.endsWith('/index.html') || window.location.pathname === '/';
             if ((requiresClient && !currentClient) || (navigationState !== 'fromDashboard' && !isDashboard)) {
                 console.warn("[ModuleUtils] Invalid module access, redirecting to dashboard.");
                 console.warn(`Details: requiresClient=${requiresClient}, currentClient=${!!currentClient}, navigationState=${navigationState}, isDashboard=${isDashboard}`);
                 // Redirect to the dashboard
                 sessionStorage.setItem('navigationState', 'invalidAccess');
                 sessionStorage.removeItem('currentClient'); // Ensure client is cleared on invalid access
                 window.location.href = 'index.html';
                 return false; // Indicate redirection
             }


             // If access is valid and we arrived from dashboard, clear the state
             if (navigationState === 'fromDashboard') {
                 sessionStorage.removeItem('navigationState');
                 console.log("[ModuleUtils] Cleared 'fromDashboard' navigation state.");
             }


            return true; // Indicate access granted
        },

        // Format currency (Rand)
        formatCurrency: function(value) {
             const numberValue = parseFloat(value);
             const validValue = isNaN(numberValue) ? 0 : numberValue;
             // Add thousands separators
             return 'R' + validValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        },

        // Calculate module total
        calculateModuleTotal: function(items) {
            if (!items || !Array.isArray(items)) return 0;

            let total = 0;
            items.forEach(item => {
                 // Delegate to calculateItemTotal
                 total += this.calculateItemTotal(item);
            });

            return total;
        },

        // Update a specific item's total calculation
        calculateItemTotal: function(item) {
            if (!item || typeof item !== 'object') return 0; // Basic validation


            // Use parseFloat consistently and default to 0
            const qty = parseFloat(item.qty) || 0;
            const rate = parseFloat(item.rate) || 0;
            const quantity = parseFloat(item.quantity) || 0;
            const cost = parseFloat(item.cost) || 0;


            if (item.hasOwnProperty('allow')) {
                // P&G style: check 'allow' flag
                return item.allow ? (qty * rate) : 0;
            } else if (item.hasOwnProperty('quantity') && item.hasOwnProperty('rate')) {
                 // Standard quantity * rate
                 return quantity * rate;
             } else if (item.hasOwnProperty('cost') && Object.keys(item).length === 1) {
                 // Simple cost item
                 return cost;
             }
            // Add other calculation logic if necessary

            return 0; // Default if structure doesn't match known patterns
        },


        // Show a success message (using internal helper)
        showSuccessMessage: function(message, duration = 3000) {
             this._showMessage(message || 'Successfully saved!', 'success', duration);
        },


        // Show an error message (using internal helper)
        showErrorMessage: function(message, duration = 5000) {
             this._showMessage(message || 'An error occurred', 'error', duration);
        },


        // Internal helper for showing messages (prevents duplicate elements)
         _showMessage: function(message, type = 'success', duration = 3000) {
             const alertId = `${type}-alert-message`; // Unique ID per type
             let alertElement = document.getElementById(alertId);


             const styles = {
                 success: { bgColor: '#d4edda', color: '#155724', borderColor: '#c3e6cb' },
                 error: { bgColor: '#f8d7da', color: '#721c24', borderColor: '#f5c6cb' }
             };
             const style = styles[type] || styles.success;


             if (!alertElement) {
                 alertElement = document.createElement('div');
                 alertElement.id = alertId;
                 alertElement.style.cssText = `
                     position: fixed; top: 20px; right: 20px; padding: 15px 20px;
                     border: 1px solid ${style.borderColor}; border-radius: 4px;
                     box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1050;
                     font-weight: 500; transition: opacity 0.3s ease, transform 0.3s ease;
                     opacity: 0; transform: translateX(20px); /* Start hidden and slightly off-screen */
                     max-width: 90%; box-sizing: border-box;
                 `;
                 document.body.appendChild(alertElement);
             }


             // Apply styles and message
             alertElement.style.backgroundColor = style.bgColor;
             alertElement.style.color = style.color;
             alertElement.style.borderColor = style.borderColor;
             alertElement.textContent = message;


             // Clear existing timeouts for this specific element
             if (alertElement.hideTimeout) clearTimeout(alertElement.hideTimeout);
             if (alertElement.removeTimeout) clearTimeout(alertElement.removeTimeout);


             // Make visible and animate in
             requestAnimationFrame(() => { // Use rAF for smoother animation start
                 alertElement.style.opacity = '1';
                 alertElement.style.transform = 'translateX(0)';
             });


             // Hide and then remove after the duration
             alertElement.hideTimeout = setTimeout(() => {
                 alertElement.style.opacity = '0';
                 alertElement.style.transform = 'translateX(20px)'; // Animate out


                 alertElement.removeTimeout = setTimeout(() => {
                     if (alertElement && alertElement.parentNode) {
                         alertElement.parentNode.removeChild(alertElement);
                     }
                 }, 350); // Allow fade out time
             }, duration);
         },


        // Initialize save status element in a module
        initSaveStatus: function(elementId = 'save-status') {
            _saveStatusElement = document.getElementById(elementId);

            if (!_saveStatusElement) {
                _saveStatusElement = document.createElement('div');
                _saveStatusElement.id = elementId;
                _saveStatusElement.style.cssText = `
                    display: inline-block; padding: 5px 10px; margin-left: 10px;
                    font-size: 0.9em; font-style: italic; vertical-align: middle;
                    transition: color 0.3s ease;
                `;

                 // Try to find common save buttons or controls containers
                 const saveBtn = document.getElementById('save-btn') || document.querySelector('.btn-save');
                 const controlsContainer = document.querySelector('.module-controls') || document.querySelector('.modal-footer');


                 if (saveBtn?.parentNode) {
                     saveBtn.parentNode.insertBefore(_saveStatusElement, saveBtn.nextSibling);
                 } else if (controlsContainer) {
                     controlsContainer.appendChild(_saveStatusElement);
                 } else {
                     document.body.appendChild(_saveStatusElement); // Fallback
                 }
            }
            return _saveStatusElement;
        },

        // Update save status indicator
        updateSaveStatus: function(status, message) {
            if (!_saveStatusElement) {
                this.initSaveStatus();
                 if (!_saveStatusElement) return; // Exit if still couldn't create it
            }

            // Clear previous timeout if exists
             if (_saveStatusElement.clearStatusTimeout) {
                 clearTimeout(_saveStatusElement.clearStatusTimeout);
                 _saveStatusElement.clearStatusTimeout = null;
             }


            switch (status) {
                case 'saving':
                    _saveStatusElement.textContent = 'Saving...';
                    _saveStatusElement.style.color = '#f39c12'; // Orange
                    _hasUnsavedChanges = true; // Still unsaved until confirmed
                    break;
                case 'saved':
                    _saveStatusElement.textContent = message || 'Saved';
                    _saveStatusElement.style.color = '#2ecc71'; // Green
                    _hasUnsavedChanges = false;

                     _saveStatusElement.clearStatusTimeout = setTimeout(() => {
                         if (_saveStatusElement && _saveStatusElement.textContent === (message || 'Saved')) {
                            _saveStatusElement.textContent = '';
                        }
                    }, 3000);
                    break;
                case 'error':
                    _saveStatusElement.textContent = message || 'Error saving';
                    _saveStatusElement.style.color = '#e74c3c'; // Red
                    _hasUnsavedChanges = true; // Save failed
                    break;
                case 'unsaved':
                    // Only show if not already saving or error
                     if (!_saveStatusElement.textContent || !['Saving...', 'Error saving'].includes(_saveStatusElement.textContent)) {
                         _saveStatusElement.textContent = 'Unsaved changes';
                         _saveStatusElement.style.color = '#f39c12'; // Orange
                     }
                    _hasUnsavedChanges = true;
                    break;
                 case 'clear': // Explicitly clear status
                     _saveStatusElement.textContent = '';
                     _hasUnsavedChanges = false; // Assume state is clean
                     break;
                default:
                    _saveStatusElement.textContent = message || '';
            }
        },

        // Mark that there are unsaved changes
        markUnsavedChanges: function() {
            _hasUnsavedChanges = true;
             // Update status only if not saving/error
             if (!_saveStatusElement || !['Saving...', 'Error saving'].includes(_saveStatusElement?.textContent)) {
                 this.updateSaveStatus('unsaved');
             }
        },

        // Check if there are unsaved changes
        hasUnsavedChanges: function() {
            return _hasUnsavedChanges;
        },

        // Reset unsaved changes flag and clear status
        resetUnsavedChanges: function() {
             this.updateSaveStatus('clear'); // Use clear status
        },

        // Set up auto-save for a module
        setupAutoSave: function(saveFunction, interval = 2 * 60 * 1000) { // Default: 2 minutes
             if (typeof saveFunction !== 'function') {
                 console.error("[ModuleUtils] Invalid saveFunction provided for auto-save.");
                 return () => {}; // Return no-op cancel function
             }
            let autoSaveTimer = null;

            // Clear any existing timer stored globally/scoped
             const timerKey = 'moduleAutoSaveTimer';
             if (window[timerKey]) {
                 clearInterval(window[timerKey]);
             }

            console.log("[ModuleUtils] Setting up auto-save with interval", interval, "ms");

            autoSaveTimer = setInterval(() => {
                const activeElement = document.activeElement;
                const isInputActive = activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName);
                 const isSavingOrError = _saveStatusElement && ['Saving...', 'Error saving'].includes(_saveStatusElement.textContent);


                 if (_hasUnsavedChanges && !isInputActive && !isSavingOrError) {
                    console.log("[ModuleUtils] Auto-saving changes...");
                    this.updateSaveStatus('saving');
                    try {
                        // Use Promise.resolve to handle sync/async save functions
                        Promise.resolve(saveFunction(true)) // Pass true for auto-save context
                            .catch(error => { // Catch errors from the save function promise
                                console.error("[ModuleUtils] Error during auto-save execution:", error);
                                this.updateSaveStatus('error', 'Auto-save failed');
                            });
                    } catch (error) { // Catch synchronous errors in saveFunction call itself
                        console.error("[ModuleUtils] Synchronous error calling auto-save function:", error);
                        this.updateSaveStatus('error', 'Auto-save failed');
                    }
                }
            }, interval);

             window[timerKey] = autoSaveTimer; // Store timer ID


            // Return a function to cancel this auto-save
            return function cancelAutoSave() {
                if (window[timerKey] === autoSaveTimer) { // Check if it's the correct timer
                    clearInterval(window[timerKey]);
                    window[timerKey] = null;
                    console.log("[ModuleUtils] Auto-save cancelled");
                }
            };
        },

        // Common available units
        commonUnits: [
            'Weeks', 'Months', 'Days', 'Hours', // Time
            'm', 'm²', 'm³', // Metric dimensions
            'mm', 'cm', // Smaller metric lengths
            'L', // Litres
            'kg', 'ton', // Mass
            'each', 'Item', 'No', // Count/Item based
            '1', // Often used for 'Item' or placeholder
            'Set', // Group of items
            'Sum', 'Prov Sum', 'Allow', // Monetary allowances
            'Visit', 'Trip' // Service/Action based
        ],

        // Get HTML for a unit selection dropdown
        getUnitSelectHtml: function(selectedUnit) {
             const sortedUnits = [...this.commonUnits].sort((a, b) => a.localeCompare(b));
            let options = sortedUnits.map(unit =>
                `<option value="${unit}" ${unit === selectedUnit ? 'selected' : ''}>${unit}</option>`
            ).join('');

            if (selectedUnit && !this.commonUnits.includes(selectedUnit)) {
                options += `<option value="${selectedUnit}" selected>${selectedUnit} (Custom)</option>`;
            }
            return options;
        },

        // Set up module form change tracking
        setupChangeTracking: function(containerSelector = 'form, table, .module-content, .modal-body') {
            const trackedContainers = new Set();
            const containers = document.querySelectorAll(containerSelector);

            if (containers.length === 0) {
                console.warn("[ModuleUtils] No containers found for change tracking with selector:", containerSelector);
                return;
            }

            console.log("[ModuleUtils] Setting up change tracking for containers matching:", containerSelector);

            let debounceTimer;
            const markChanges = () => {
                 clearTimeout(debounceTimer);
                 debounceTimer = setTimeout(() => {
                     this.markUnsavedChanges();
                 }, 150); // Slightly longer debounce
            };

            containers.forEach(container => {
                if (trackedContainers.has(container)) return;

                 // Attach listeners
                 container.addEventListener('input', markChanges, { passive: true });
                 container.addEventListener('change', markChanges, { passive: true });


                trackedContainers.add(container);
            });

            // Define the beforeunload handler
             const beforeUnloadHandler = (e) => {
                 if (_hasUnsavedChanges) {
                     e.preventDefault();
                     e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                     return e.returnValue;
                 }
             };

             // Ensure only one listener is attached
             if (this._beforeUnloadHandler) {
                 window.removeEventListener('beforeunload', this._beforeUnloadHandler);
             }
             this._beforeUnloadHandler = beforeUnloadHandler; // Store the reference
             window.addEventListener('beforeunload', this._beforeUnloadHandler);
             console.log("[ModuleUtils] Attached beforeunload listener.");
        },
        _beforeUnloadHandler: null // Store handler reference

    };

    // Export the ModuleUtils
    window.ConstructionApp.ModuleUtils = ModuleUtils;

})();
```

**Summary of the Change:**

Inside the `returnToDashboard` function, I have removed this line:

```javascript
// sessionStorage.setItem('currentClient', JSON.stringify(currentClient)); // <-- REMOVED THIS LINE
```

**Next Steps:**

1.  **Replace:** Copy the entire code block above and paste it into your `module-utils.js` file, completely replacing the previous content.
2.  **Save:** Save the `module-utils.js` file.
3.  **Clear Cache:** Clear your browser's cache **thoroughly** to ensure the old script isn't loaded.
4.  **Test:** Open your application and repeat the steps that caused the problem: select client -> open module -> save -> return to dashboard.

Please let me know if this version works correctly and keeps the client selected when you return to the dashboard. If it still doesn't work, we'll investigate furth
