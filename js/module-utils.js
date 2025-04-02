// module-utils.js - Enhanced shared module utilities
// Fix: Removed redundant sessionStorage.setItem in returnToDashboard

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

            // List of modules that require a client (ensure this list is accurate/complete)
             const clientRequiredModules = window.ConstructionApp?.appData?.modules
                ?.filter(m => m.requiresClient)
                ?.map(m => m.id)
                ?? [ // Fallback list if appData isn't ready or modules don't exist yet
                    'notes', 'p-and-gs', 'demolish', 'concrete', 'toolhire', 'earthworks',
                    'foundations', 'brickwork', 'surfacebeds', 'plaster', 'steel',
                    'roofing', 'windows', 'ceilings', 'flooring', 'carpentry',
                    'painting', 'plumbing', 'electrical', 'waterproofing', 'fireplaces',
                    'external', 'fees'
                ]; // Consider loading this dynamically if possible

            // Check if this module requires a client
            const moduleInfo = window.ConstructionApp?.appData?.modules?.find(m => m.id === moduleId);
            const requiresClient = moduleInfo ? moduleInfo.requiresClient : clientRequiredModules.includes(moduleId); // Use module definition if available

            if (requiresClient && !currentClient) {
                alert("Please select or create a client first to access this module.");
                return false;
            }

            // Ensure the client is properly saved to sessionStorage *by the ClientManager*
            // No need to explicitly save here, ClientManager handles it.
            if (currentClient) {
                 console.log("[ModuleUtils] Current client confirmed before navigation:", currentClient.name);
                 // Make sure ClientManager has the latest state in sessionStorage
                 // This line ensures the session storage is definitely up-to-date
                 // based on the ClientManager's internal state before navigating.
                 sessionStorage.setItem('currentClient', JSON.stringify(currentClient));
            }


            // Set a flag to indicate we're navigating to a module
            sessionStorage.setItem('navigationState', 'fromDashboard');
            console.log("[ModuleUtils] Set navigation state: fromDashboard");

            // Navigate to the module page
            // Ensure the module ID corresponds to a valid HTML file name
            if (moduleId && typeof moduleId === 'string') {
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
                    return false;
                }
            }

            // **MODIFICATION START**
            // We assume that if changes were made and saved on the module page,
            // ClientManager.saveModuleData already updated sessionStorage.
            // We don't need to re-save the client object here.
            // const currentClient = window.ConstructionApp.ClientManager.getCurrentClient();
            // if (currentClient) {
            //     console.log("[ModuleUtils] Saving client before return:", currentClient.name);
            //     sessionStorage.setItem('currentClient', JSON.stringify(currentClient)); // <-- REMOVED THIS LINE
            // }
            // **MODIFICATION END**

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
            const currentClient = window.ConstructionApp.ClientManager.getCurrentClient(); // Ensures client is loaded from session if needed

            console.log("[ModuleUtils] Checking module access. Nav state:", navigationState, "Client:", currentClient?.name);

            // Determine if the current module requires a client
            const pathParts = window.location.pathname.split('/');
            const pageName = pathParts.pop() || pathParts.pop(); // Handle potential trailing slash
            const moduleId = pageName.endsWith('.html') ? pageName.slice(0, -5) : null;

            let requiresClient = false;
            if (moduleId && window.ConstructionApp?.appData?.modules) {
                 const moduleInfo = window.ConstructionApp.appData.modules.find(m => m.id === moduleId);
                 requiresClient = moduleInfo ? moduleInfo.requiresClient : false; // Default to false if module info not found
                 console.log(`[ModuleUtils] Module: ${moduleId}, Requires Client: ${requiresClient}`);
            } else if (moduleId) {
                // Fallback check if appData isn't ready (less reliable)
                 const fallbackClientRequiredModules = [
                    'notes', 'p-and-gs', 'demolish', 'concrete', 'toolhire', 'earthworks',
                    'foundations', 'brickwork', 'surfacebeds', 'plaster', 'steel',
                    'roofing', 'windows', 'ceilings', 'flooring', 'carpentry',
                    'painting', 'plumbing', 'electrical', 'waterproofing', 'fireplaces',
                    'external', 'fees'
                 ];
                 requiresClient = fallbackClientRequiredModules.includes(moduleId);
                 console.log(`[ModuleUtils] Module: ${moduleId} (using fallback list), Requires Client: ${requiresClient}`);
            }


            // If this page requires a client but none is selected, OR
            // if it was accessed directly (not via 'fromDashboard')
            if ((requiresClient && !currentClient) || (navigationState !== 'fromDashboard' && window.location.pathname !== '/index.html' && !window.location.pathname.endsWith('/index.html'))) {
                 console.warn("[ModuleUtils] Invalid module access detected. Redirecting to dashboard.");
                 console.warn(`Details: requiresClient=${requiresClient}, currentClient=${!!currentClient}, navigationState=${navigationState}, pathname=${window.location.pathname}`);

                 // Redirect to the dashboard
                 sessionStorage.setItem('navigationState', 'invalidAccess');
                 window.location.href = 'index.html';
                 return false; // Indicate access denied / redirection initiated
            }

            // Clear the navigation state after successful access check
            // sessionStorage.removeItem('navigationState'); // Let initApp on dashboard handle this removal

            return true; // Indicate access granted
        },


        // Format currency (Rand)
        formatCurrency: function(value) {
            // Ensure value is a number, default to 0 if not
            const numberValue = parseFloat(value);
            const validValue = isNaN(numberValue) ? 0 : numberValue;
            // Format to 2 decimal places with 'R' prefix
            return 'R' + validValue.toFixed(2);
        },


        // Calculate module total
        calculateModuleTotal: function(items) {
            if (!items || !Array.isArray(items)) return 0;

            let total = 0;
            items.forEach(item => {
                // Use allow flag if present (P&Gs style)
                if (item && item.hasOwnProperty('allow')) {
                    if (item.allow) {
                        total += (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
                    }
                }
                // Otherwise use quantity and rate directly
                else if (item && item.hasOwnProperty('quantity') && item.hasOwnProperty('rate')) {
                    total += (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
                }
                 // Handle simple cost items (like in concrete module)
                 else if (item && item.hasOwnProperty('cost')) {
                    total += (parseFloat(item.cost) || 0);
                 }
            });

            return total;
        },

        // Update a specific item's total calculation
        calculateItemTotal: function(item) {
            if (!item) return 0;

            if (item.hasOwnProperty('allow')) {
                return item.allow ? (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0) : 0;
            } else if (item.hasOwnProperty('quantity') && item.hasOwnProperty('rate')) {
                 // Ensure quantity and rate are treated as numbers
                 const quantity = parseFloat(item.quantity) || 0;
                 const rate = parseFloat(item.rate) || 0;
                 return quantity * rate;
            } else if (item.hasOwnProperty('cost')) {
                 return parseFloat(item.cost) || 0;
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
                    background-color: #d4edda; /* Bootstrap success green */
                    color: #155724; /* Bootstrap success text color */
                    padding: 15px 20px;
                    border: 1px solid #c3e6cb; /* Bootstrap success border */
                    border-radius: 4px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    z-index: 9999;
                    display: none;
                    font-weight: bold;
                    transition: opacity 0.3s ease-in-out;
                    opacity: 0; /* Start hidden for fade-in */
                `;
                document.body.appendChild(alertElement);
            }

            // Set the message and show with fade-in
            alertElement.textContent = message || 'Successfully saved!';
            alertElement.style.display = 'block';
            // Force reflow before changing opacity for transition
            void alertElement.offsetWidth;
            alertElement.style.opacity = '1';


            // Clear any existing timeout for this element
             if (alertElement.hideTimeout) {
                 clearTimeout(alertElement.hideTimeout);
             }
             if (alertElement.removeTimeout) {
                 clearTimeout(alertElement.removeTimeout);
             }


            // Hide after the specified duration with fade effect
             alertElement.hideTimeout = setTimeout(() => {
                alertElement.style.opacity = '0';
                 // Use another timeout to set display:none after fade-out completes
                 alertElement.removeTimeout = setTimeout(() => {
                    alertElement.style.display = 'none';
                }, 300); // Match transition duration
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
                    background-color: #f8d7da; /* Bootstrap danger red */
                    color: #721c24; /* Bootstrap danger text color */
                    padding: 15px 20px;
                    border: 1px solid #f5c6cb; /* Bootstrap danger border */
                    border-radius: 4px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    z-index: 9999;
                    display: none;
                    font-weight: bold;
                    transition: opacity 0.3s ease-in-out;
                    opacity: 0; /* Start hidden for fade-in */
                `;
                document.body.appendChild(alertElement);
            }

            // Set the message and show with fade-in
            alertElement.textContent = message || 'An error occurred';
            alertElement.style.display = 'block';
            // Force reflow before changing opacity for transition
            void alertElement.offsetWidth;
            alertElement.style.opacity = '1';


             // Clear any existing timeout for this element
             if (alertElement.hideTimeout) {
                 clearTimeout(alertElement.hideTimeout);
             }
             if (alertElement.removeTimeout) {
                 clearTimeout(alertElement.removeTimeout);
             }


            // Hide after the specified duration with fade effect
             alertElement.hideTimeout = setTimeout(() => {
                alertElement.style.opacity = '0';
                 // Use another timeout to set display:none after fade-out completes
                 alertElement.removeTimeout = setTimeout(() => {
                    alertElement.style.display = 'none';
                }, 300); // Match transition duration
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
                    font-style: italic; /* Indicate status */
                    vertical-align: middle; /* Align with buttons */
                `;

                // Find a good place to add it (usually next to save button)
                 // Look for common save button IDs or classes
                 const saveBtn = document.getElementById('save-btn') || document.querySelector('.btn-save');

                if (saveBtn && saveBtn.parentNode) {
                     // Insert after the save button
                     saveBtn.parentNode.insertBefore(_saveStatusElement, saveBtn.nextSibling);

                } else {
                    // Fallback - add to a common container or body
                     const container = document.querySelector('.module-controls') || document.querySelector('.modal-footer') || document.body;
                     container.appendChild(_saveStatusElement);
                     console.warn("[ModuleUtils] Could not find save button, appending save status to:", container.tagName);

                }
            }

            return _saveStatusElement;
        },


        // Update save status indicator
        updateSaveStatus: function(status, message) {
            if (!_saveStatusElement) {
                this.initSaveStatus(); // Ensure element exists
                 // If init still fails, log error and exit
                 if (!_saveStatusElement) {
                     console.error("Failed to initialize save status element.");
                     return;
                 }
            }


            // Clear any previous timeout used to clear the status
             if (_saveStatusElement.clearStatusTimeout) {
                 clearTimeout(_saveStatusElement.clearStatusTimeout);
                 _saveStatusElement.clearStatusTimeout = null;
             }


            switch (status) {
                case 'saving':
                    _saveStatusElement.textContent = 'Saving...';
                    _saveStatusElement.style.color = '#f39c12'; // Orange
                    _hasUnsavedChanges = true; // Still technically unsaved until confirmed
                    break;
                case 'saved':
                    _saveStatusElement.textContent = message || 'Saved';
                    _saveStatusElement.style.color = '#2ecc71'; // Green
                    _hasUnsavedChanges = false; // Mark as saved

                    // Clear status after a delay
                     _saveStatusElement.clearStatusTimeout = setTimeout(() => {
                         // Only clear if the status is still 'Saved' (wasn't changed again)
                         if (_saveStatusElement && _saveStatusElement.textContent === (message || 'Saved')) {
                            _saveStatusElement.textContent = '';
                        }
                    }, 3000);
                    break;
                case 'error':
                    _saveStatusElement.textContent = message || 'Error saving';
                    _saveStatusElement.style.color = '#e74c3c'; // Red
                    // Keep _hasUnsavedChanges as true since save failed
                    _hasUnsavedChanges = true;
                    break;
                case 'unsaved':
                    // Only show "Unsaved" if not currently saving or showing an error
                     if (!['Saving...', 'Error saving'].includes(_saveStatusElement.textContent)) {
                         _saveStatusElement.textContent = 'Unsaved changes';
                         _saveStatusElement.style.color = '#f39c12'; // Orange
                     }
                    _hasUnsavedChanges = true;
                    break;
                 case 'clear': // New case to explicitly clear the status
                     _saveStatusElement.textContent = '';
                     _hasUnsavedChanges = false; // Assume clear means saved or loaded state
                     break;
                default:
                    _saveStatusElement.textContent = message || '';
            }
        },


        // Mark that there are unsaved changes
        markUnsavedChanges: function() {
            // Only update status if not already showing error or saving
             if (!_saveStatusElement || !['Saving...', 'Error saving'].includes(_saveStatusElement?.textContent)) {
                this.updateSaveStatus('unsaved');
            } else {
                _hasUnsavedChanges = true; // Still mark internally
            }
        },


        // Check if there are unsaved changes
        hasUnsavedChanges: function() {
            return _hasUnsavedChanges;
        },

        // Reset unsaved changes flag
        resetUnsavedChanges: function() {
             this.updateSaveStatus('clear'); // Use the new clear status
        },


        // Set up auto-save for a module
        setupAutoSave: function(saveFunction, interval = 2 * 60 * 1000) { // Default: 2 minutes
            let autoSaveTimer = null;

            // Function to perform the save
             const performAutoSave = () => {
                 // Only auto-save if we have unsaved changes and no active inputs/selects
                 const activeElement = document.activeElement;
                 const isInputActive = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT');

                 if (_hasUnsavedChanges && !isInputActive) {
                    console.log("[ModuleUtils] Auto-saving changes...");

                    // Call the provided save function
                    if (typeof saveFunction === 'function') {
                        this.updateSaveStatus('saving');

                        try {
                             // Use Promise.resolve to handle both sync and async save functions
                             Promise.resolve(saveFunction(true)) // Pass true for auto-save context
                                 .then(success => {
                                     // The save function itself should call updateSaveStatus('saved'/'error')
                                     if (!success) {
                                         // If saveFunction explicitly returns false, show generic error
                                         this.updateSaveStatus('error', 'Auto-save failed');
                                     }
                                 })
                                 .catch(error => {
                                     console.error("[ModuleUtils] Error during auto-save promise:", error);
                                     this.updateSaveStatus('error', 'Auto-save error');
                                 });
                        } catch (error) {
                            console.error("[ModuleUtils] Error calling auto-save function:", error);
                            this.updateSaveStatus('error', 'Auto-save failed');
                        }
                    } else {
                        console.warn("[ModuleUtils] Auto-save configured without a valid save function.");
                    }
                }
             };


            // Clear any existing timer before setting a new one
            if (window.constructionAppAutoSaveTimer) {
                clearInterval(window.constructionAppAutoSaveTimer);
            }

            console.log("[ModuleUtils] Setting up auto-save with interval", interval, "ms");

            // Set up new timer and store its ID globally or scoped appropriately
             autoSaveTimer = setInterval(performAutoSave, interval);
             window.constructionAppAutoSaveTimer = autoSaveTimer; // Store globally for cancellation


            // Return a function to cancel the auto-save
            return function cancelAutoSave() {
                if (window.constructionAppAutoSaveTimer) {
                    clearInterval(window.constructionAppAutoSaveTimer);
                    window.constructionAppAutoSaveTimer = null;
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
            '1', // Represents 'Item' or 'Lump Sum' often
            'sum', // Often used for 'Provisional Sum' or 'Allow Sum'
            'Prov Sum',
            'Allow'
        ],


        // Get HTML for a unit selection dropdown
        getUnitSelectHtml: function(selectedUnit) {
            let options = '';
            this.commonUnits.forEach(unit => {
                options += `<option value="${unit}" ${unit === selectedUnit ? 'selected' : ''}>${unit}</option>`;
            });
            // Add option for custom unit if selectedUnit is not in commonUnits
             if (selectedUnit && !this.commonUnits.includes(selectedUnit)) {
                 options += `<option value="${selectedUnit}" selected>${selectedUnit} (Custom)</option>`;
             }
            return options;
        },


        // Set up module form change tracking
        setupChangeTracking: function(containerSelector = 'form, table, .module-content, .modal-body') {
            // Use a Set to avoid attaching multiple listeners to the same container
             const trackedContainers = new Set();

             const containers = document.querySelectorAll(containerSelector);

            if (containers.length === 0) {
                console.warn("[ModuleUtils] No containers found for change tracking with selector:", containerSelector);
                return;
            }

            console.log("[ModuleUtils] Setting up change tracking for containers matching:", containerSelector);

             const markChanges = () => {
                 this.markUnsavedChanges();
             };


            containers.forEach(container => {
                 // Check if container is already tracked
                 if (trackedContainers.has(container)) {
                     return;
                 }

                 // Attach listeners using capture phase might be more robust in some cases
                 // but stick to bubbling unless needed.
                 container.addEventListener('input', markChanges);
                 container.addEventListener('change', markChanges); // For selects, checkboxes

                 // Add container to the tracked set
                 trackedContainers.add(container);
                 console.log("[ModuleUtils] Attached change listeners to:", container.id || container.tagName);

            });

            // Setup warning before page unload if there are unsaved changes
             // Ensure only one beforeunload listener is active
             window.removeEventListener('beforeunload', this._handleBeforeUnload); // Remove previous if exists
             this._handleBeforeUnload = (e) => {
                if (_hasUnsavedChanges) {
                    // Standard way to trigger the browser's confirmation dialog
                    e.preventDefault(); // Required for Chrome
                    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'; // Required for other browsers
                    return e.returnValue;
                }
             };
             window.addEventListener('beforeunload', this._handleBeforeUnload);
             console.log("[ModuleUtils] Attached beforeunload listener.");

        },
         // Store the handler reference to allow removal
         _handleBeforeUnload: null

    };

    // Export the ModuleUtils
    window.ConstructionApp.ModuleUtils = ModuleUtils;
})();
