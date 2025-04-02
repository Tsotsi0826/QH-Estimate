// dashboard.js
// Main dashboard script for the Construction Estimator

// --- Global Variables ---
let appData = {
    modules: []
};
let globalDraggedItem = null;
let headerCollapseState = {}; // Stores collapsed state { headerId: true/false }

// --- Utility / Helper Functions ---
function setupModuleSearch() {
    const searchInput = document.getElementById('module-search-input');
    const container = document.getElementById('modules-container');
    if (!searchInput || !container) {
        console.error("Search input or module container not found.");
        return;
    }

    let debounceTimer;
    const debounceFilter = (func, delay) => {
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(context, args), delay);
        };
    };

    const filterModules = () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const allModuleElements = container.querySelectorAll('.module-item');
        const visibleModuleIds = new Set();

        if (searchTerm === '') {
            allModuleElements.forEach(moduleEl => {
                moduleEl.style.display = 'flex';
            });
            return;
        }

        appData.modules.forEach(module => {
            const moduleName = module.name.toLowerCase();
            const isMatch = moduleName.includes(searchTerm);
            if (isMatch) {
                visibleModuleIds.add(module.id);
                let currentParentId = module.parentId;
                while (currentParentId && currentParentId !== 'null') {
                    visibleModuleIds.add(currentParentId);
                    const parentModule = appData.modules.find(m => m.id === currentParentId);
                    currentParentId = parentModule ? parentModule.parentId : null;
                }
            }
        });

        allModuleElements.forEach(moduleEl => {
