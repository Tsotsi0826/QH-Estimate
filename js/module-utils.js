// module-utils.js - Enhanced shared module utilities
// Fix: Removed redundant sessionStorage.setItem in returnToDashboard

(function() {
    // Ensure our namespace exists
    window.ConstructionApp = window.ConstructionApp || {};

    // Initialize appData structure if it doesn't exist (basic safety)
     if (!window.ConstructionApp.appData) {
         window.ConstructionApp.appData = { modules: [] };
     }


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
                 // If they confirm, reset the flag before navigating
                 this.resetUnsavedChanges(); // Reset flag as they confirmed leaving unsaved changes
            }


            // Check if we have a current client
            const currentClient = window.ConstructionApp.ClientManager.getCurrentClient();

            // Dynamically get the list of modules that require a client
             // Ensure appData and modules exist before filtering
             const modules = window.ConstructionApp?.appData?.modules ?? [];
             const clientRequiredModules = modules
                .filter(m => m.requiresClient)
                .map(m => m.id);


            // Get module info to check requiresClient flag directly
            const moduleInfo = modules.find(m => m.id === moduleId);
            const requiresClient = moduleInfo ? moduleInfo.requiresClient : false; // Default to false if module info not found

             console.log(`[ModuleUtils] Module: ${moduleId}, Requires Client Flag: ${requiresClient}`);


            if (requiresClient && !currentClient) {
                alert("Please select or create a client first to access this module.");
                return false;
            }

            // Ensure the client is properly saved to sessionStorage *by the ClientManager*
            // We still ensure the ClientManager's current state is reflected in sessionStorage
            // before navigating away from the dashboard.
            if (currentClient) {
                 console.log("[ModuleUtils] Saving/Confirming client in sessionStorage before navigation:", currentClient.name);
                 try {
                    sessionStorage.setItem('currentClient', JSON.stringify(currentClient));
                 } catch (error) {
                     console.error("[ModuleUtils] Error saving client to sessionStorage before navigation:", error);
                     alert("Warning: Could not preserve client session. Please check browser storage limits.");
                     // Decide if navigation should be blocked here - depends on requirements
                     // return false;
                 }
            }


            // Set a flag to indicate we're navigating TO a module FROM the dashboard
            sessionStorage.setItem('navigationState', 'fromDashboard');
            console.log("[ModuleUtils] Set navigation state: fromDashboard");

            // Navigate to the module page
            // Ensure the module ID corresponds to a valid HTML file name
            if (moduleId && typeof moduleId === 'string') {
                 // Reset unsaved changes flag *before* navigating away
                 this.resetUnsavedChanges();
                 window.location.href = moduleId + '.html';
                 return true;
            } else {
                 console.error("[ModuleUtils] Invalid moduleId for navigation:", moduleId);
                 alert("Error: Cannot navigate to the specified module.");
                 return false;
            }
        },


        // Return to dashboard
        returnToDashboard: function() {
            console.log("[ModuleUtils] Returning to dashboard");

            // Check if there are unsaved changes
            if (_hasUnsavedChanges) {
                const confirmNavigation = confirm("You have unsaved changes. Are you sure you want to return to the dashboard?");
                if (!confirmNavigation) {
                    return false; // Stay on the page
                }
                 // If they confirm, reset the flag before navigating
                 this.resetUnsavedChanges(); // Reset flag as they confirmed leaving unsaved changes
            }


            // ** Fix Applied Here **
            // We assume that if changes were made and saved on the module page,
            // ClientManager.saveModuleData already updated sessionStorage correctly.
            // No need to re-save the client object here.

            // Set the navigation state to indicate we're returning FROM a module
            sessionStorage.setItem('navigationState', 'returningToDashboard');
            console.log("[ModuleUtils] Set navigation state: returningToDashboard");

             // Reset unsaved changes flag *before* navigating away
             this.resetUnsavedChanges();


            // Navigate back to the index page
            window.location.href = 'index.html';
            return true;
        },

        // Log out the current client
        logoutClient: function() {
            console.log("[ModuleUtils] Logging out client");

            // Check if there are unsaved changes (relevant if logout is possible from module pages)
            if (_hasUnsavedChanges) {
                const confirmLogout = confirm("You have unsaved changes. Are you sure you want to logout?");
                if (!confirmLogout) {
                    return false;
                }
                 // If they confirm, reset the flag before proceeding
                 this.resetUnsavedChanges();
            }


            // Clear the client using the client manager
            window.ConstructionApp.ClientManager.clearCurrentClient();

            // Set the navigation state to indicate manual logout
            sessionStorage.setItem('navigationState', 'manualLogout');
            console.log("[ModuleUtils] Set navigation state: manualLogout");

            // Reset unsaved changes flag (redundant but safe)
            this.resetUnsavedChanges();

            // Go to dashboard page which will handle the 'manualLogout' state
            window.location.href = 'index.html';
            // Avoid reload here, let index.html handle the state
            // window.location.reload();
            return true;
        },


        // Check if the page was accessed correctly and handle if not
        // Should be called early in the script execution of each module page
        checkModuleAccess: function() {
            const navigationState = sessionStorage.getItem('navigationState');
             // Try to get client directly from session storage first for early check
             let clientFromSession = null;
             try {
                 const storedClientStr = sessionStorage.getItem('currentClient');
                 if (storedClientStr) {
                    clientFromSession = JSON.parse(storedClientStr);
                 }
             } catch(e) {
                 console.error("Error parsing client from session storage on module load:", e);
                 sessionStorage.removeItem('currentClient'); // Clear invalid data
             }

             // Also check ClientManager's state (it should align, but good for debugging)
            const clientFromManager = window.ConstructionApp.ClientManager.getCurrentClient();
             const currentClient = clientFromSession || clientFromManager; // Prefer session data initially

            console.log(`[ModuleUtils] Checking module access. Nav state: ${navigationState}, Client found: ${!!currentClient} (Name: ${currentClient?.name})`);


            // Determine if the current module requires a client
            const pathParts = window.location.pathname.split('/');
            const pageName = pathParts.pop() || pathParts.pop(); // Handle potential trailing slash
            const moduleId = pageName.endsWith('.html') ? pageName.slice(0, -5) : null;

            let requiresClient = false;
            if (moduleId) {
                // Try using appData if available (might load later)
                 const modules = window.ConstructionApp?.appData?.modules ?? [];
                 const moduleInfo = modules.find(m => m.id === moduleId);
                 if (moduleInfo) {
                     requiresClient = moduleInfo.requiresClient;
                     console.log(`[ModuleUtils] Module: ${moduleId}, Requires Client (from appData): ${requiresClient}`);
                 } else {
                    // Fallback check using a hardcoded list if appData isn't ready or module missing
                     // This list should ideally match the one in navigateToModule or be centralized
                     const fallbackClientRequiredModules = [
                        'notes', 'p-and-gs', 'demolish', 'concrete', 'toolhire', 'earthworks',
                        'foundations', 'brickwork', 'surfacebeds', 'plaster', 'steel',
                        'roofing', 'windows', 'ceilings', 'flooring', 'carpentry',
                        'painting', 'plumbing', 'electrical', 'waterproofing', 'fireplaces',
                        'external', 'fees'
                     ];
                     requiresClient = fallbackClientRequiredModules.includes(moduleId);
                     console.warn(`[ModuleUtils] Module: ${moduleId} info not found in appData. Using fallback list. Requires Client: ${requiresClient}`);
                 }
            } else {
                console.warn("[ModuleUtils] Could not determine module ID from pathname:", window.location.pathname);
            }


            // Condition for invalid access:
            // 1. The module requires a client, but no client is loaded.
            // OR
            // 2. The user did not arrive from the dashboard ('fromDashboard' state is missing),
            //    AND it's not the dashboard page itself.
            const isDashboard = window.location.pathname === '/index.html' || window.location.pathname.endsWith('/index.html');
            const arrivedFromDashboard = navigationState === 'fromDashboard';

             if ((requiresClient && !currentClient) || (!arrivedFromDashboard && !isDashboard)) {
                 console.warn("[ModuleUtils] Invalid module access detected. Redirecting to dashboard.");
                 console.warn(`Details: requiresClient=${requiresClient}, currentClient=${!!currentClient}, navigationState=${navigationState}, isDashboard=${isDashboard}`);


                 // Redirect to the dashboard, indicating invalid access
                 sessionStorage.setItem('navigationState', 'invalidAccess');
                 // Ensure client is cleared in session storage if access is invalid
                 sessionStorage.removeItem('currentClient');
                 window.location.href = 'index.html';
                 return false; // Indicate access denied / redirection initiated
            }


            // If access is valid, clear the 'fromDashboard' state so a refresh doesn't keep it
             if (arrivedFromDashboard) {
                 sessionStorage.removeItem('navigationState');
                 console.log("[ModuleUtils] Cleared 'fromDashboard' navigation state.");
             }


            return true; // Indicate access granted
        },


        // Format currency (Rand)
        formatCurrency: function(value) {
            // Ensure value is a number, default to 0 if not
            const numberValue = parseFloat(value);
            const validValue = isNaN(numberValue) ? 0 : numberValue;
            // Format to 2 decimal places with 'R' prefix
            // Use Intl.NumberFormat for better locale handling if needed in the future
            return 'R' + validValue.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,'); // Add thousands separators
        },


        // Calculate module total from an array of items
        calculateModuleTotal: function(items) {
            if (!items || !Array.isArray(items)) {
                 console.warn("[ModuleUtils] calculateModuleTotal called with invalid items:", items);
                 return 0;
            }

            let total = 0;
            items.forEach(item => {
                 // Add the result of calculateItemTotal for each item
                 total += this.calculateItemTotal(item); // Delegate calculation
            });

            return total;
        },

        // Calculate total for a single item based on its structure
        calculateItemTotal: function(item) {
            if (!item || typeof item !== 'object') {
                 // console.warn("[ModuleUtils] calculateItemTotal called with invalid item:", item);
                 return 0; // Return 0 if item is null, undefined, or not an object
            }


            let itemTotal = 0;
            // Case 1: P&G style item ('allow', 'qty', 'rate')
            if (item.hasOwnProperty('allow') && item.hasOwnProperty('qty') && item.hasOwnProperty('rate')) {
                if (item.allow) { // Check the allow flag
                    const qty = parseFloat(item.qty) || 0;
                    const rate = parseFloat(item.rate) || 0;
                    itemTotal = qty * rate;
                }
            }
            // Case 2: Standard item ('quantity', 'rate')
            else if (item.hasOwnProperty('quantity') && item.hasOwnProperty('rate')) {
                const quantity = parseFloat(item.quantity) || 0;
                const rate = parseFloat(item.rate) || 0;
                itemTotal = quantity * rate;
            }
             // Case 3: Simple cost item ('cost') - e.g., sometimes used in concrete summary
             else if (item.hasOwnProperty('cost') && Object.keys(item).length === 1) { // Be specific to avoid conflict
                 itemTotal = parseFloat(item.cost) || 0;
             }
             // Add more cases here if other item structures exist

             // console.log("[ModuleUtils] Item:", item, "Calculated Total:", itemTotal); // Debugging line
            return itemTotal;
        },


        // Show a success message with enhanced styling and positioning
        showSuccessMessage: function(message, duration = 3000) {
            this._showMessage(message || 'Successfully saved!', 'success', duration);
        },

        // Show an error message
        showErrorMessage: function(message, duration = 5000) {
            this._showMessage(message || 'An error occurred', 'error', duration);
        },

        // Internal helper for showing messages
        _showMessage: function(message, type = 'success', duration = 3000) {
             const alertId = `${type}-alert`;
             const styles = {
                 success: {
                     bgColor: '#d4edda', // Bootstrap success green
                     color: '#155724',
                     borderColor: '#c3e6cb'
                 },
                 error: {
                     bgColor: '#f8d7da', // Bootstrap danger red
                     color: '#721c24',
                     borderColor: '#f5c6cb'
                 }
             };
             const style = styles[type] || styles.success; // Default to success style


             let alertElement = document.getElementById(alertId);


             // If not found, create one
             if (!alertElement) {
                 alertElement = document.createElement('div');
                 alertElement.id = alertId;
                 alertElement.style.cssText = `
                     position: fixed;
                     top: 20px;
                     right: 20px;
                     padding: 15px 20px;
                     border: 1px solid ${style.borderColor};
                     border-radius: 4px;
                     box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                     z-index: 1050; /* Ensure visibility above most elements */
                     display: block; /* Start as block to measure */
                     font-weight: 500; /* Medium weight */
                     transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
                     opacity: 0; /* Start fully transparent */
                     transform: translateX(100%); /* Start off-screen */
                     max-width: 90%; /* Prevent excessive width on small screens */
                     box-sizing: border-box; /* Include padding in width */
                 `;
                 document.body.appendChild(alertElement);
             }


             // Apply styles and message
             alertElement.style.backgroundColor = style.bgColor;
             alertElement.style.color = style.color;
             alertElement.style.borderColor = style.borderColor;
             alertElement.textContent = message;


             // Clear any existing timeouts for this specific alert type
             if (alertElement.hideTimeout) clearTimeout(alertElement.hideTimeout);
             if (alertElement.removeTimeout) clearTimeout(alertElement.removeTimeout);


             // Make visible and animate in
             requestAnimationFrame(() => { // Ensure styles are applied before transition starts
                 alertElement.style.opacity = '1';
                 alertElement.style.transform = 'translateX(0)';
             });


             // Hide and then remove after the duration
             alertElement.hideTimeout = setTimeout(() => {
                 alertElement.style.opacity = '0';
                 alertElement.style.transform = 'translateX(100%)'; // Animate out


                 // Remove the element from DOM after transition ends
                 alertElement.removeTimeout = setTimeout(() => {
                      // Check if element still exists before trying to remove
                      if (alertElement && alertElement.parentNode) {
                          alertElement.parentNode.removeChild(alertElement);
                      }
                 }, 350); // Slightly longer than transition duration
             }, duration);
         },


        // Initialize save status element in a module
        initSaveStatus: function(elementId = 'save-status') {
            _saveStatusElement = document.getElementById(elementId);

            if (!_saveStatusElement) {
                _saveStatusElement = document.createElement('div');
                _saveStatusElement.id = elementId;
                _saveStatusElement.style.cssText = `
                    display: inline-block;
                    padding: 5px 10px;
                    margin-left: 10px;
                    font-size: 0.9em;
                    font-style: italic;
                    vertical-align: middle;
                    transition: color 0.3s ease; /* Smooth color changes */
                `;

                const saveBtn = document.getElementById('save-btn') || document.querySelector('.btn-save') || document.querySelector('button[type="submit"]');
                const controlsContainer = document.querySelector('.module-controls') || document.querySelector('.modal-footer');

                if (saveBtn && saveBtn.parentNode) {
                    saveBtn.parentNode.insertBefore(_saveStatusElement, saveBtn.nextSibling);
                } else if (controlsContainer) {
                    controlsContainer.appendChild(_saveStatusElement);
                     console.warn(`[ModuleUtils] Save button not found. Appending save status to: ${controlsContainer.tagName}`);
                } else {
                     document.body.appendChild(_saveStatusElement); // Last resort
                     console.warn("[ModuleUtils] No suitable container found. Appending save status to body.");
                }
            }
            return _saveStatusElement;
        },

        // Update save status indicator
        updateSaveStatus: function(status, message) {
            if (!_saveStatusElement) {
                this.initSaveStatus();
                 if (!_saveStatusElement) {
                     console.error("Failed to initialize save status element.");
                     return;
                 }
            }

            if (_saveStatusElement.clearStatusTimeout) {
                clearTimeout(_saveStatusElement.clearStatusTimeout);
                _saveStatusElement.clearStatusTimeout = null;
            }

            switch (status) {
                case 'saving':
                    _saveStatusElement.textContent = 'Saving...';
                    _saveStatusElement.style.color = '#f39c12'; // Orange
                    _hasUnsavedChanges = true;
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
                    _hasUnsavedChanges = true; // Save failed, still unsaved
                    break;
                case 'unsaved':
                     // Only show "Unsaved" if not currently saving or showing an error
                     if (!_saveStatusElement.textContent || !['Saving...', 'Error saving'].includes(_saveStatusElement.textContent)) {
                         _saveStatusElement.textContent = 'Unsaved changes';
                         _saveStatusElement.style.color = '#f39c12'; // Orange
                     }
                    _hasUnsavedChanges = true;
                    break;
                case 'clear':
                    _saveStatusElement.textContent = '';
                    _hasUnsavedChanges = false; // Assume state is clean
                    break;
                default:
                    _saveStatusElement.textContent = message || '';
                    // Decide on default color or leave as is
            }
        },

        // Mark that there are unsaved changes
        markUnsavedChanges: function() {
             // Avoid marking as unsaved if currently saving or showing error, but set flag
            _hasUnsavedChanges = true;
            if (!_saveStatusElement || !['Saving...', 'Error saving'].includes(_saveStatusElement?.textContent)) {
                this.updateSaveStatus('unsaved');
            }
        },

        // Check if there are unsaved changes
        hasUnsavedChanges: function() {
            return _hasUnsavedChanges;
        },

        // Reset unsaved changes flag and clear status message
        resetUnsavedChanges: function() {
             this.updateSaveStatus('clear'); // Clears message and sets flag to false
        },

        // Set up auto-save for a module
        setupAutoSave: function(saveFunction, interval = 2 * 60 * 1000) { // Default: 2 minutes
            if (typeof saveFunction !== 'function') {
                 console.error("[ModuleUtils] setupAutoSave requires a valid save function.");
                 return () => {}; // Return a no-op cancel function
             }

            let autoSaveTimerId = null;

            const performAutoSave = () => {
                const activeElement = document.activeElement;
                const isInputActive = activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName);

                 // Also check if currently showing saving/error status
                 const isSavingOrError = _saveStatusElement && ['Saving...', 'Error saving'].includes(_saveStatusElement.textContent);


                 if (_hasUnsavedChanges && !isInputActive && !isSavingOrError) {
                    console.log("[ModuleUtils] Auto-saving changes...");
                    this.updateSaveStatus('saving');
                    try {
                        Promise.resolve(saveFunction(true)) // Wrap in promise for consistency
                            .then(success => {
                                if (success === false) { // Check explicit false return for failure
                                     console.warn("[ModuleUtils] Auto-save function returned false.");
                                     this.updateSaveStatus('error', 'Auto-save failed');
                                 }
                                 // Assume saveFunction calls updateSaveStatus('saved') on success
                            })
                            .catch(error => {
                                console.error("[ModuleUtils] Error during auto-save promise:", error);
                                this.updateSaveStatus('error', 'Auto-save error');
                            });
                    } catch (error) {
                        console.error("[ModuleUtils] Error calling auto-save function:", error);
                        this.updateSaveStatus('error', 'Auto-save failed');
                    }
                }
            };

            // Clear any existing timer stored globally/scoped
             const timerKey = 'constructionAppAutoSaveTimer'; // Use a consistent key
             if (window[timerKey]) {
                 clearInterval(window[timerKey]);
                 console.log("[ModuleUtils] Cleared previous auto-save timer.");
             }


            console.log("[ModuleUtils] Setting up auto-save with interval", interval, "ms");
            autoSaveTimerId = setInterval(performAutoSave, interval);
            window[timerKey] = autoSaveTimerId; // Store the new timer ID


            // Return a function to cancel this specific auto-save timer
            return function cancelAutoSave() {
                if (window[timerKey] === autoSaveTimerId) { // Only clear if it's the timer we set up
                    clearInterval(window[timerKey]);
                    window[timerKey] = null;
                    console.log("[ModuleUtils] Auto-save cancelled");
                }
            };
        },

        // Common available units list
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
            // Sort units alphabetically for better usability
             const sortedUnits = [...this.commonUnits].sort((a, b) => a.localeCompare(b));

            let options = sortedUnits.map(unit =>
                `<option value="${unit}" ${unit === selectedUnit ? 'selected' : ''}>${unit}</option>`
            ).join('');

            // Add option for custom unit if selectedUnit is not in commonUnits
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

             // Debounce the marking function slightly to avoid excessive updates
             let debounceTimer;
             const markChanges = () => {
                 clearTimeout(debounceTimer);
                 debounceTimer = setTimeout(() => {
                     this.markUnsavedChanges();
                 }, 100); // 100ms debounce
             };


            containers.forEach(container => {
                if (trackedContainers.has(container)) return;

                // Use event delegation where possible for better performance,
                // but direct listeners are simpler here.
                 container.addEventListener('input', markChanges, { passive: true }); // Use passive where applicable
                 container.addEventListener('change', markChanges, { passive: true }); // For selects, checkboxes

                trackedContainers.add(container);
                 // console.log("[ModuleUtils] Attached change listeners to:", container.id || container.tagName);
            });

            // --- beforeunload listener setup ---
             // Define the handler function separately
             const beforeUnloadHandler = (e) => {
                 if (_hasUnsavedChanges) {
                     e.preventDefault();
                     e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                     return e.returnValue;
                 }
             };

             // Ensure only one listener is attached
             // Store the handler reference on the ModuleUtils object itself
             if (this._beforeUnloadHandler) {
                 window.removeEventListener('beforeunload', this._beforeUnloadHandler);
             }
             this._beforeUnloadHandler = beforeUnloadHandler; // Store the reference
             window.addEventListener('beforeunload', this._beforeUnloadHandler);
             console.log("[ModuleUtils] Attached beforeunload listener.");
        },
        _beforeUnloadHandler: null // Property to store the handler reference

    };

    // Export the ModuleUtils
    window.ConstructionApp.ModuleUtils = ModuleUtils;

})();
