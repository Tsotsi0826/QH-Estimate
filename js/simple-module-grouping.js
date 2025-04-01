/**
 * Very Simple Module Grouping
 */

// Run when page loads
window.addEventListener('load', function() {
    console.log("MODULE GROUPING SCRIPT IS RUNNING - VERSION 1.0");
    alert("Module grouping script is active!");
    
    // Apply initial styling with delay to ensure modules are loaded
    setTimeout(styleModules, 1000);
    
    // Also set up an interval to apply styling every 2 seconds
    setInterval(styleModules, 2000);
});

// Main styling function
function styleModules() {
    console.log("Applying module styling...");
    
    // Get all module items
    const modules = document.querySelectorAll('.module-item');
    console.log("Found " + modules.length + " modules");
    
    // Process each module
    modules.forEach(function(module) {
        const moduleId = module.getAttribute('data-module-id');
        const moduleText = module.querySelector('span');
        
        if (!moduleId || !moduleText) return;
        
        // Style foundations module and its children
        if (moduleId === 'foundations') {
            // Main foundations module - green text
            moduleText.style.color = 'lime';
            moduleText.style.fontWeight = 'bold';
        }
        else if (moduleId.startsWith('foundations-')) {
            // Child foundations module - indented
            module.style.paddingLeft = '40px';
        }
        
        // Style brickwork module and its children
        if (moduleId === 'brickwork') {
            moduleText.style.color = 'lime';
            moduleText.style.fontWeight = 'bold';
        }
        else if (moduleId.startsWith('brickwork-')) {
            module.style.paddingLeft = '40px';
        }
        
        // Style surfacebeds module and its children
        if (moduleId === 'surfacebeds') {
            moduleText.style.color = 'lime';
            moduleText.style.fontWeight = 'bold';
        }
        else if (moduleId.startsWith('surfacebeds-')) {
            module.style.paddingLeft = '40px';
        }
        
        // Style plaster module and its children
        if (moduleId === 'plaster') {
            moduleText.style.color = 'lime';
            moduleText.style.fontWeight = 'bold';
        }
        else if (moduleId.startsWith('plaster-')) {
            module.style.paddingLeft = '40px';
        }
        
        // Style floor module and its children
        if (moduleId === 'floor') {
            moduleText.style.color = 'lime';
            moduleText.style.fontWeight = 'bold';
        }
        else if (moduleId.startsWith('floor-')) {
            module.style.paddingLeft = '40px';
        }
        
        // Style carpentry module and its children
        if (moduleId === 'carpentry') {
            moduleText.style.color = 'lime';
            moduleText.style.fontWeight = 'bold';
        }
        else if (moduleId.startsWith('carpentry-')) {
            module.style.paddingLeft = '40px';
        }
    });
    
    console.log("Module styling complete");
}
