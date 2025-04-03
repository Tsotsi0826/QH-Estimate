// js/dashboard-renderer.js - Manages rendering the main dashboard content (tiles, cost)
(function() {
    'use strict';

    window.ConstructionApp = window.ConstructionApp || {};

    // --- Private Variables ---
    let dashboardContentElement = null; // Reference to the main #module-content div
    let totalCostElement = null;        // Reference to the #total-project-cost div
    let modulesData = [];               // Local reference to module definitions

    // --- Private Functions (Will be moved from dashboard.js) ---

    /**
     * Renders the module tiles into the main content area based on client data.
     * @param {object|null} client - The current client object or null.
     */
    function renderDashboardContent(client) {
        console.warn("[DashboardRenderer] renderDashboardContent needs to be moved/implemented here.");
        // --- Placeholder ---
        if (!dashboardContentElement) return;
        const hasClient = !!client;
        let tilesHTML = modulesData
            .filter(m => m.type !== 'header') // Skip headers
            .map(module => {
                const hasData = hasClient && client.moduleData && client.moduleData[module.id];
                const cost = hasData ? (client.moduleData[module.id].totalCost ?? 0) : 0; // Simplified cost logic
                const formattedCost = `R${parseFloat(cost).toFixed(2)}`;
                const openDisabled = (!hasClient && module.requiresClient) ? 'disabled' : '';
                return `
                    <div class="module-tile ${!hasData ? 'no-client-data' : ''}" data-module-id="${module.id}">
                        <h5>${module.name}</h5>
                        <p class="module-tile-cost">${formattedCost} ${!hasData ? '<small>(No data)</small>' : ''}</p>
                        <button class="btn module-open-btn" ${openDisabled}>Open</button>
                        ${hasData && module.id !== 'notes' ? '<button class="clear-module-btn">×</button>' : ''}
                    </div>`;
            })
            .join('');

        // Create or find the #module-tiles container
        let tilesContainer = dashboardContentElement.querySelector('#module-tiles');
        if (!tilesContainer) {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = `<div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 10px;"><h4 style="margin-bottom: 15px;">Module Summaries</h4><div id="module-tiles"></div></div>`;
            tilesContainer = wrapper.querySelector('#module-tiles');
            // Append wrapper only if it was created
             if (dashboardContentElement.firstChild && dashboardContentElement.firstChild.classList?.contains('no-client-notification')) {
                 // Insert after notification if it exists
                 dashboardContentElement.insertBefore(wrapper.firstChild, dashboardContentElement.firstChild.nextSibling);
             } else {
                 dashboardContentElement.appendChild(wrapper.firstChild);
             }
        }
        tilesContainer.innerHTML = tilesHTML || '<p>No modules defined.</p>'; // Add tiles or message
    }

    /**
     * Calculates and updates the total project cost display in the header.
     * @param {object|null} client - The current client object or null.
     */
    function updateTotalProjectCost(client) {
        console.warn("[DashboardRenderer] updateTotalProjectCost needs to be moved/implemented here.");
        // --- Placeholder ---
        if (!totalCostElement) return;
        let totalCost = 0;
        if (client && client.moduleData) {
            // Simplified calculation - real logic will be moved
            totalCost = Object.values(client.moduleData)
                              .reduce((sum, modData) => sum + (parseFloat(modData?.totalCost) || 0), 0);
        }
        const formattedTotal = `R${totalCost.toFixed(2)}`; // Use formatCurrency util later
        totalCostElement.textContent = `Total Project Cost: ${formattedTotal}`;
    }

    /**
     * Clears data for a specific module for the current client.
     * @param {string} moduleId - The ID of the module to clear.
     */
    function clearModuleData(moduleId) {
        console.warn("[DashboardRenderer] clearModuleData needs to be moved/implemented here.");
        // --- Placeholder ---
        // Actual logic will:
        // 1. Get current client from ClientManager.
        // 2. Check if data exists.
        // 3. Call ClientManager.saveModuleData(moduleId, null, callback).
        // 4. Handle success/error (ClientManager.setCurrentClient triggers update).
        // 5. Show messages via ModuleUtils.
        alert(`Placeholder: Clear data action for module ${moduleId}`);
    }

    /**
     * Handles clicks within the module tiles container (delegated).
     * @param {Event} event - The click event.
     */
    function handleTileClick(event) {
        console.warn("[DashboardRenderer] handleTileClick needs to be moved/implemented here.");
        // --- Placeholder ---
        // Actual logic will:
        // 1. Check closest '.module-open-btn' or '.clear-module-btn'.
        // 2. Get moduleId from parent '.module-tile'.
        // 3. Call ModuleUtils.navigateToModule or local clearModuleData.
        const openBtn = event.target.closest('.module-open-btn');
        const clearBtn = event.target.closest('.clear-module-btn');
        const tile = event.target.closest('.module-tile');
        if (tile) {
            const moduleId = tile.dataset.moduleId;
            if (openBtn && !openBtn.disabled) alert(`Placeholder: Navigate to ${moduleId}`);
            else if (clearBtn) alert(`Placeholder: Confirm clear for ${moduleId}`);
        }
    }

    /**
     * Sets up the delegated event listener for the tiles container.
     */
    function setupDashboardTileListeners() {
        console.warn("[DashboardRenderer] setupDashboardTileListeners needs to be moved/implemented here.");
         // --- Placeholder ---
         if (!dashboardContentElement) {
             console.error("[DashboardRenderer] Cannot setup listeners, content element not found.");
             return;
         }
         // Use event delegation on the main content element
         dashboardContentElement.removeEventListener('click', handleTileClick); // Prevent duplicates
         dashboardContentElement.addEventListener('click', handleTileClick);
         console.log("[DashboardRenderer] Tile listeners setup on #module-content.");
    }


    // --- Public API Functions ---

    /**
     * Initializes the dashboard renderer. Finds essential elements and stores module defs.
     * @param {Array} initialModulesData - The initial list of module definitions from ModuleDefinitionManager.
     */
    function init(initialModulesData) {
        console.log("[DashboardRenderer] Initializing...");
        dashboardContentElement = document.getElementById('module-content');
        totalCostElement = document.getElementById('total-project-cost');
        modulesData = initialModulesData || []; // Store module definitions

        if (!dashboardContentElement) {
            console.error("[DashboardRenderer] CRITICAL: Main content element #module-content not found!");
        }
        if (!totalCostElement) {
            console.error("[DashboardRenderer] CRITICAL: Total project cost element #total-project-cost not found!");
        }
        // Listeners are setup AFTER content is rendered by the render() function.
        console.log("[DashboardRenderer] Initialization complete.");
    }

    /**
     * Renders the main dashboard view (tiles or no-client message) based on the client.
     * This is the main function called by dashboard.js's updateDashboard callback.
     * @param {object|null} client - The current client object or null.
     */
    function render(client) {
         console.log("[DashboardRenderer] Rendering dashboard for client:", client ? client.name : 'None');
         if (!dashboardContentElement) {
             console.error("[DashboardRenderer] Cannot render, content element not found.");
             return;
         }

         // Clear previous content from main area
         dashboardContentElement.innerHTML = '';

         if (client) {
             // Render tiles using the client data
             renderDashboardContent(client); // Generate and add tiles HTML
             updateTotalProjectCost(client); // Update total cost display
         } else {
             // Render the "No Client Selected" message and disabled tiles
             dashboardContentElement.innerHTML = `<div class="no-client-notification" style="margin-bottom: 20px;"><h2>No Client Selected</h2><p>Please select an existing client or create a new client using the sidebar.</p></div>`;
             renderDashboardContent(null); // Render tiles in disabled/no-data state
             updateTotalProjectCost(null); // Reset total cost display
         }
         // Setup listeners AFTER the content (tiles or no-client message) is in the DOM
         setupDashboardTileListeners();
         console.log("[DashboardRenderer] Render complete.");
    }


    // --- Expose Public Interface ---
    window.ConstructionApp.DashboardRenderer = {
        init: init,   // Called once on app load
        render: render // Called by dashboard.js whenever the client changes
    };

})(); // Immediately invoke the function
