/**
 * Very Simple Module Grouping
 * - Makes category module text green
 * - Indents child modules
 * - No cell highlighting or backgrounds
 */

// Run when page loads
window.addEventListener('load', function() {
    console.log("Module grouping script running - v1.1");
    
    // Apply styling with delay to ensure modules are loaded
    setTimeout(styleModules, 500);
});

// Main styling function
function styleModules() {
    console.log("Applying module styling...");
    
    // Get all module items
    const modules = document.querySelectorAll('.module-item');
    console.log("Found " + modules.length + " modules");
    
    // Reset any existing styling first
    modules.forEach(function(module) {
        // Clear any background color that might have been applied
        module.style.backgroundColor = '';
    });
    
    // Process each module
    modules.forEach(function(module) {
        const moduleId = module.getAttribute('data-module-id');
        const moduleText = module.querySelector('span');
        
        if (!moduleId || !moduleText) return;
        
        // Style foundations module and its children
        if (moduleId === 'foundations') {
            // Main foundations module - green text only
            moduleText.style.color = '#4eca8b';
            moduleText.style.fontWeight = 'bold';
        }
        else if (moduleId.startsWith('foundations-')) {
            // Child foundations module - indented
            module.style.paddingLeft = '40px';
        }
        
        // Style brickwork module and its children
        if (moduleId === 'brickwork') {
            moduleText.style.color = '#4eca8b';
            moduleText.style.fontWeight = 'bold';
        }
        else if (moduleId.startsWith('brickwork-')) {
            module.style.paddingLeft = '40px';
        }
        
        // Style surfacebeds module and its children
        if (moduleId === 'surfacebeds') {
            moduleText.style.color = '#4eca8b';
            moduleText.style.fontWeight = 'bold';
        }
        else if (moduleId.startsWith('surfacebeds-')) {
            module.style.paddingLeft = '40px';
        }
        
        // Style plaster module and its children
        if (moduleId === 'plaster') {
            moduleText.style.color = '#4eca8b';
            moduleText.style.fontWeight = 'bold';
        }
        else if (moduleId.startsWith('plaster-')) {
            module.style.paddingLeft = '40px';
        }
        
        // Style floor module and its children
        if (moduleId === 'floor') {
            moduleText.style.color = '#4eca8b';
            moduleText.style.fontWeight = 'bold';
        }
        else if (moduleId.startsWith('floor-')) {
            module.style.paddingLeft = '40px';
        }
        
        // Style carpentry module and its children
        if (moduleId === 'carpentry') {
            moduleText.style.color = '#4eca8b';
            moduleText.style.fontWeight = 'bold';
        }
        else if (moduleId.startsWith('carpentry-')) {
            module.style.paddingLeft = '40px';
        }
    });
    
    console.log("Module styling complete");
}
