/**
 * Simple Module Grouping
 * 
 * A lightweight solution to organize modules into fixed categories:
 * - Creates green headers for predefined module groups
 * - Indents related modules underneath each group
 * - Provides collapse/expand functionality
 * - Maintains all existing module functionality
 */

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("[ModuleGrouping] Initializing module grouping");
    setTimeout(initializeModuleGroups, 500); // Delay to ensure modules are loaded
});

// Define fixed module groups and their members
const moduleGroups = {
    "Foundations": [
        "foundations-excavation",
        "foundations-concrete", 
        "foundations-steel"
    ],
    "Brickwork": [
        "brickwork",
        "demolish"
    ],
    "Surfacebeds": [
        "surfacebeds"
    ],
    "Plaster": [
        "plaster"
    ],
    "Floor and Wall Covering": [
        "floor-covering",
        "wall-covering",
        "tiling"
    ],
    "Carpentry and Joinery": [
        "carpentry",
        "windows",
        "ceilings"
    ]
    // Admin group will be added later
};

// Module groups state (expanded/collapsed)
let groupState = {};

// Initialize module groups
function initializeModuleGroups() {
    console.log("[ModuleGrouping] Organizing modules into groups");
    
    // Load saved group state
    loadGroupState();
    
    // Organize modules into groups
    organizeModulesIntoGroups();
    
    // Add styles for the grouping system
    addModuleGroupingStyles();
    
    // Setup observer for dynamic changes
    setupModuleObserver();
}

// Load group state from storage
function loadGroupState() {
    const savedState = sessionStorage.getItem('moduleGroupState');
    if (savedState) {
        try {
            groupState = JSON.parse(savedState);
            console.log("[ModuleGrouping] Loaded group state:", groupState);
        } catch (error) {
            console.error("[ModuleGrouping] Error parsing saved group state:", error);
            groupState = {};
        }
    } else {
        // Initialize with all groups expanded
        Object.keys(moduleGroups).forEach(group => {
            groupState[group] = true; // true = expanded, false = collapsed
        });
    }
}

// Save group state to storage
function saveGroupState() {
    sessionStorage.setItem('moduleGroupState', JSON.stringify(groupState));
}

// Organize modules into their respective groups
function organizeModulesIntoGroups() {
    const modulesContainer = document.getElementById('modules-container');
    
    if (!modulesContainer) {
        console.error("[ModuleGrouping] Modules container not found");
        return;
    }
    
    // Create a document fragment to build the new structure
    const fragment = document.createDocumentFragment();
    
    // Get all current modules before we start modifying the DOM
    const allModuleElements = Array.from(document.querySelectorAll('.module-item'));
    
    // Process each predefined group
    Object.keys(moduleGroups).forEach(groupName => {
        // Create the group header
        const groupHeader = createGroupHeader(groupName);
        fragment.appendChild(groupHeader);
        
        // Process child modules for this group
        const groupModuleIds = moduleGroups[groupName];
        
        // Find modules that belong to this group
        groupModuleIds.forEach(moduleId => {
            // Find the module element
            const moduleElement = allModuleElements.find(el => 
                el.getAttribute('data-module-id') === moduleId
            );
            
            if (moduleElement) {
                // Clone to remove existing event listeners
                const clonedModule = moduleElement.cloneNode(true);
                
                // Apply styling
                clonedModule.style.paddingLeft = '40px';
                
                // Set display based on group state
                if (groupState[groupName] === false) {
                    clonedModule.style.display = 'none';
                }
                
                // Add to fragment
                fragment.appendChild(clonedModule);
                
                // Mark as processed so we don't include it again
                moduleElement.setAttribute('data-processed', 'true');
            }
        });
    });
    
    // Find modules that don't belong to any predefined group
    const ungroupedModules = allModuleElements.filter(module => 
        !module.hasAttribute('data-processed')
    );
    
    // If there are ungrouped modules, add them without a header
    ungroupedModules.forEach(module => {
        // Clone to remove existing event listeners
        const clonedModule = module.cloneNode(true);
        fragment.appendChild(clonedModule);
    });
    
    // Clear the container and add the new structure
    modulesContainer.innerHTML = '';
    modulesContainer.appendChild(fragment);
    
    // Reattach event listeners
    reattachModuleEventListeners();
    
    console.log("[ModuleGrouping] Module organization complete");
}

// Create a group header element
function createGroupHeader(groupName) {
    const isCollapsed = groupState[groupName] === false;
    
    const header = document.createElement('div');
    header.className = 'module-group-header';
    header.textContent = isCollapsed ? `▸ ${groupName}` : groupName;
    header.dataset.group = groupName;
    header.style.cssText = `
        background-color: #4eca8b;
        color: white;
        padding: 8px 20px;
        font-weight: bold;
        cursor: pointer;
        margin-top: 5px;
        user-select: none;
    `;
    
    // Add indicator icon if not already present
    if (!header.textContent.includes('▸') && !header.textContent.includes('▾')) {
        // Add dropdown indicator
        const indicator = document.createElement('span');
        indicator.className = 'group-indicator';
        indicator.textContent = ' ▾';
        indicator.style.cssText = 'float: right;';
        header.appendChild(indicator);
    }
    
    // Add click handler to collapse/expand the group
    header.addEventListener('click', toggleGroupVisibility);
    
    return header;
}

// Toggle visibility of modules in a group
function toggleGroupVisibility() {
    const groupName = this.dataset.group;
    const isCurrentlyExpanded = groupState[groupName] !== false;
    
    // Toggle state
    groupState[groupName] = !isCurrentlyExpanded;
    
    // Update indicator
    if (isCurrentlyExpanded) {
        // Changing to collapsed
        this.textContent = `▸ ${groupName}`;
    } else {
        // Changing to expanded
        this.textContent = groupName;
        // Add dropdown indicator
        const indicator = document.createElement('span');
        indicator.className = 'group-indicator';
        indicator.textContent = ' ▾';
        indicator.style.cssText = 'float: right;';
        this.appendChild(indicator);
    }
    
    // Get all modules in this group
    const groupModules = moduleGroups[groupName] || [];
    
    // Toggle visibility of children
    groupModules.forEach(moduleId => {
        const moduleElement = document.querySelector(`.module-item[data-module-id="${moduleId}"]`);
        if (moduleElement) {
            moduleElement.style.display = isCurrentlyExpanded ? 'none' : 'flex';
        }
    });
    
    // Save updated state
    saveGroupState();
}

// Add CSS for the grouping system
function addModuleGroupingStyles() {
    if (!document.getElementById('module-grouping-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'module-grouping-styles';
        styleElement.textContent = `
            .module-group-header {
                background-color: #4eca8b;
                color: white;
                padding: 8px 20px;
                font-weight: bold;
                cursor: pointer;
                margin-top: 5px;
                user-select: none;
            }
            
            .module-group-header:hover {
                background-color: #3db97a;
            }
        `;
        document.head.appendChild(styleElement);
    }
}

// Observer to handle dynamically added modules
function setupModuleObserver() {
    // Create a MutationObserver to watch for new modules being added
    const observer = new MutationObserver(function(mutations) {
        let shouldReorganize = false;
        
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && 
                (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
                shouldReorganize = true;
            }
        });
        
        if (shouldReorganize) {
            console.log("[ModuleGrouping] DOM changes detected, reorganizing modules");
            setTimeout(organizeModulesIntoGroups, 100);
        }
    });
    
    // Start observing the modules container
    const modulesContainer = document.getElementById('modules-container');
    if (modulesContainer) {
        observer.observe(modulesContainer, { childList: true });
        console.log("[ModuleGrouping] Module observer started");
    }
}

// Reattach event listeners to modules
function reattachModuleEventListeners() {
    // Re-initialize module click handlers
    const moduleItems = document.querySelectorAll('.module-item');
    moduleItems.forEach(module => {
        if (typeof setupModuleClickHandler === 'function') {
            setupModuleClickHandler(module);
        } else {
            // Basic click handler if the main function isn't available
            setupDefaultModuleClickHandler(module);
        }
    });
    
    // Re-initialize drag and drop if available
    if (typeof setupDragAndDrop === 'function') {
        setupDragAndDrop();
    }
    
    // Re-initialize dropdowns if available
    if (typeof setupDropdownMenus === 'function') {
        setupDropdownMenus();
    } else {
        // Basic dropdown setup
        setupBasicDropdowns();
    }
    
    console.log("[ModuleGrouping] Event listeners reattached to modules");
}

// Setup default module click handler (if main function not available)
function setupDefaultModuleClickHandler(moduleElement) {
    const moduleText = moduleElement.querySelector('span');
    if (moduleText) {
        moduleText.addEventListener('click', function() {
            const moduleId = moduleElement.getAttribute('data-module-id');
            const requiresClient = moduleElement.getAttribute('data-requires-client') === 'true';
            
            if (requiresClient) {
                // Verify client is selected
                const client = window.ConstructionApp && 
                              window.ConstructionApp.ClientManager && 
                              window.ConstructionApp.ClientManager.getCurrentClient();
                
                if (!client) {
                    alert("Please select or create a client first to access this module.");
                    return;
                }
                
                // Set navigation state before navigating
                sessionStorage.setItem('navigationState', 'fromDashboard');
                
                // Save current client to sessionStorage
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

// Setup basic dropdowns (if main function not available)
function setupBasicDropdowns() {
    document.querySelectorAll('.module-icon').forEach(icon => {
        icon.addEventListener('click', function(e) {
            e.stopPropagation();
            const dropdown = this.querySelector('.dropdown-menu');
            if (dropdown) {
                // Close other open dropdowns
                document.querySelectorAll('.dropdown-menu').forEach(menu => {
                    if (menu !== dropdown && menu.style.display === 'block') {
                        menu.style.display = 'none';
                    }
                });
                
                // Toggle this dropdown
                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
            }
        });
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function() {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.style.display = 'none';
        });
    });
}
