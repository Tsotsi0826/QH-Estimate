/**
 * Module Hierarchy System
 * 
 * Organizes existing and new modules into headers and submodules
 */

// Run when page loads
window.addEventListener('load', function() {
    console.log("Module Hierarchy System initializing - v1.0");
    setTimeout(initializeSystem, 500);
});

// Global variables for module hierarchy
let moduleHeaders = {}; // Format: headerId: [moduleId1, moduleId2, ...]

// Initialize the system
function initializeSystem() {
    console.log("Initializing module hierarchy system");
    
    // First try to detect existing module relationships
    detectExistingModules();
    
    // Apply styling to existing modules
    applyModuleStyling();
    
    // Enhance the Add Module button
    enhanceAddModuleButton();
    
    // Add observer for dynamic updates
    setupMutationObserver();
}

// Detect existing modules and organize them
function detectExistingModules() {
    console.log("Detecting existing modules");
    
    // Clear existing data
    moduleHeaders = {};
    
    // Get all modules
    const allModules = document.querySelectorAll('.module-item');
    console.log(`Found ${allModules.length} total modules`);
    
    // First pass: find potential headers
    const potentialHeaders = [];
    const moduleMap = {};
    
    allModules.forEach(module => {
        const moduleId = module.getAttribute('data-module-id');
        if (!moduleId) return;
        
        // Store module in map for easy lookup
        moduleMap[moduleId] = module;
        
        // Check if this is a potential header (doesn't contain a dash)
        if (!moduleId.includes('-')) {
            potentialHeaders.push(moduleId);
        }
    });
    
    console.log(`Found ${potentialHeaders.length} potential headers`);
    
    // Second pass: assign child modules to headers
    potentialHeaders.forEach(headerId => {
        moduleHeaders[headerId] = [];
        
        // Find child modules (those starting with headerId + '-')
        allModules.forEach(module => {
            const moduleId = module.getAttribute('data-module-id');
            if (!moduleId) return;
            
            // Check if this module is a child of the current header
            if (moduleId !== headerId && moduleId.startsWith(headerId + '-')) {
                moduleHeaders[headerId].push(moduleId);
            }
        });
        
        console.log(`Header ${headerId} has ${moduleHeaders[headerId].length} child modules`);
    });
    
    // Save the hierarchy
    saveModuleHierarchy();
}

// Save module hierarchy to localStorage
function saveModuleHierarchy() {
    try {
        localStorage.setItem('moduleHierarchy', JSON.stringify(moduleHeaders));
    } catch (error) {
        console.error("Error saving module hierarchy:", error);
    }
}

// Load module hierarchy from localStorage
function loadModuleHierarchy() {
    try {
        const saved = localStorage.getItem('moduleHierarchy');
        if (saved) {
            moduleHeaders = JSON.parse(saved);
            return true;
        }
    } catch (error) {
        console.error("Error loading module hierarchy:", error);
    }
    return false;
}

// Apply styling to modules based on hierarchy
function applyModuleStyling() {
    // First reset all modules
    const allModules = document.querySelectorAll('.module-item');
    
    // Reset styles
    allModules.forEach(module => {
        const moduleText = module.querySelector('span');
        if (moduleText) {
            moduleText.style.color = '';
            moduleText.style.fontWeight = '';
        }
        module.style.paddingLeft = '';
        module.removeAttribute('data-is-header');
        module.removeAttribute('data-parent-header');
    });
    
    // Apply header styling
    Object.keys(moduleHeaders).forEach(headerId => {
        const headerModule = document.querySelector(`.module-item[data-module-id="${headerId}"]`);
        if (headerModule) {
            // Style header text
            const headerText = headerModule.querySelector('span');
            if (headerText) {
                headerText.style.color = '#4eca8b';
                headerText.style.fontWeight = 'bold';
            }
            
            // Mark as header
            headerModule.setAttribute('data-is-header', 'true');
            
            // Style children with indentation
            moduleHeaders[headerId].forEach(childId => {
                const childModule = document.querySelector(`.module-item[data-module-id="${childId}"]`);
                if (childModule) {
                    childModule.style.paddingLeft = '40px';
                    childModule.setAttribute('data-parent-header', headerId);
                }
            });
        }
    });
}

// Enhance Add Module button
function enhanceAddModuleButton() {
    const addButton = document.getElementById('add-module-btn');
    if (!addButton) {
        console.error("Add module button not found");
        return;
    }
    
    // Clone the button to remove any existing listeners
    const newButton = addButton.cloneNode(true);
    addButton.parentNode.replaceChild(newButton, addButton);
    
    // Add our custom click handler
    newButton.addEventListener('click', function() {
        showModuleTypePrompt();
    });
}

// Show prompt for module type selection
function showModuleTypePrompt() {
    // Create modal for selection
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-header">
            <h2 class="modal-title">Add New Module</h2>
            <span class="modal-close">&times;</span>
        </div>
        <div class="modal-body">
            <p>What type of module would you like to create?</p>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button id="create-header-btn" class="btn" style="flex: 1;">Header</button>
                <button id="create-module-btn" class="btn" style="flex: 1;">Module</button>
            </div>
        </div>
    `;
    
    // Create or get modal overlay
    let modalOverlay = document.querySelector('.modal-overlay');
    if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        document.body.appendChild(modalOverlay);
    }
    
    // Add modal to overlay
    modalOverlay.innerHTML = '';
    modalOverlay.appendChild(modal);
    modalOverlay.style.display = 'flex';
    
    // Set up close button
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', function() {
        modalOverlay.style.display = 'none';
    });
    
    // Close on outside click
    modalOverlay.addEventListener('click', function(e) {
        if (e.target === modalOverlay) {
            modalOverlay.style.display = 'none';
        }
    });
    
    // Header button
    const headerBtn = modal.querySelector('#create-header-btn');
    headerBtn.addEventListener('click', function() {
        modalOverlay.style.display = 'none';
        createNewHeader();
    });
    
    // Module button
    const moduleBtn = modal.querySelector('#create-module-btn');
    moduleBtn.addEventListener('click', function() {
        modalOverlay.style.display = 'none';
        createNewModule();
    });
}

// Create new header
function createNewHeader() {
    // Prompt for header name
    const headerName = prompt("Enter header name:");
    if (!headerName || headerName.trim() === '') return;
    
    // Create ID from name
    const headerId = headerName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    // Check if ID already exists
    if (document.querySelector(`.module-item[data-module-id="${headerId}"]`)) {
        alert(`A module with ID "${headerId}" already exists`);
        return;
    }
    
    // Use existing addNewModule function if available
    if (typeof window.addNewModule === 'function') {
        window.addNewModule(headerName, headerId, true, function() {
            // After module is created, add it to our headers
            moduleHeaders[headerId] = [];
            saveModuleHierarchy();
            applyModuleStyling();
        });
    } else {
        // Fallback implementation
        fallbackCreateModule(headerId, headerName, true);
        
        // Add to headers
        moduleHeaders[headerId] = [];
        saveModuleHierarchy();
        applyModuleStyling();
    }
}

// Create new regular module
function createNewModule() {
    // Prompt for module name
    const moduleName = prompt("Enter module name:");
    if (!moduleName || moduleName.trim() === '') return;
    
    // Create ID from name
    const moduleId = moduleName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    // Check if ID already exists
    if (document.querySelector(`.module-item[data-module-id="${moduleId}"]`)) {
        alert(`A module with ID "${moduleId}" already exists`);
        return;
    }
    
    // Check if we have headers to place this under
    const headers = Object.keys(moduleHeaders);
    if (headers.length > 0) {
        showHeaderSelectionModal(moduleId, moduleName);
    } else {
        // No headers, just create as standalone
        if (typeof window.addNewModule === 'function') {
            window.addNewModule(moduleName, moduleId, true);
        } else {
            fallbackCreateModule(moduleId, moduleName, true);
        }
    }
}

// Show header selection modal
function showHeaderSelectionModal(moduleId, moduleName) {
    // Create header options HTML
    let headerOptionsHtml = '';
    Object.keys(moduleHeaders).forEach(headerId => {
        const headerElement = document.querySelector(`.module-item[data-module-id="${headerId}"]`);
        const headerName = headerElement ? headerElement.querySelector('span').textContent : headerId;
        
        headerOptionsHtml += `
            <div class="header-option" data-header-id="${headerId}" style="padding: 10px; margin: 5px 0; cursor: pointer; border: 1px solid #ddd; border-radius: 4px;">
                ${headerName}
            </div>
        `;
    });
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-header">
            <h2 class="modal-title">Select Header</h2>
            <span class="modal-close">&times;</span>
        </div>
        <div class="modal-body">
            <p>Which header should this module be placed under?</p>
            <div style="max-height: 200px; overflow-y: auto; margin: 10px 0;">
                ${headerOptionsHtml}
            </div>
            <button id="no-header-btn" class="btn" style="width: 100%; margin-top: 10px;">None (Create as standalone module)</button>
        </div>
    `;
    
    // Create or get modal overlay
    let modalOverlay = document.querySelector('.modal-overlay');
    if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        document.body.appendChild(modalOverlay);
    }
    
    // Add modal to overlay
    modalOverlay.innerHTML = '';
    modalOverlay.appendChild(modal);
    modalOverlay.style.display = 'flex';
    
    // Set up close button
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', function() {
        modalOverlay.style.display = 'none';
    });
    
    // Close on outside click
    modalOverlay.addEventListener('click', function(e) {
        if (e.target === modalOverlay) {
            modalOverlay.style.display = 'none';
        }
    });
    
    // No header button
    const noHeaderBtn = modal.querySelector('#no-header-btn');
    noHeaderBtn.addEventListener('click', function() {
        modalOverlay.style.display = 'none';
        
        // Create standalone module
        if (typeof window.addNewModule === 'function') {
            window.addNewModule(moduleName, moduleId, true);
        } else {
            fallbackCreateModule(moduleId, moduleName, true);
        }
    });
    
    // Header options
    const headerOptions = modal.querySelectorAll('.header-option');
    headerOptions.forEach(option => {
        option.addEventListener('click', function() {
            modalOverlay.style.display = 'none';
            
            // Get selected header
            const headerId = this.getAttribute('data-header-id');
            
            // Create the module
            if (typeof window.addNewModule === 'function') {
                window.addNewModule(moduleName, moduleId, true, function() {
                    // After creation, add to header
                    addModuleToHeader(moduleId, headerId);
                    
                    // Reposition module after header
                    positionModuleAfterHeader(moduleId, headerId);
                });
            } else {
                fallbackCreateModule(moduleId, moduleName, true);
                addModuleToHeader(moduleId, headerId);
                positionModuleAfterHeader(moduleId, headerId);
            }
        });
    });
}

// Add module to header
function addModuleToHeader(moduleId, headerId) {
    if (!moduleHeaders[headerId]) {
        moduleHeaders[headerId] = [];
    }
    
    // Make sure it's not already there
    if (!moduleHeaders[headerId].includes(moduleId)) {
        moduleHeaders[headerId].push(moduleId);
    }
    
    // Save and apply styling
    saveModuleHierarchy();
    applyModuleStyling();
}

// Position a module visually after a header
function positionModuleAfterHeader(moduleId, headerId) {
    const moduleElement = document.querySelector(`.module-item[data-module-id="${moduleId}"]`);
    const headerElement = document.querySelector(`.module-item[data-module-id="${headerId}"]`);
    
    if (!moduleElement || !headerElement) return;
    
    // Find where to insert the module
    const headerChildren = moduleHeaders[headerId] || [];
    
    if (headerChildren.length <= 1) {
        // This is the first child, insert right after header
        headerElement.parentNode.insertBefore(moduleElement, headerElement.nextSibling);
    } else {
        // Insert after the last child of this header
        const lastChildId = headerChildren[headerChildren.length - 2]; // -2 because we just added the new module
        const lastChildElement = document.querySelector(`.module-item[data-module-id="${lastChildId}"]`);
        
        if (lastChildElement) {
            lastChildElement.parentNode.insertBefore(moduleElement, lastChildElement.nextSibling);
        } else {
            // Fallback to inserting after header
            headerElement.parentNode.insertBefore(moduleElement, headerElement.nextSibling);
        }
    }
}

// Fallback function to create a module if main app function isn't available
function fallbackCreateModule(moduleId, moduleName, requiresClient) {
    console.log(`Creating module ${moduleName} (${moduleId}) using fallback method`);
    
    // Create the element
    const moduleElement = document.createElement('div');
    moduleElement.className = 'module-item';
    moduleElement.draggable = true;
    moduleElement.setAttribute('data-module-id', moduleId);
    moduleElement.setAttribute('data-requires-client', requiresClient ? 'true' : 'false');
    
    moduleElement.innerHTML = `
        <div class="module-drag-handle">≡</div>
        <div class="module-icon">
            ...
            <div class="dropdown-menu">
                <div class="dropdown-item edit-module">Edit</div>
                <div class="dropdown-item delete-module">Delete</div>
            </div>
        </div>
        <span>${moduleName}</span>
    `;
    
    // Add to container
    const modulesContainer = document.getElementById('modules-container');
    if (modulesContainer) {
        modulesContainer.appendChild(moduleElement);
    }
    
    // Try to add module to app data if it exists
    if (window.appData && window.appData.modules) {
        window.appData.modules.push({
            id: moduleId,
            name: moduleName,
            requiresClient: requiresClient,
            renderTemplate: function(client) {
                return `<h3>${moduleName}</h3><p>This is a custom module.</p>`;
            },
            saveData: function() {
                return {};
            }
        });
    }
    
    return moduleElement;
}

// Set up mutation observer to track changes
function setupMutationObserver() {
    const observer = new MutationObserver(function(mutations) {
        let needsUpdate = false;
        
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                const addedModules = Array.from(mutation.addedNodes).filter(
                    node => node.nodeType === 1 && node.classList.contains('module-item')
                );
                
                const removedModules = Array.from(mutation.removedNodes).filter(
                    node => node.nodeType === 1 && node.classList.contains('module-item')
                );
                
                if (addedModules.length > 0 || removedModules.length > 0) {
                    needsUpdate = true;
                }
            }
        });
        
        if (needsUpdate) {
            console.log("Modules changed, updating styling");
            
            // Handle deleted modules if needed
            cleanupDeletedModules();
            
            // Update visuals
            applyModuleStyling();
        }
    });
    
    // Start observing
    const modulesContainer = document.getElementById('modules-container');
    if (modulesContainer) {
        observer.observe(modulesContainer, { childList: true });
    }
}

// Clean up references to deleted modules
function cleanupDeletedModules() {
    // Get all current module IDs
    const currentModuleIds = new Set();
    document.querySelectorAll('.module-item').forEach(module => {
        const id = module.getAttribute('data-module-id');
        if (id) currentModuleIds.add(id);
    });
    
    // Check for deleted headers
    Object.keys(moduleHeaders).forEach(headerId => {
        if (!currentModuleIds.has(headerId)) {
            // This header was deleted
            delete moduleHeaders[headerId];
        } else {
            // Check for deleted child modules
            moduleHeaders[headerId] = moduleHeaders[headerId].filter(
                childId => currentModuleIds.has(childId)
            );
        }
    });
    
    // Save changes
    saveModuleHierarchy();
}

// Handle module dragging to maintain hierarchy
document.addEventListener('dragend', function(e) {
    // Check if this was a module
    const moduleItem = e.target.closest('.module-item');
    if (!moduleItem) return;
    
    // Wait a moment for the DOM to update before fixing hierarchy
    setTimeout(function() {
        // Fix positioning of headers and their children
        fixModulePositioning();
        
        // Update styling
        applyModuleStyling();
    }, 100);
});

// Fix module positioning to keep headers and children together
function fixModulePositioning() {
    // Get all modules in their current order
    const modulesContainer = document.getElementById('modules-container');
    if (!modulesContainer) return;
    
    const currentOrder = Array.from(modulesContainer.querySelectorAll('.module-item'));
    
    // Process each header
    Object.keys(moduleHeaders).forEach(headerId => {
        const children = moduleHeaders[headerId];
        if (!children || children.length === 0) return;
        
        const headerElement = document.querySelector(`.module-item[data-module-id="${headerId}"]`);
        if (!headerElement) return;
        
        // Find header position
        const headerIndex = currentOrder.indexOf(headerElement);
        if (headerIndex === -1) return;
        
        // Get child elements in their current positions
        const childElements = children.map(childId => 
            document.querySelector(`.module-item[data-module-id="${childId}"]`)
        ).filter(Boolean);
        
        // Skip if no children found
        if (childElements.length === 0) return;
        
        // Determine where children should go (right after header)
        let insertPosition = headerElement;
        
        // Move each child to be after the insert position
        childElements.forEach(childElement => {
            // Skip if already in the right position
            if (childElement.nextSibling === insertPosition.nextSibling) return;
            
            // Move the child to be after the insert position
            insertPosition.parentNode.insertBefore(childElement, insertPosition.nextSibling);
            
            // Update insert position for next child
            insertPosition = childElement;
        });
    });
}

// Auto-detect foundation modules on first load
window.addEventListener('load', function() {
    setTimeout(function() {
        // Check if we already have saved data
        if (!loadModuleHierarchy()) {
            // Auto-detect foundations modules
            const foundationsModule = document.querySelector('.module-item[data-module-id="foundations"]');
            if (foundationsModule) {
                console.log("Found foundations module, auto-organizing children");
                
                // Initialize foundations as a header
                moduleHeaders.foundations = [];
                
                // Find all modules that start with "foundations-"
                document.querySelectorAll('.module-item').forEach(module => {
                    const moduleId = module.getAttribute('data-module-id');
                    if (moduleId && moduleId !== 'foundations' && moduleId.startsWith('foundations-')) {
                        moduleHeaders.foundations.push(moduleId);
                    }
                });
                
                // Save and apply styling
                saveModuleHierarchy();
                applyModuleStyling();
                
                // Fix positioning
                fixModulePositioning();
            }
        }
    }, 800);
});
