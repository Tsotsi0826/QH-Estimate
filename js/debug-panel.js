// js/debug-panel.js
// Contains functions for setting up and managing the debug panel.

// Using an IIFE to encapsulate the code and avoid polluting global scope too much,
// but exposing the necessary setup function.
(function() {
    // Ensure the main app namespace exists
    window.ConstructionApp = window.ConstructionApp || {};

    /**
     * Sets up the debug panel toggle button and its event listener.
     * Assumes the debug panel HTML element (#debug-panel) exists in the main HTML.
     */
    function setupDebugPanel() {
        const debugPanel = document.getElementById('debug-panel');
        let toggleBtn = document.getElementById('debug-toggle-btn');

        // Only proceed if the debug panel exists
        if (!debugPanel) {
            // console.log("[DebugPanel] Debug panel element not found, skipping setup.");
            return; // Silently exit if no debug panel element
        }

        // Create toggle button if it doesn't exist
        if (!toggleBtn) {
            console.log("[DebugPanel] Debug toggle button not found, creating it.");
            toggleBtn = document.createElement('button');
            toggleBtn.textContent = 'Debug';
            toggleBtn.id = 'debug-toggle-btn';
            // Apply necessary styles directly
            toggleBtn.style.cssText = `
                position: fixed;
                bottom: 10px;
                right: 10px;
                z-index: 10000;
                padding: 5px 10px;
                background: #333;
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                opacity: 0.8;
                font-size: 12px;
            `;
            document.body.appendChild(toggleBtn);
        }

         // Ensure button is visible (might be hidden by default CSS)
         toggleBtn.style.display = 'block';


        // Add click listener to toggle the debug panel visibility
        toggleBtn.removeEventListener('click', toggleDebugPanel); // Prevent duplicates
        toggleBtn.addEventListener('click', toggleDebugPanel);
        console.log("[DebugPanel] Debug panel setup complete.");
    }

    /**
    * Toggles the visibility of the debug panel.
    */
    function toggleDebugPanel() {
         const debugPanel = document.getElementById('debug-panel');
         const toggleBtn = document.getElementById('debug-toggle-btn');
         if (!debugPanel || !toggleBtn) return;

         const isVisible = debugPanel.style.display === 'block';
         debugPanel.style.display = isVisible ? 'none' : 'block';
         toggleBtn.textContent = isVisible ? 'Debug' : 'Hide Debug';
         // Update content only when showing
         if (!isVisible) {
             updateDebugPanel();
         }
    }


    /**
     * Updates the content of the debug panel with current state information.
     * Assumes global access to appData, headerCollapseState, ClientManager, ModuleUtils if needed.
     */
    function updateDebugPanel() {
        const debugPanel = document.getElementById('debug-panel');
        // Only update if the panel exists and is visible
        if (!debugPanel || debugPanel.style.display !== 'block') {
            return;
        }

        // Safely access potentially global state and utilities
        const ClientManager = window.ConstructionApp?.ClientManager;
        const ModuleUtils = window.ConstructionApp?.ModuleUtils;
        // Assuming appData and headerCollapseState are accessible globally from dashboard.js scope
        // If not, these would need to be passed or exposed differently.
        const currentAppData = typeof appData !== 'undefined' ? appData : { modules: [] };
        const currentHeaderState = typeof headerCollapseState !== 'undefined' ? headerCollapseState : {};

        // Gather debug information
        const navigationState = sessionStorage.getItem('navigationState');
        const currentClient = ClientManager?.getCurrentClient();
        const storedClientStr = sessionStorage.getItem('currentClient');
        const moduleOrderStr = sessionStorage.getItem('moduleOrder');
        let storedClientParsed = null;
        try { storedClientParsed = JSON.parse(storedClientStr || 'null'); } catch(e){}

        let debugInfo = `<strong>Nav State:</strong> ${navigationState || 'None'}<br>
                         <strong>Current Client (Mgr):</strong> ${currentClient ? currentClient.name : 'None'} (ID: ${currentClient?.id || 'N/A'})<br>
                         <strong>Client in sessionStorage:</strong> ${storedClientParsed ? 'Present' : 'None'} (ID: ${storedClientParsed?.id || 'N/A'})<br>
                         <hr>
                         <strong>Modules in appData:</strong> ${currentAppData.modules?.length || 0}<br>
                         <strong>Module Order Backup:</strong> ${moduleOrderStr ? 'Present' : 'None'}<br>
                         <strong>Header Collapse State:</strong> ${JSON.stringify(currentHeaderState)}<br>
                         <hr>`;

        // Add client module data summary if client exists
        if (currentClient && currentClient.moduleData) {
            debugInfo += '<strong>Client Module Data (Costs):</strong><br>';
            let calculatedTotal = 0;
            Object.entries(currentClient.moduleData).forEach(([moduleId, moduleVData]) => {
                const moduleData = moduleVData?.data ?? moduleVData ?? {};
                let moduleCost = 0;
                if (moduleData?.totalCost !== undefined) moduleCost = moduleData.totalCost;
                else if (moduleData?.items) moduleCost = ModuleUtils?.calculateModuleTotal(moduleData.items) ?? 0;
                calculatedTotal += parseFloat(moduleCost) || 0;
                debugInfo += `- ${moduleId}: Cost: ${ModuleUtils?.formatCurrency(moduleCost) ?? 'N/A'}<br>`;
            });
            debugInfo += `<strong>Calculated Total Cost:</strong> ${ModuleUtils?.formatCurrency(calculatedTotal) ?? 'N/A'}<br><hr>`;
        } else if (currentClient) {
             debugInfo += '<strong>Client Module Data:</strong> None<br><hr>';
        }

        // Add module structure summary
        debugInfo += '<strong>Module Structure (appData - Top 5):</strong><br><pre style="max-height: 150px; overflow-y: auto; border: 1px solid #555; padding: 5px; font-size: 11px;">';
        debugInfo += JSON.stringify(currentAppData.modules?.slice(0, 5).map(m => ({id: m.id, name: m.name, type: m.type, parentId: m.parentId, order: m.order})) || [], null, 1);
        debugInfo += '</pre>';

        // Update the panel's content
        debugPanel.innerHTML = debugInfo;
    }

    // Expose the setup function globally, namespaced under ConstructionApp
    // This allows dashboard.js (or dashboard-init.js later) to call it.
    window.ConstructionApp.DebugPanel = {
        setup: setupDebugPanel,
        update: updateDebugPanel // Expose update too if needed externally
    };

})(); // Immediately invoke the function expression
