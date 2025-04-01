// hierarchical-modules.js - Adds support for hierarchical module organization (DEBUG VERSION)

// Create global namespace for the hierarchical modules functionality
window.HierarchicalModules = {};

(function() {
    console.log('HIERARCHICAL MODULES SCRIPT LOADED'); // Debug message
    
    // Make functions available globally for debugging
    window.HierarchicalModules = {
        setupHierarchy: function() {
            console.log('Manual hierarchy setup triggered');
            addHierarchicalModulesCSS();
            setupModuleHierarchy();
        },
        
        // Show the current state of the module system
        debugModules: function() {
            console.log('Current modules in appData:', window.appData?.modules);
            console.log('Module elements in DOM:', document.querySelectorAll('.module-item').length);
            
            // List all modules in the DOM
            const moduleItems = document.querySelectorAll('.module-item');
            console.log('Module elements:');
            moduleItems.forEach(item => {
                const id = item.getAttribute('data-module-id');
                const name = item.querySelector('span')?.textContent || 'Unknown';
                console.log(`- ${id}: ${name}`);
            });
        }
    };
    
    // Try to run immediately
    try {
        console.log('Trying immediate setup');
        addHierarchicalModulesCSS();
        
        // Check if DOM is ready
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            console.log('DOM is ready, setting up immediately');
            setupModuleHierarchy();
        }
    } catch (e) {
        console.error('Error during immediate setup:', e);
    }
    
    // Also set up on DOMContentLoaded for safety
    document.addEventListener('DOMContentLoaded', function() {
        console.log('DOM content loaded, setting up hierarchy');
        try {
            setupModuleHierarchy();
        } catch (e) {
            console.error('Error during DOMContentLoaded setup:', e);
        }
    });
    
    // Also try again after a delay to make sure everything is loaded
    setTimeout(function() {
        console.log('Delayed setup running');
        try {
            setupModuleHierarchy();
        } catch (e) {
            console.error('Error during delayed setup:', e);
        }
    }, 1000);
    
    // Add CSS styles for hierarchical modules
    function addHierarchicalModulesCSS() {
        console.log('Adding hierarchical CSS');
        
        // Check if our style already exists
        if (document.getElementById('hierarchical-modules-style')) {
            console.log('CSS already added');
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'hierarchical-modules-style';
        style.textContent = `
            /* Parent module styles */
            .module-item.parent-module {
                background-color: #4eca8b !important;
                color: white !important;
                font-weight: bold !important;
            }
            
            .module-item.parent-module:hover {
                background-color: #3db97a !important;
            }
            
            /* Child module styles */
            .module-item.child-module {
                padding-left: 40px !important;
            }
            
            /* Expand/collapse indicator */
            .module-expand-indicator {
                display: inline-block;
                width: 16px;
                text-align: center;
                margin-right: 5px;
                cursor: pointer;
            }
            
            /* Module group container (for children) */
            .module-group-container {
                overflow: hidden;
                max-height: 0;
                transition: max-height 0.2s ease-out;
            }
            
            .module-group-container.expanded {
                max-height: 500px; /* Large enough to fit all children */
            }
        `;
        document.head.appendChild(style);
        console.log('CSS added successfully');
    }
    
    // Set up the module hierarchy
    function setupModuleHierarchy() {
        console.log('[Hierarchy] Setting up module hierarchy');
        
        // Make sure modules container exists
        const modulesContainer = document.getElementById('modules-container');
        if (!modulesContainer) {
            console.error('[Hierarchy] ERROR: Modules container not found!');
            return;
        }
        console.log('[Hierarchy] Found modules container with children:', modulesContainer.children.length);
        
        // Define parent modules and their children
        const moduleHierarchy = {
            'foundations': {
                name: 'Foundations',
                requiresClient: true,
                children: [
                    'foundations-excavation',
                    'foundations-concrete',
                    'foundations-steel'
                ]
            }
            // Add more parent modules as needed in the future
        };
        
        // Check if the expected child modules exist
        const existingModuleIds = [];
        document.querySelectorAll('.module-item').forEach(item => {
            const id = item.getAttribute('data-module-id');
            if (id) existingModuleIds.push(id);
        });
        console.log('[Hierarchy] Existing module IDs:', existingModuleIds);
        
        // Process each parent module
        Object.keys(moduleHierarchy).forEach(parentId => {
            createParentModuleWithChildren(parentId, moduleHierarchy[parentId]);
        });
        
        console.log('[Hierarchy] Setup completed');
    }
    
    // Create a parent module with its children in the sidebar
    function createParentModuleWithChildren(parentId, parentData) {
        const modulesContainer = document.getElementById('modules-container');
        if (!modulesContainer) {
            console.error('[Hierarchy] Modules container not found');
            return;
        }
        
        // Check if this parent module already exists
        let parentModule = modulesContainer.querySelector(`[data-module-id="${parentId}"]`);
        
        // If parent doesn't exist, create it
        if (!parentModule) {
            console.log(`[Hierarchy] Creating parent module: ${parentData.name}`);
            
            // Create parent module element
            parentModule = document.createElement('div');
            parentModule.className = 'module-item parent-module';
            parentModule.setAttribute('data-module-id', parentId);
            parentModule.setAttribute('data-requires-client', parentData.requiresClient ? 'true' : 'false');
            parentModule.setAttribute('data-is-parent', 'true');
            parentModule.draggable = true;
            
            // Create HTML for parent module
            parentModule.innerHTML = `
                <div class="module-drag-handle">≡</div>
                <div class="module-expand-indicator">▶</div>
                <div class="module-icon">
                    ...
                    <div class="dropdown-menu">
                        <div class="dropdown-item edit-module">Edit</div>
                        <div class="dropdown-item delete-module">Delete</div>
                    </div>
                </div>
                <span>${parentData.name}</span>
            `;
            
            // Add parent module to container
            modulesContainer.appendChild(parentModule);
            
            // Add click listener for expand/collapse
            const expandIndicator = parentModule.querySelector('.module-expand-indicator');
            if (expandIndicator) {
                expandIndicator.addEventListener('click', function(e) {
                    e.stopPropagation();
                    toggleModuleGroup(parentId);
                });
            }
            
            // Add parent module to appData.modules if not already there
            if (window.appData && !window.appData.modules.some(m => m.id === parentId)) {
                console.log(`[Hierarchy] Adding ${parentId} to appData.modules`);
                window.appData.modules.push({
                    id: parentId,
                    name: parentData.name,
                    requiresClient: parentData.requiresClient,
                    isParent: true,
                    childModules: parentData.children,
                    renderTemplate: function(client) {
                        // Create a template that displays info from child modules
                        return createParentModuleTemplate(parentId, parentData, client);
                    },
                    saveData: function() {
                        // Parent modules don't save data directly
                        return {};
                    }
                });
            }
            
            // Setup event listeners for the parent module
            if (window.setupModuleEventListeners) {
                console.log('[Hierarchy] Setting up event listeners for parent');
                window.setupModuleEventListeners(parentModule);
            } else {
                console.warn('[Hierarchy] setupModuleEventListeners not found, using fallback');
                setupModuleClickHandler(parentModule);
            }
        } else {
            console.log(`[Hierarchy] Parent module ${parentId} already exists`);
        }
        
        // Create container for child modules
        let groupContainer = document.getElementById(`${parentId}-group`);
        if (!groupContainer) {
            console.log(`[Hierarchy] Creating group container for ${parentId}`);
            groupContainer = document.createElement('div');
            groupContainer.id = `${parentId}-group`;
            groupContainer.className = 'module-group-container';
            
            // Insert after the parent module
            if (parentModule.nextSibling) {
                modulesContainer.insertBefore(groupContainer, parentModule.nextSibling);
            } else {
                modulesContainer.appendChild(groupContainer);
            }
        }
        
        // Process each child module
        let childrenFound = 0;
        parentData.children.forEach(childId => {
            // Find the child module in the modules list
            const childElement = modulesContainer.querySelector(`[data-module-id="${childId}"]`);
            
            if (childElement) {
                childrenFound++;
                console.log(`[Hierarchy] Found child module: ${childId}`);
                // Mark as child and move to group container
                childElement.classList.add('child-module');
                childElement.setAttribute('data-parent-id', parentId);
                groupContainer.appendChild(childElement);
            } else {
                console.warn(`[Hierarchy] Child module not found: ${childId}`);
            }
        });
        
        console.log(`[Hierarchy] Found ${childrenFound} of ${parentData.children.length} children`);
        
        // If we have children, expand the group initially
        if (childrenFound > 0) {
            console.log(`[Hierarchy] Expanding group for ${parentId}`);
            toggleModuleGroup(parentId);
        }
    }
    
    // Create a template for the parent module
    function createParentModuleTemplate(parentId, parentData, client) {
        // Get data from child modules
        let totalCost = 0;
        let childrenContent = '';
        
        if (client && client.moduleData) {
            parentData.children.forEach(childId => {
                if (client.moduleData[childId]) {
                    const moduleData = client.moduleData[childId];
                    
                    // Calculate cost from child module
                    let moduleCost = 0;
                    if (moduleData.totalCost !== undefined) {
                        moduleCost = parseFloat(moduleData.totalCost) || 0;
                    } else if (moduleData.items && Array.isArray(moduleData.items)) {
                        moduleData.items.forEach(item => {
                            if (item.qty > 0) {
                                moduleCost += (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
                            }
                        });
                    }
                    
                    totalCost += moduleCost;
                    
                    // Get module name
                    let moduleName = childId;
                    const moduleInfo = window.appData.modules.find(m => m.id === childId);
                    if (moduleInfo) {
                        moduleName = moduleInfo.name;
                    }
                    
                    // Format for display
                    if (moduleCost > 0) {
                        const formattedCost = window.ConstructionApp.ModuleUtils.formatCurrency(moduleCost);
                        childrenContent += `
                            <tr>
                                <td>${moduleName}</td>
                                <td style="text-align: right">${formattedCost}</td>
                                <td>
                                    <button class="btn" style="padding: 2px 8px; font-size: 0.8em;" 
                                            onclick="window.location.href='${childId}.html'">
                                        View
                                    </button>
                                </td>
                            </tr>
                        `;
                    }
                }
            });
        }
        
        // Format the total cost
        const formattedTotal = window.ConstructionApp.ModuleUtils.formatCurrency(totalCost);
        
        // Return the template
        return `
            <h3>${parentData.name}</h3>
            <p>Total cost: <span style="font-size: 1.2em; font-weight: bold; color: #4eca8b;">${formattedTotal}</span></p>
            
            <div style="margin-top: 20px;">
                <h4>Components</h4>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="text-align: left;">Module</th>
                            <th style="text-align: right;">Cost</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${childrenContent || '<tr><td colspan="3">No data available</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    // Toggle a module group's visibility
    function toggleModuleGroup(parentId) {
        console.log(`[Hierarchy] Toggling group for ${parentId}`);
        const groupContainer = document.getElementById(`${parentId}-group`);
        const parentModule = document.querySelector(`[data-module-id="${parentId}"]`);
        const expandIndicator = parentModule?.querySelector('.module-expand-indicator');
        
        if (groupContainer && expandIndicator) {
            if (groupContainer.classList.contains('expanded')) {
                // Collapse
                groupContainer.classList.remove('expanded');
                expandIndicator.textContent = '▶';
                console.log(`[Hierarchy] Collapsed group for ${parentId}`);
            } else {
                // Expand
                groupContainer.classList.add('expanded');
                expandIndicator.textContent = '▼';
                console.log(`[Hierarchy] Expanded group for ${parentId}`);
            }
        } else {
            console.warn(`[Hierarchy] Could not find group container or indicator for ${parentId}`);
        }
    }
    
    // Fallback click handler for parent modules
    function setupModuleClickHandler(moduleElement) {
        if (moduleElement.classList.contains('parent-module')) {
            const moduleText = moduleElement.querySelector('span');
            if (moduleText) {
                moduleText.addEventListener('click', function() {
                    const moduleId = moduleElement.getAttribute('data-module-id');
                    const requiresClient = moduleElement.getAttribute('data-requires-client') === 'true';
                    
                    if (requiresClient) {
                        // Verify client is selected
                        if (window.ConstructionApp.ClientManager) {
                            const client = window.ConstructionApp.ClientManager.getCurrentClient();
                            if (!client) {
                                alert("Please select or create a client first to access this module.");
                                return;
                            }
                            
                            // Set navigation state before navigating
                            sessionStorage.setItem('navigationState', 'fromDashboard');
                            
                            // Save current client to sessionStorage
                            sessionStorage.setItem('currentClient', JSON.stringify(client));
                        }
                        
                        // Navigate to the module
                        window.location.href = moduleId + '.html';
                    } else {
                        // For non-client modules, just navigate directly
                        window.location.href = moduleId + '.html';
                    }
                });
            }
        }
    }
})();

// Add a debug notification at the bottom of the page
(function() {
    const debugNotice = document.createElement('div');
    debugNotice.style.position = 'fixed';
    debugNotice.style.bottom = '10px';
    debugNotice.style.left = '10px';
    debugNotice.style.backgroundColor = '#4eca8b';
    debugNotice.style.color = 'white';
    debugNotice.style.padding = '10px';
    debugNotice.style.borderRadius = '5px';
    debugNotice.style.zIndex = '9999';
    debugNotice.style.fontSize = '12px';
    debugNotice.textContent = 'Hierarchical Modules Loaded';
    
    // Add a button to manually trigger setup
    const setupButton = document.createElement('button');
    setupButton.textContent = 'Setup Hierarchy';
    setupButton.style.marginLeft = '10px';
    setupButton.style.padding = '3px 8px';
    setupButton.style.backgroundColor = '#fff';
    setupButton.style.color = '#333';
    setupButton.style.border = 'none';
    setupButton.style.borderRadius = '3px';
    setupButton.style.cursor = 'pointer';
    
    setupButton.addEventListener('click', function() {
        window.HierarchicalModules.setupHierarchy();
    });
    
    debugNotice.appendChild(setupButton);
    
    // Add to body
    document.body.appendChild(debugNotice);
})();
