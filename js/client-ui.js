// js/client-ui.js
(function() {
    'use strict';

    // Ensure the main app namespace exists
    window.ConstructionApp = window.ConstructionApp || {};

    // --- Private Variables ---
    // Store reference to the main overlay element once found/created
    let clientModalOverlay = null;

    // --- Private Functions (Will be moved from dashboard.js) ---

    /**
     * Creates the HTML content for the client modal (New or Open).
     * @param {'new' | 'open'} type - The type of modal to create.
     * @returns {HTMLElement} The modal div element containing the content.
     */
    function createClientModal(type) {
        console.warn("[ClientUI] createClientModal needs to be moved/implemented here.");
        // --- Placeholder ---
        const modal = document.createElement('div');
        modal.className = 'modal'; // Basic modal class
        modal.style.padding = '20px'; // Basic styling
        modal.style.backgroundColor = 'white';
        modal.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 15px;">
                <h2 style="font-size: 1.3em;">${type === 'new' ? 'New Client' : 'Open Client'} (Placeholder)</h2>
                <span class="modal-close" style="cursor:pointer; font-size: 1.5em;" title="Close">&times;</span>
            </div>
            <div>Modal content for '${type}' will go here.</div>
            <div style="text-align: right; margin-top: 20px; border-top: 1px solid #ccc; padding-top: 15px;">
                <button class="btn btn-cancel" style="margin-right: 10px;">Cancel</button>
                ${type === 'new' ? '<button class="btn btn-save">Save Client</button>' : ''}
            </div>
        `;
        // We will attach specific listeners using helper functions after moving code
        // setupModalCloseButtons(modal, 'client-modal-overlay'); // Example call
        return modal;
    }

    /**
     * Adds event listeners to close buttons within a modal.
     * @param {HTMLElement} modal - The modal element containing the buttons.
     * @param {string} overlayId - The ID of the overlay to hide.
     */
    function setupModalCloseButtons(modal, overlayId) {
         console.warn("[ClientUI] setupModalCloseButtons needs to be moved/implemented here.");
         // --- Placeholder ---
         const closeBtns = modal.querySelectorAll('.modal-close, .btn-cancel');
         closeBtns.forEach(btn => {
             btn.addEventListener('click', () => {
                 const overlay = document.getElementById(overlayId);
                 if (overlay) overlay.style.display = 'none';
             });
         });
    }

    /**
     * Sets up filtering for the client list in the 'Open Client' modal.
     * @param {HTMLElement} modal - The modal element containing the list and search input.
     */
    function setupClientSearch(modal) {
         console.warn("[ClientUI] setupClientSearch needs to be moved/implemented here.");
    }

    /**
     * Sets up click listener for selecting a client from the list.
     * @param {HTMLElement} modal - The modal element containing the client list.
     */
    function setupClientListSelection(modal) {
         console.warn("[ClientUI] setupClientListSelection needs to be moved/implemented here.");
    }

    // --- Initialization Function ---

    /**
     * Sets up listeners for New/Open client buttons and ensures the modal overlay exists.
     * This function will be called once when the application loads.
     * (Logic moved from dashboard.js's setupClientManagement)
     */
    function initClientUI() {
        console.log("[ClientUI] Initializing...");

        const newClientBtn = document.getElementById('new-client-btn');
        const openClientBtn = document.getElementById('open-client-btn');
        // Find or create the single overlay for client modals
        clientModalOverlay = document.getElementById('client-modal-overlay');

        if (!clientModalOverlay) {
            console.warn("[ClientUI] Client modal overlay #client-modal-overlay not found in HTML, creating it.");
            clientModalOverlay = document.createElement('div');
            clientModalOverlay.className = 'modal-overlay';
            clientModalOverlay.id = 'client-modal-overlay';
            clientModalOverlay.style.display = 'none'; // Start hidden
            document.body.appendChild(clientModalOverlay);
            // Add click outside to close listener ONCE during initialization
            clientModalOverlay.addEventListener('click', (event) => {
                if (event.target === clientModalOverlay) { // Only if clicking the overlay itself
                    clientModalOverlay.style.display = 'none';
                }
            });
        }

        // Attach listener to "New Client" button
        if (newClientBtn) {
            newClientBtn.addEventListener('click', () => {
                console.log("[ClientUI] New Client button clicked.");
                const modalContent = createClientModal('new'); // Create the modal content
                clientModalOverlay.innerHTML = ''; // Clear previous modal content
                clientModalOverlay.appendChild(modalContent); // Add the new content
                clientModalOverlay.style.display = 'flex'; // Show the overlay
            });
        } else {
             console.warn("[ClientUI] New Client button #new-client-btn not found.");
        }

        // Attach listener to "Open Client" button
        if (openClientBtn) {
            openClientBtn.addEventListener('click', () => {
                 console.log("[ClientUI] Open Client button clicked.");
                 const modalContent = createClientModal('open'); // Create the modal content
                 clientModalOverlay.innerHTML = ''; // Clear previous modal content
                 clientModalOverlay.appendChild(modalContent); // Add the new content
                 clientModalOverlay.style.display = 'flex'; // Show the overlay
            });
        } else {
             console.warn("[ClientUI] Open Client button #open-client-btn not found.");
        }
         console.log("[ClientUI] Initialization complete.");
    }

    // --- Expose Public Interface ---
    window.ConstructionApp.ClientUI = {
        init: initClientUI
        // No other functions need to be public for now
    };

})(); // Immediately invoke the function
