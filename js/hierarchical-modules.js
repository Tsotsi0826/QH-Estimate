// hierarchical-modules.js - Adds support for hierarchical module organization

(function() {
    // Wait for DOM content to be loaded
    document.addEventListener('DOMContentLoaded', function() {
        // Add CSS for hierarchical modules
        addHierarchicalModulesCSS();
        
        // Set up parent modules and reorganize the sidebar
        setTimeout(setupModuleHierarchy, 100);
        
        // Set up drag and drop ordering that respects hierarchy
        enhanceDragAndDrop();
    });
    
    // Add CSS styles for hierarchical modules
    function addHierarchicalModulesCSS() {
        const style = document.createElement('style');
        style.textContent = `
            /* Parent module styles */
            .module-item.parent-module {
                background-color: #4eca8b;
                color: white;
                font-weight: bold;
            }
            
            .module-item.parent-module:hover {
                background-color: #3db97a;
            }
            
            /* Child module styles */
            .module-item.child-module {
                padding-left: 40px;
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
    }
    
    // Set up the module hierarchy
    function setupModuleHierarchy() {
        console.log('[Hierarchy] Setting up module hierarchy');
        
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
        
        // Process each parent module
        Object.keys(moduleHierarchy).forEach(parentId => {
            createParentModuleWithChildren(parentId, moduleHierarchy[parentId]);
        });
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
            setupModuleEventListeners(parentModule);
        }
        
        // Create container for child modules
        let groupContainer = document.getElementById(`${parentId}-group`);
        if (!groupContainer) {
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
        parentData.children.forEach(childId => {
            // Find the child module in the modules list
            const childElement = modulesContainer.querySelector(`[data-module-id="${childId}"]`);
            
            if (childElement) {
                // If it exists, move it to the group container and mark as child
                childElement.classList.add('child-module');
                childElement.setAttribute('data-parent-id', parentId);
                groupContainer.appendChild(childElement);
            }
        });
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
        const groupContainer = document.getElementById(`${parentId}-group`);
        const parentModule = document.querySelector(`[data-module-id="${parentId}"]`);
        const expandIndicator = parentModule?.querySelector('.module-expand-indicator');
        
        if (groupContainer && expandIndicator) {
            if (groupContainer.classList.contains('expanded')) {
                // Collapse
                groupContainer.classList.remove('expanded');
                expandIndicator.textContent = '▶';
            } else {
                // Expand
                groupContainer.classList.add('expanded');
                expandIndicator.textContent = '▼';
            }
        }
    }
    
    // Enhance drag and drop to respect hierarchy
    function enhanceDragAndDrop() {
        // This enhancement will be added if needed in the future
        // It would allow dragging modules while maintaining parent-child relationships
    }
    
    // Helper function to set up module event listeners
    function setupModuleEventListeners(moduleElement) {
        // Use the existing setupModuleEventListeners function if available
        if (window.setupModuleEventListeners) {
            window.setupModuleEventListeners(moduleElement);
        } else {
            // Simplified implementation if the original function isn't available
            // Click handler for parent modules
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
    }
})();
