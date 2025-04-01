/**
 * Simple Module Grouping
 * 
 * A lightweight solution to visually organize modules in the sidebar by category.
 * - Creates green headers for module groups (like "Foundations")
 * - Indents related modules underneath each group
 * - Maintains all existing module functionality
 */

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("[ModuleGrouping] Initializing simple module grouping");
    initializeModuleGroups();
});

// Set up module groups after modules are loaded
function initializeModuleGroups() {
    // Wait for modules to be fully loaded before organizing
    const checkModulesLoaded = setInterval(() => {
        const moduleItems = document.querySelectorAll('.module-item');
        if (moduleItems.length > 0) {
            clearInterval(checkModulesLoaded);
            console.log("[ModuleGrouping] Modules detected, organizing into groups");
            organizeModulesIntoGroups();
        }
    }, 100);
}

// Define module groups and their members
const moduleGroups = {
    "Foundations": [
        "foundations",
        "foundations-excavation",
        "foundations-concrete",
        "foundations-steel"
    ],
    "Building": [
        "demolish",
        "brickwork"
    ],
    "Management": [
        "notes",
        "p-and-gs"
    ]
};

// Organize modules into their respective groups
function organizeModulesIntoGroups() {
    const modulesContainer = document.getElementById('modules-container');
    
    if (!modulesContainer) {
        console.error("[ModuleGrouping] Modules container not found");
        return;
    }
    
    // Create a document fragment to build the new structure
    const fragment = document.createDocumentFragment();
    
    // Process each group
    Object.keys(moduleGroups).forEach(groupName => {
        // Create the group header
        const groupHeader = createGroupHeader(groupName);
        fragment.appendChild(groupHeader);
        
        // Find and append modules belonging to this group
        const groupModules = findModulesInGroup(moduleGroups[groupName]);
        groupModules.forEach(module => {
            // Add indent styling to group members
            module.style.paddingLeft = '30px';
            fragment.appendChild(module);
        });
    });
    
    // Find modules not in any group
    const ungroupedModules = findUngroupedModules();
    
    // If there are ungrouped modules, add them under an "Other" header
    if (ungroupedModules.length > 0) {
        const otherHeader = createGroupHeader("Other");
        fragment.appendChild(otherHeader);
        
        ungroupedModules.forEach(module => {
            module.style.paddingLeft = '30px';
            fragment.appendChild(module);
        });
    }
    
    // Clear and repopulate the modules container
    modulesContainer.innerHTML = '';
    modulesContainer.appendChild(fragment);
    
    // Reattach event listeners to all modules
    reattachModuleEventListeners();
    
    console.log("[ModuleGrouping] Module organization complete");
}

// Create a group header element
function createGroupHeader(groupName) {
    const header = document.createElement('div');
    header.className = 'module-group-header';
    header.textContent = groupName;
    header.style.cssText = `
        background-color: #4eca8b;
        color: white;
        padding: 8px 20px;
        font-weight: bold;
        cursor: pointer;
        margin-top: 5px;
    `;
    
    // Add click handler to collapse/expand the group
    header.addEventListener('click', toggleGroupVisibility);
    
    return header;
}

// Toggle visibility of modules in a group
function toggleGroupVisibility(event) {
    const header = event.currentTarget;
    const isCollapsed = header.getAttribute('data-collapsed') === 'true';
    
    // Get all modules after this header until the next header
    let current = header.nextElementSibling;
    while (current && !current.classList.contains('module-group-header')) {
        current.style.display = isCollapsed ? 'flex' : 'none';
        current = current.nextElementSibling;
    }
    
    // Toggle the collapsed state
    header.setAttribute('data-collapsed', !isCollapsed);
    
    // Visual indicator for collapsed/expanded state
    if (isCollapsed) {
        header.style.opacity = '1';
        header.textContent = header.textContent.replace('▸ ', '');
    } else {
        header.style.opacity = '0.8';
        header.textContent = '▸ ' + header.textContent;
    }
}

// Find modules that belong to a specific group
function findModulesInGroup(moduleIds) {
    const result = [];
    const allModules = document.querySelectorAll('.module-item');
    
    // Clone each module that belongs to this group
    Array.from(allModules).forEach(module => {
        const moduleId = module.getAttribute('data-module-id');
        if (moduleIds.includes(moduleId)) {
            // Clone to remove existing event listeners
            const clonedModule = module.cloneNode(true);
            result.push(clonedModule);
            
            // Mark the original for removal
            module.setAttribute('data-processed', 'true');
        }
    });
    
    return result;
}

// Find modules that don't belong to any defined group
function findUngroupedModules() {
    const result = [];
    const allModuleIds = [];
    
    // Collect all module IDs from all groups
    Object.values(moduleGroups).forEach(group => {
        group.forEach(id => allModuleIds.push(id));
    });
    
    // Find modules not in any group
    const allModules = document.querySelectorAll('.module-item');
    Array.from(allModules).forEach(module => {
        const moduleId = module.getAttribute('data-module-id');
        if (!allModuleIds.includes(moduleId) && !module.hasAttribute('data-processed')) {
            // Clone to remove existing event listeners
            const clonedModule = module.cloneNode(true);
            result.push(clonedModule);
        }
    });
    
    return result;
}

// Reattach event listeners to modules
function reattachModuleEventListeners() {
    // Re-initialize drag and drop
    if (typeof setupDragAndDrop === 'function') {
        setupDragAndDrop();
    }
    
    // Re-initialize dropdowns
    if (typeof setupDropdownMenus === 'function') {
        setupDropdownMenus();
    }
    
    // Set up module click handlers
    const moduleItems = document.querySelectorAll('.module-item');
    moduleItems.forEach(module => {
        if (typeof setupModuleClickHandler === 'function') {
            setupModuleClickHandler(module);
        } else {
            // Basic click handler if the main function isn't available
            const moduleText = module.querySelector('span');
            if (moduleText) {
                moduleText.addEventListener('click', function() {
                    const moduleId = module.getAttribute('data-module-id');
                    const requiresClient = module.getAttribute('data-requires-client') === 'true';
                    
                    if (requiresClient) {
                        // Verify client is selected
                        const client = window.ConstructionApp.ClientManager.getCurrentClient();
                        if (!client) {
                            alert("Please select or create a client first to access this module.");
                            return;
                        }
                        
                        // Save state before navigating
                        sessionStorage.setItem('navigationState', 'fromDashboard');
                        sessionStorage.setItem('currentClient', JSON.stringify(client));
                        
                        // Navigate to the module
                        window.location.href = moduleId + '.html';
                    } else {
                        // For non-client modules, just navigate directly
                        window.location.href = moduleId + '.html';
                    }
                });
            }
        }
    });
    
    console.log("[ModuleGrouping] Event listeners reattached to grouped modules");
}

// Observer to handle dynamically added modules
function setupModuleObserver() {
    // Create a MutationObserver to watch for new modules being added
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Check if we need to reorganize
                const shouldReorganize = Array.from(mutation.addedNodes).some(node => {
                    return node.nodeType === 1 && node.classList.contains('module-item');
                });
                
                if (shouldReorganize) {
                    console.log("[ModuleGrouping] New modules detected, reorganizing groups");
                    setTimeout(organizeModulesIntoGroups, 100);
                }
            }
        });
    });
    
    // Start observing the modules container
    const modulesContainer = document.getElementById('modules-container');
    if (modulesContainer) {
        observer.observe(modulesContainer, { childList: true });
        console.log("[ModuleGrouping] Module observer started");
    }
}

// Initialize the observer after DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(setupModuleObserver, 1000); // Delay to ensure other scripts have run
});
