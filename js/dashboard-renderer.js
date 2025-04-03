// js/dashboard-renderer.js - Manages rendering the main dashboard content (tiles, cost)
(function() {
    'use strict';

    window.ConstructionApp = window.ConstructionApp || {};

    // --- Private Variables ---
    let dashboardContentElement = null; // Reference to the main #module-content div
    let totalCostElement = null;        // Reference to the #total-project-cost div
    let modulesData = [];               // Local reference to module definitions

    // --- Private Functions (Moved from dashboard.js) ---

    /**
     * Renders the module tiles into the main content area based on client data.
     * @param {object|null} client - The current client object or null.
     */
    function renderDashboardContent(client) {
        // console.log("[DashboardRenderer] renderDashboardContent called."); // Can be noisy
        if (!dashboardContentElement) {
             console.error("[DashboardRenderer] Cannot render tiles, content element not found.");
             return;
        }
        const hasClient = !!client;
        let tilesHTML = '';
        let hasAnyRenderableModules = false;

        if (modulesData && Array.isArray(modulesData)) {
            // Sort modules by order before rendering tiles
            const sortedModules = [...modulesData].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

            sortedModules.forEach(module => {
                // Skip headers when rendering tiles
                if (module.type === 'header') {
                    return;
                }
                hasAnyRenderableModules = true; // Found at least one module to render as a tile

                const moduleId = module.id;
                const moduleName = module.name;

                // Check if the client has data for this module
                let clientModuleData = null;
                let hasData = false;
                if (hasClient && client.moduleData) {
                    const clientModuleVersionedData = client.moduleData[moduleId];
                    clientModuleData = clientModuleVersionedData?.data ?? clientModuleVersionedData ?? null;
                    if (clientModuleData !== null && clientModuleData !== undefined) {
                         // Consider data present unless it's an empty object (and not an array)
                         if (typeof clientModuleData !== 'object' || Array.isArray(clientModuleData) || Object.keys(clientModuleData).length > 0) {
                            hasData = true;
                         }
                    }
                }

                // Calculate cost for this module
                let moduleCost = 0;
                if (hasData) {
                    if (clientModuleData.totalCost !== undefined) {
                        moduleCost = parseFloat(clientModuleData.totalCost) || 0;
                    } else if (clientModuleData.items && Array.isArray(clientModuleData.items)) {
                        if (window.ConstructionApp && window.ConstructionApp.ModuleUtils) {
                            moduleCost = window.ConstructionApp.ModuleUtils.calculateModuleTotal(clientModuleData.items);
                        }
                    } else if (moduleId === 'notes') {
                        moduleCost = 0; // Notes module has no cost
                    }
                }

                // Format cost using utility function
                const formattedCost = window.ConstructionApp?.ModuleUtils?.formatCurrency(moduleCost) ?? `R${moduleCost.toFixed(2)}`;

                // Add clear button only if there's data and it's not the notes module
                const clearButtonHtml = (hasData && moduleId !== 'notes') ? `<button class="clear-module-btn" title="Clear module data for this client">×</button>` : '';

                // Disable open button if the module requires a client but none is selected
                const openButtonDisabled = (!hasClient && module.requiresClient) ? 'disabled title="Select a client first"' : '';
                const openButtonHtml = `<button class="btn module-open-btn" style="margin-top: 10px;" ${openButtonDisabled}>Open Module</button>`;

                // Display cost or "No cost" for Notes
                let costHtml = '';
                if (moduleId === 'notes') {
                    costHtml = '<p style="font-size: 0.9em; color: #666; margin-top: 10px;">(No cost associated)</p>';
                } else {
                    const noDataAnnotation = !hasData ? ' <small style="opacity: 0.7;"> (No data)</small>' : '';
                    costHtml = `<p class="module-tile-cost">${formattedCost}${noDataAnnotation}</p>`;
                }

                // Add the 'no-client-data' class if the client doesn't have data for this module
                tilesHTML += `
                    <div class="module-tile ${!hasData ? 'no-client-data' : ''}" data-module-id="${moduleId}">
                        ${clearButtonHtml}
                        <h5>${moduleName}</h5>
                        ${costHtml}
                        ${openButtonHtml}
                    </div>`;
            });
        }

        // --- Create or find the #module-tiles container ---
        let tilesContainer = dashboardContentElement.querySelector('#module-tiles');
        let tilesWrapper = dashboardContentElement.querySelector('#module-tiles-wrapper'); // Use a wrapper ID

        if (!tilesWrapper) {
            // If wrapper doesn't exist, create it and the container inside
            tilesWrapper = document.createElement('div');
            tilesWrapper.id = 'module-tiles-wrapper'; // Give wrapper an ID
            tilesWrapper.style.backgroundColor = '#f8f9fa'; // Styles from original dashboard.js
            tilesWrapper.style.padding = '15px';
            tilesWrapper.style.borderRadius = '5px';
            tilesWrapper.style.marginBottom = '10px';
            tilesWrapper.innerHTML = `<h4 style="margin-bottom: 15px;">Module Summaries</h4><div id="module-tiles"></div>`;
            tilesContainer = tilesWrapper.querySelector('#module-tiles');

            // Append wrapper to the main content area (respecting potential notification)
            if (dashboardContentElement.firstChild && dashboardContentElement.firstChild.classList?.contains('no-client-notification')) {
                dashboardContentElement.insertBefore(tilesWrapper, dashboardContentElement.firstChild.nextSibling);
            } else {
                dashboardContentElement.appendChild(tilesWrapper);
            }
        } else {
             // Wrapper exists, just get the container inside it
             tilesContainer = tilesWrapper.querySelector('#module-tiles');
             if (!tilesContainer) {
                  console.error("[DashboardRenderer] Tiles wrapper exists, but inner #module-tiles container not found!");
                  // Attempt to recreate container inside wrapper
                  tilesWrapper.innerHTML = `<h4 style="margin-bottom: 15px;">Module Summaries</h4><div id="module-tiles"></div>`;
                  tilesContainer = tilesWrapper.querySelector('#module-tiles');
             }
        }
        // --- End container handling ---


        // Populate the tiles container
        if (tilesContainer) {
            if (hasAnyRenderableModules) {
                tilesContainer.innerHTML = tilesHTML; // Add the generated tiles
            } else {
                // Show message if no modules are defined (other than potential headers)
                tilesContainer.innerHTML = `<div style="background-color: white; padding: 15px; border-radius: 5px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); grid-column: 1 / -1; text-align: center; color: #666;"><p>No modules defined in the system.</p><p style="margin-top: 5px;"><small>Add modules using the sidebar.</small></p></div>`;
            }
        }
    }

    /**
     * Calculates and updates the total project cost display in the header.
     * @param {object|null} client - The current client object or null.
     */
    function updateTotalProjectCost(client) {
        if (!totalCostElement) {
            console.warn("[DashboardRenderer] Total project cost display element not found.");
            return;
        }

        let totalCost = 0;
        if (client && client.moduleData) {
            Object.entries(client.moduleData).forEach(([moduleId, moduleVersionedData]) => {
                 const moduleData = moduleVersionedData?.data ?? moduleVersionedData ?? null;
                if (!moduleData) return; // Skip if no data

                let costForThisModule = 0;
                if (moduleData.totalCost !== undefined) {
                    costForThisModule = parseFloat(moduleData.totalCost) || 0;
                } else if (moduleData.items && Array.isArray(moduleData.items)) {
                    // Use ModuleUtils if available
                    costForThisModule = window.ConstructionApp?.ModuleUtils?.calculateModuleTotal(moduleData.items) ?? 0;
                }
                // Add to total, excluding specific modules like 'notes' if needed
                if (moduleId !== 'notes') {
                     totalCost += costForThisModule;
                }
            });
        }

        // Format and display the total cost
        const formattedTotal = window.ConstructionApp?.ModuleUtils?.formatCurrency(totalCost) ?? `R${totalCost.toFixed(2)}`;
        totalCostElement.textContent = `Total Project Cost: ${formattedTotal}`;
        // console.log("[DashboardRenderer] Total project cost updated:", formattedTotal); // Can be noisy
    }

    /**
     * Clears data for a specific module for the current client using ClientManager.
     * @param {string} moduleId - The ID of the module to clear data for.
     */
    function clearModuleData(moduleId) {
        const client = window.ConstructionApp?.ClientManager?.getCurrentClient();
        if (!client) {
            window.ConstructionApp?.ModuleUtils?.showErrorMessage("No client selected.");
            return;
        }

        // Check if data actually exists before attempting to clear
        if (client.moduleData && client.moduleData.hasOwnProperty(moduleId)) {
            console.log(`[DashboardRenderer] Clearing module data for: ${moduleId} for client ${client.name}`);

            // Use ClientManager to save null data for this module
            window.ConstructionApp.ClientManager.saveModuleData(moduleId, null, (success, error) => {
                if (success) {
                    console.log("[DashboardRenderer] Module data clear request sent successfully via ClientManager.");

                    // IMPORTANT: Update the local client state in ClientManager as well
                    // This ensures the UI reflects the change immediately without needing a full reload
                    if (client.moduleData) {
                         delete client.moduleData[moduleId]; // Remove from local object
                         const updatedClient = { ...client }; // Create a *new* object reference
                         // Update the client in ClientManager (this will trigger updateDashboard -> render again)
                         window.ConstructionApp.ClientManager.setCurrentClient(updatedClient);
                         console.log("[DashboardRenderer] Updated client session after clearing module.");
                    }

                    window.ConstructionApp?.ModuleUtils?.showSuccessMessage(`Data for "${moduleId}" cleared.`);
                    // The re-render will happen automatically because setCurrentClient was called

                } else {
                    console.error(`[DashboardRenderer] Error clearing module data via ClientManager: ${error || 'Unknown'}`);
                    window.ConstructionApp?.ModuleUtils?.showErrorMessage(`Error clearing data: ${error || 'Unknown'}`);
                }
            });
        } else {
            // No data existed, just inform the user
            window.ConstructionApp?.ModuleUtils?.showSuccessMessage(`No data to clear for "${moduleId}".`);
             console.log(`[DashboardRenderer] No data found to clear for module ${moduleId}`);
        }
    }

    /**
     * Handles clicks within the module tiles container (delegated).
     * @param {Event} event - The click event.
     */
    function handleTileClick(event) {
        const openBtn = event.target.closest('.module-open-btn');
        const clearBtn = event.target.closest('.clear-module-btn');
        const tile = event.target.closest('.module-tile');

        if (!tile) return; // Click wasn't inside a tile

        const moduleId = tile.dataset.moduleId;
        if (!moduleId) return; // Tile doesn't have a module ID

        // Handle Open Button Click
        if (openBtn && !openBtn.disabled) {
            console.log("[DashboardRenderer] Open button clicked for module:", moduleId);
            // Use ModuleUtils for navigation
            if (window.ConstructionApp && window.ConstructionApp.ModuleUtils) {
                window.ConstructionApp.ModuleUtils.navigateToModule(moduleId);
            } else { console.error("[DashboardRenderer] ModuleUtils not available for navigation!"); }
        }
        // Handle Clear Button Click
        else if (clearBtn) {
            console.log("[DashboardRenderer] Clear button clicked for module:", moduleId);
            const moduleInfo = modulesData.find(m => m.id === moduleId);
            const moduleName = moduleInfo ? moduleInfo.name : moduleId; // Get name for confirmation

            if (confirm(`Are you sure you want to clear all data entered for "${moduleName}" for the current client? This cannot be undone.`)) {
                clearModuleData(moduleId); // Call the local function to handle clearing
            }
        }
    }

    /**
     * Sets up the delegated event listener for the tiles container.
     * Attaches listener to the main content element for robustness.
     */
    function setupDashboardTileListeners() {
         if (!dashboardContentElement) {
             console.error("[DashboardRenderer] Cannot setup listeners, content element not found.");
             return;
         }
         // Use event delegation on the main content element (#module-content)
         // Remove first to prevent duplicates if render is called multiple times without page reload
         dashboardContentElement.removeEventListener('click', handleTileClick);
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
