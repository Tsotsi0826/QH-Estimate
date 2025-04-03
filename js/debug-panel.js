// js/debug-panel.js - Manages the debug panel UI
(function() {
    'use strict';

    window.ConstructionApp = window.ConstructionApp || {};

    // --- Private Variables ---
    let debugPanelElement = null;
    let toggleBtnElement = null;

    // --- Private Functions (Moved from dashboard.js) ---

    /**
     * Toggles the visibility of the debug panel.
     */
    function toggleDebugPanel() {
        if (!debugPanelElement || !toggleBtnElement) {
             console.warn("[DebugPanel] Cannot toggle, panel or button element missing.");
             return;
        }

        const isVisible = debugPanelElement.style.display === 'block';
        debugPanelElement.style.display = isVisible ? 'none' : 'block';
        toggleBtnElement.textContent = isVisible ? 'Debug' : 'Hide Debug';

        // Update content only when showing
        if (!isVisible) {
            updateDebugPanelContent();
        }
    }

    /**
     * Updates the content of the debug panel with current state info.
     */
    function updateDebugPanelContent() {
        // Only update if the panel exists and is visible
        if (!debugPanelElement || debugPanelElement.style.display !== 'block') return;

        // --- Gather state information from managers ---
        // Ensure managers exist before trying to access their functions
        const ClientManager = window.ConstructionApp.ClientManager;
        const ModuleDefManager = window.ConstructionApp.ModuleDefinitionManager;
        const ModuleUtils = window.ConstructionApp.ModuleUtils; // For formatting

        const navigationState = sessionStorage.getItem('navigationState');
        const currentClient = ClientManager?.getCurrentClient(); // Use optional chaining
        const storedClientStr = sessionStorage.getItem('currentClient');
        const moduleOrderStr = sessionStorage.getItem('moduleOrder');
        // Safely get modules, default to empty array if manager or function is missing
        const modules = (ModuleDefManager && typeof ModuleDefManager.getModuleDefinitions === 'function')
                          ? ModuleDefManager.getModuleDefinitions()
                          : [];

        let storedClientParsed = null;
        try { storedClientParsed = JSON.parse(storedClientStr || 'null'); } catch(e){}
        // --- End gathering state ---


        // --- Build HTML string for debug info ---
        let debugInfo = `<strong>Nav State:</strong> ${navigationState || 'None'}<br>
                         <strong>Current Client (Mgr):</strong> ${currentClient ? currentClient.name : 'None'} (ID: ${currentClient?.id || 'N/A'})<br>
                         <strong>Client in sessionStorage:</strong> ${storedClientParsed ? 'Present' : 'None'} (ID: ${storedClientParsed?.id || 'N/A'})<br>
                         <hr>
                         <strong>Modules Loaded:</strong> ${modules?.length || 0}<br>
                         <strong>Module Order Backup:</strong> ${moduleOrderStr ? 'Present' : 'None'}<br>
                         <hr>`; // Removed headerCollapseState as it's internal to SidebarManager

        // Add client module data summary if client exists
        if (currentClient && currentClient.moduleData) {
            debugInfo += '<strong>Client Module Data (Costs):</strong><br>';
            let calculatedTotal = 0;
            Object.entries(currentClient.moduleData).forEach(([moduleId, moduleVData]) => {
                const moduleData = moduleVData?.data ?? moduleVData ?? {};
                let moduleCost = 0;
                if (moduleData?.totalCost !== undefined) moduleCost = moduleData.totalCost;
                else if (moduleData?.items) moduleCost = ModuleUtils?.calculateModuleTotal(moduleData.items) ?? 0;

                if (moduleId !== 'notes') {
                     calculatedTotal += parseFloat(moduleCost) || 0;
                }
                // Use ModuleUtils for formatting if available
                const formattedCost = (ModuleUtils && typeof ModuleUtils.formatCurrency === 'function')
                                        ? ModuleUtils.formatCurrency(moduleCost)
                                        : `R${parseFloat(moduleCost || 0).toFixed(2)}`;
                debugInfo += `- ${moduleId}: Cost: ${formattedCost}<br>`;
            });
             const formattedTotalCost = (ModuleUtils && typeof ModuleUtils.formatCurrency === 'function')
                                        ? ModuleUtils.formatCurrency(calculatedTotal)
                                        : `R${parseFloat(calculatedTotal || 0).toFixed(2)}`;
            debugInfo += `<strong>Calculated Total Cost (Excl. Notes):</strong> ${formattedTotalCost}<br><hr>`;
        } else if (currentClient) {
            debugInfo += '<strong>Client Module Data:</strong> None<br><hr>';
        }

        // Add module structure preview
        debugInfo += '<strong>Module Structure (Top 5):</strong><br><pre style="max-height: 150px; overflow-y: auto; border: 1px solid #555; padding: 5px; font-size: 11px;">';
        // Safely slice and map modules
        debugInfo += JSON.stringify(modules?.slice(0, 5).map(m => ({id: m.id, name: m.name, type: m.type, parentId: m.parentId, order: m.order})) || [], null, 1);
        debugInfo += '</pre>';
        // --- End building HTML ---

        // Update the panel content
        debugPanelElement.innerHTML = debugInfo;
    }

    /**
     * Finds or creates the debug panel elements and attaches listener to the toggle button.
     * (Logic moved from dashboard.js's setupDebugPanel)
     */
    function setupDebugPanel() {
        debugPanelElement = document.getElementById('debug-panel');
        toggleBtnElement = document.getElementById('debug-toggle-btn');

        // Only proceed if the main panel element exists in HTML
        if (!debugPanelElement) {
             console.warn("[DebugPanel] Debug panel element #debug-panel not found in HTML. Debug panel disabled.");
             return; // Don't create button if panel isn't there
        }

        // Create button if it doesn't exist
        if (!toggleBtnElement) {
            console.log("[DebugPanel] Toggle button #debug-toggle-btn not found, creating it.");
            toggleBtnElement = document.createElement('button');
            toggleBtnElement.textContent = 'Debug';
            toggleBtnElement.id = 'debug-toggle-btn';
            // Apply necessary styles for positioning and appearance
            toggleBtnElement.style.cssText = `position: fixed; bottom: 10px; right: 10px; z-index: 10000; padding: 5px 10px; background: #333; color: white; border: none; border-radius: 3px; cursor: pointer; opacity: 0.8; font-size: 12px;`;
            document.body.appendChild(toggleBtnElement);
        }

        // Ensure button is visible and listener is attached
        toggleBtnElement.style.display = 'block';
        toggleBtnElement.removeEventListener('click', toggleDebugPanel); // Prevent duplicates
        toggleBtnElement.addEventListener('click', toggleDebugPanel);
        console.log("[DebugPanel] Debug panel toggle setup.");
    }


    // --- Public API Functions ---

    /**
     * Initializes the debug panel functionality.
     */
    function init() {
        console.log("[DebugPanel] Initializing...");
        setupDebugPanel(); // Find elements and attach listener
    }

    /**
     * Public function to update the debug panel content if it's visible.
     */
    function update() {
        // console.log("[DebugPanel] Update requested."); // Can be noisy
        updateDebugPanelContent();
    }

    // --- Expose Public Interface ---
    window.ConstructionApp.DebugPanel = {
        init: init,
        update: update // Expose function to update content externally
    };

})(); // Immediately invoke the function
