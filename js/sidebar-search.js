// js/sidebar-search.js
// Handles the module search functionality in the sidebar.

(function() {
    // Ensure the main app namespace exists
    window.ConstructionApp = window.ConstructionApp || {};

    /**
     * Sets up the search input listener to filter modules in the sidebar.
     * Assumes global 'appData' and 'window.ConstructionApp.DashboardUtils.renderModuleList' exist.
     */
    function setupModuleSearch() {
        const searchInput = document.getElementById('module-search-input');
        const container = document.getElementById('modules-container');
        if (!searchInput || !container) {
            console.error("[SidebarSearch] Search input or module container not found.");
            return;
        }

        let debounceTimer;

        // Debounce function to limit how often filtering runs during typing
        const debounceFilter = (func, delay) => {
            return function() {
                const context = this;
                const args = arguments;
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => func.apply(context, args), delay);
            };
        };

        // Filters modules based on search term
        const filterModules = () => {
            // Access global appData (defined in dashboard.js/dashboard-init.js)
            if (typeof appData === 'undefined' || !appData.modules) {
                console.error("[SidebarSearch] appData or appData.modules not available.");
                return;
            }
            // Access global renderModuleList (exposed from dashboard.js/dashboard-init.js)
            const renderListFunc = window.ConstructionApp?.DashboardUtils?.renderModuleList;
            if (typeof renderListFunc !== 'function') {
                 console.error("[SidebarSearch] renderModuleList function not available.");
                 // Cannot re-render on clear search without this function
            }


            const searchTerm = searchInput.value.toLowerCase().trim();
            const allModuleElements = container.querySelectorAll('.module-item');
            const visibleModuleIds = new Set();

            // If search is empty, show all modules and re-render respecting collapse state
            if (searchTerm === '') {
                allModuleElements.forEach(moduleEl => {
                    moduleEl.style.display = 'flex';
                });
                if (renderListFunc) {
                    renderListFunc(appData.modules); // Re-render to fix potential collapse state overrides
                }
                return;
            }

            // Find matching modules and their ancestors
            appData.modules.forEach(module => {
                // Ensure module and name exist before searching
                if (!module || typeof module.name !== 'string') return;

                const moduleName = module.name.toLowerCase();
                const isMatch = moduleName.includes(searchTerm);

                if (isMatch) {
                    visibleModuleIds.add(module.id);
                    let currentParentId = module.parentId;
                    while (currentParentId && currentParentId !== 'null') {
                        visibleModuleIds.add(currentParentId);
                        // Find parent in appData.modules for safety
                        const parentModule = appData.modules.find(m => m && m.id === currentParentId);
                        currentParentId = parentModule ? parentModule.parentId : null;
                    }
                }
            });

            // Show/hide modules based on visibility set
            allModuleElements.forEach(moduleEl => {
                const moduleId = moduleEl.dataset.moduleId;
                if (visibleModuleIds.has(moduleId)) {
                    moduleEl.style.display = 'flex';
                    // Expand parent headers if needed (basic version)
                    let parentId = moduleEl.dataset.parentId;
                    let currentEl = moduleEl;
                    while(parentId && parentId !== 'null') {
                         const parentEl = container.querySelector(`.module-item[data-module-id="${parentId}"]`);
                         if (parentEl) {
                              // Ensure parent is visible and potentially expand (though re-rendering on clear is better)
                              parentEl.style.display = 'flex';
                              // If we want search to force-expand, we'd remove 'collapsed' class here,
                              // but that might conflict with user's manual collapsing.
                              // Re-rendering on clear search handles this better.
                              currentEl = parentEl;
                              parentId = parentEl.dataset.parentId;
                         } else {
                              parentId = null; // Stop if parent element not found
                         }
                    }
                } else {
                    moduleEl.style.display = 'none';
                }
            });
        };

        // Attach the debounced filter function to the input event
        searchInput.addEventListener('input', debounceFilter(filterModules, 250));
        console.log("[SidebarSearch] Module search listener attached.");
    }

    // Expose the setup function on the global namespace
    window.ConstructionApp.SidebarSearch = {
        setup: setupModuleSearch
    };

})();
