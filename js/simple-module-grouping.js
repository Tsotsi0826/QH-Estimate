/**
 * Dynamic Module Grouping
 * 
 * A system to organize modules with parent-child relationships:
 * - Create main category modules and working modules
 * - Drag and drop modules to establish parent-child relationships
 * - Green headers for modules that have children
 * - Indentation for child modules
 */

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("[ModuleGrouping] Initializing dynamic module grouping");
    initializeModuleGroups();
});

// Module relationships storage
let moduleRelationships = {
    // Format: parentId: [childId1, childId2, ...]
};

// Initialize module groups
function initializeModuleGroups() {
    // Wait for modules to be fully loaded before organizing
    const checkModulesLoaded = setInterval(() => {
        const moduleItems = document.querySelectorAll('.module-item');
        if (moduleItems.length > 0) {
            clearInterval(checkModulesLoaded);
            console.log("[ModuleGrouping] Modules detected, initializing grouping system");
            
            // Load saved relationships
            loadModuleRelationships();
            
            // Enhance drag and drop functionality
            enhanceDragAndDrop();
            
            // Apply visual styling based on relationships
            applyModuleHierarchy();
            
            // Setup observer for dynamic changes
            setupModuleObserver();
        }
    }, 100);
}

// Load module relationships from storage
function loadModuleRelationships() {
    const savedRelationships = sessionStorage.getItem('moduleRelationships');
    if (savedRelationships) {
        try {
            moduleRelationships = JSON.parse(savedRelationships);
            console.log("[ModuleGrouping] Loaded module relationships:", moduleRelationships);
        } catch (error) {
            console.error("[ModuleGrouping] Error parsing saved relationships:", error);
            moduleRelationships = {};
        }
    } else {
        // Initialize with some common foundation modules as an example
        const foundationsModule = document.querySelector('.module-item[data-module-id="foundations"]');
        if (foundationsModule) {
            moduleRelationships = {
                "foundations": ["foundations-excavation", "foundations-concrete", "foundations-steel"]
            };
            saveModuleRelationships();
        }
    }
}

// Save module relationships to storage
function saveModuleRelationships() {
    sessionStorage.setItem('moduleRelationships', JSON.stringify(moduleRelationships));
    
    // Also save to Firebase if available
    if (window.ConstructionApp && window.ConstructionApp.Firebase) {
        window.ConstructionApp.Firebase.saveModuleRelationships(moduleRelationships)
            .then(() => {
                console.log("[ModuleGrouping] Saved module relationships to Firebase");
            })
            .catch(error => {
                console.error("[ModuleGrouping] Error saving relationships to Firebase:", error);
            });
    }
}

// Enhance drag and drop to support module hierarchy
function enhanceDragAndDrop() {
    const moduleItems = document.querySelectorAll('.module-item');
    
    moduleItems.forEach(module => {
        // Make all modules droppable (can receive other modules)
        module.addEventListener('dragover', handleModuleDragOver);
        module.addEventListener('dragleave', handleModuleDragLeave);
        module.addEventListener('drop', handleModuleDrop);
        
        // Add special visual behavior for parent modules
        if (isParentModule(module.getAttribute('data-module-id'))) {
            styleAsParentModule(module);
        }
    });
}

// Handle drag over for parent-child relationship
function handleModuleDragOver(event) {
    event.preventDefault();
    // Only add highlight if this could be a valid parent
    const draggedModuleId = event.dataTransfer.getData('text/plain') || 
                           document.querySelector('.dragging')?.getAttribute('data-module-id');
    
    if (draggedModuleId && draggedModuleId !== this.getAttribute('data-module-id')) {
        this.classList.add('potential-parent');
    }
}

// Handle drag leave for parent-child relationship
function handleModuleDragLeave(event) {
    this.classList.remove('potential-parent');
}

// Handle drop for parent-child relationship
function handleModuleDrop(event) {
    this.classList.remove('potential-parent');
    
    // Get the dragged module ID
    const draggedModuleId = event.dataTransfer.getData('text/plain') || 
                           document.querySelector('.dragging')?.getAttribute('data-module-id');
    
    if (!draggedModuleId) return;
    
    // Get the target (potential parent) module ID
    const targetModuleId = this.getAttribute('data-module-id');
    
    // Prevent dropping onto itself
    if (draggedModuleId === targetModuleId) return;
    
    // Check if Shift key is pressed - indicates creating a parent-child relationship
    if (event.shiftKey) {
        event.stopPropagation(); // Prevent regular reordering
        
        // Establish parent-child relationship
        addChildToParent(targetModuleId, draggedModuleId);
        
        // Apply visual updates
        applyModuleHierarchy();
        
        // Save the updated relationships
        saveModuleRelationships();
        
        console.log(`[ModuleGrouping] Added ${draggedModuleId} as child of ${targetModuleId}`);
    }
    // Otherwise let the regular drag and drop handle reordering
}

// Add a child module to a parent
function addChildToParent(parentId, childId) {
    // Initialize parent array if needed
    if (!moduleRelationships[parentId]) {
        moduleRelationships[parentId] = [];
    }
    
    // Add child if not already present
    if (!moduleRelationships[parentId].includes(childId)) {
        moduleRelationships[parentId].push(childId);
    }
    
    // Remove child from any other parent
    Object.keys(moduleRelationships).forEach(otherParentId => {
        if (otherParentId !== parentId) {
            const index = moduleRelationships[otherParentId].indexOf(childId);
            if (index !== -1) {
                moduleRelationships[otherParentId].splice(index, 1);
                
                // Clean up empty parents
                if (moduleRelationships[otherParentId].length === 0) {
                    delete moduleRelationships[otherParentId];
                }
            }
        }
    });
}

// Remove a child from its parent
function removeChildFromParent(childId) {
    Object.keys(moduleRelationships).forEach(parentId => {
        const index = moduleRelationships[parentId].indexOf(childId);
        if (index !== -1) {
            moduleRelationships[parentId].splice(index, 1);
            
            // Clean up empty parents
            if (moduleRelationships[parentId].length === 0) {
                delete moduleRelationships[parentId];
            }
            
            // Save the updated relationships
            saveModuleRelationships();
            
            console.log(`[ModuleGrouping] Removed ${childId} from parent ${parentId}`);
        }
    });
}

// Check if a module is a parent
function isParentModule(moduleId) {
    return moduleRelationships[moduleId] && moduleRelationships[moduleId].length > 0;
}

// Get the parent ID of a child module
function getParentModule(childId) {
    for (const parentId in moduleRelationships) {
        if (moduleRelationships[parentId].includes(childId)) {
            return parentId;
        }
    }
    return null;
}

// Style a module as a parent
function styleAsParentModule(moduleElement) {
    // Apply green background to indicate it's a parent
    moduleElement.style.backgroundColor = '#4eca8b';
    moduleElement.style.color = 'white';
    moduleElement.style.fontWeight = 'bold';
    
    // Add an indicator icon
    const moduleSpan = moduleElement.querySelector('span');
    if (moduleSpan && !moduleSpan.querySelector('.parent-indicator')) {
        const indicator = document.createElement('span');
        indicator.className = 'parent-indicator';
        indicator.textContent = ' ▾';
        indicator.style.marginLeft = '5px';
        moduleSpan.appendChild(indicator);
    }
    
    // Add collapse/expand functionality
    if (!moduleElement.hasAttribute('data-collapsible')) {
        moduleElement.setAttribute('data-collapsible', 'true');
        moduleElement.addEventListener('click', toggleChildrenVisibility);
    }
}

// Reset module styling
function resetModuleStyling(moduleElement) {
    moduleElement.style.backgroundColor = '';
    moduleElement.style.color = '';
    moduleElement.style.fontWeight = '';
    moduleElement.style.paddingLeft = '';
    
    // Remove indicator if present
    const indicator = moduleElement.querySelector('.parent-indicator');
    if (indicator) {
        indicator.remove();
    }
    
    // Remove collapse handler
    if (moduleElement.hasAttribute('data-collapsible')) {
        moduleElement.removeAttribute('data-collapsible');
        moduleElement.removeEventListener('click', toggleChildrenVisibility);
    }
}

// Toggle visibility of child modules
function toggleChildrenVisibility(event) {
    // Only proceed if clicking the module itself, not a child element
    if (event.target !== this && !event.target.classList.contains('parent-indicator')) {
        return;
    }
    
    const parentId = this.getAttribute('data-module-id');
    const isCollapsed = this.getAttribute('data-collapsed') === 'true';
    
    // Toggle collapsed state
    this.setAttribute('data-collapsed', !isCollapsed);
    
    // Update indicator
    const indicator = this.querySelector('.parent-indicator');
    if (indicator) {
        indicator.textContent = isCollapsed ? ' ▾' : ' ▸';
    }
    
    // Toggle visibility of children
    if (moduleRelationships[parentId]) {
        moduleRelationships[parentId].forEach(childId => {
            const childElement = document.querySelector(`.module-item[data-module-id="${childId}"]`);
            if (childElement) {
                childElement.style.display = isCollapsed ? 'flex' : 'none';
            }
        });
    }
}

// Apply module hierarchy styling
function applyModuleHierarchy() {
    // First reset all modules to default
    const allModules = document.querySelectorAll('.module-item');
    allModules.forEach(module => {
        resetModuleStyling(module);
    });
    
    // Style parent modules
    Object.keys(moduleRelationships).forEach(parentId => {
        const parentElement = document.querySelector(`.module-item[data-module-id="${parentId}"]`);
        if (parentElement && moduleRelationships[parentId].length > 0) {
            styleAsParentModule(parentElement);
        }
    });
    
    // Style and indent child modules
    allModules.forEach(module => {
        const moduleId = module.getAttribute('data-module-id');
        const parentId = getParentModule(moduleId);
        
        if (parentId) {
            // This is a child module
            module.style.paddingLeft = '40px';
        }
    });
    
    // Update context menu options
    updateContextMenuOptions();
}

// Update context menu options to include group actions
function updateContextMenuOptions() {
    const moduleItems = document.querySelectorAll('.module-item');
    
    moduleItems.forEach(module => {
        const moduleId = module.getAttribute('data-module-id');
        const dropdownMenu = module.querySelector('.dropdown-menu');
        
        if (dropdownMenu) {
            // Remove any existing group actions
            const existingActions = dropdownMenu.querySelectorAll('.group-action');
            existingActions.forEach(action => action.remove());
            
            // Add appropriate actions based on module status
            if (isParentModule(moduleId)) {
                // Parent module options
                const ungroup = document.createElement('div');
                ungroup.className = 'dropdown-item group-action ungroup-module';
                ungroup.textContent = 'Ungroup Children';
                ungroup.addEventListener('click', function(e) {
                    e.stopPropagation();
                    delete moduleRelationships[moduleId];
                    saveModuleRelationships();
                    applyModuleHierarchy();
                });
                
                dropdownMenu.appendChild(ungroup);
            } else if (getParentModule(moduleId)) {
                // Child module options
                const removeFromGroup = document.createElement('div');
                removeFromGroup.className = 'dropdown-item group-action remove-from-group';
                removeFromGroup.textContent = 'Remove from Group';
                removeFromGroup.addEventListener('click', function(e) {
                    e.stopPropagation();
                    removeChildFromParent(moduleId);
                    applyModuleHierarchy();
                });
                
                dropdownMenu.appendChild(removeFromGroup);
            }
        }
    });
}

// Observer to handle dynamically added modules
function setupModuleObserver() {
    // Create a MutationObserver to watch for new modules being added
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Check if we need to update
                const shouldUpdate = Array.from(mutation.addedNodes).some(node => {
                    return node.nodeType === 1 && node.classList.contains('module-item');
                });
                
                if (shouldUpdate) {
                    console.log("[ModuleGrouping] New modules detected, updating hierarchy");
                    setTimeout(() => {
                        enhanceDragAndDrop();
                        applyModuleHierarchy();
                    }, 100);
                }
            }
        });
    });
    
    // Start observing the modules container
    const modulesContainer = document.getElementById('modules-container');
    if (modulesContainer) {
        observer.observe(modulesContainer, { childList: true, subtree: true });
        console.log("[ModuleGrouping] Module observer started");
    }
}

// Add CSS for the grouping system
function addModuleGroupingStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .module-item.potential-parent {
            background-color: rgba(78, 202, 139, 0.3);
            box-shadow: inset 0 0 0 2px #4eca8b;
        }
        
        .module-group-header {
            background-color: #4eca8b;
            color: white;
            padding: 8px 20px;
            font-weight: bold;
            cursor: pointer;
            margin-top: 5px;
        }
    `;
    document.head.appendChild(styleElement);
}

// Initialize styles
document.addEventListener('DOMContentLoaded', function() {
    addModuleGroupingStyles();
});

// Add info popup to explain the new functionality
function addInfoPopup() {
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #4eca8b;
        color: white;
        padding: 15px;
        border-radius: 5px;
        max-width: 300px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 1000;
        font-size: 14px;
    `;
    
    popup.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px;">Module Grouping Tip</div>
        <p>To create groups, hold Shift while dragging a module onto another module.</p>
        <p>Green modules are parent modules with children underneath.</p>
        <p>Click a parent module to collapse/expand its children.</p>
        <div style="text-align: right; margin-top: 10px;">
            <button id="close-info-popup" style="background: white; color: #4eca8b; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Got it</button>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Close button handler
    document.getElementById('close-info-popup').addEventListener('click', function() {
        popup.remove();
        sessionStorage.setItem('moduleGroupingInfoSeen', 'true');
    });
}

// Show info popup once
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (sessionStorage.getItem('moduleGroupingInfoSeen') !== 'true') {
            addInfoPopup();
        }
    }, 2000);
});
