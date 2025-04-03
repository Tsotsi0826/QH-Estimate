// js/client-modals.js
// Handles the setup and interactions for the New Client and Open Client modals.

(function() {
    // Ensure the main app namespace exists
    window.ConstructionApp = window.ConstructionApp || {};

    // Helper to get elements - assuming E might be defined globally later, else use full document.getElementById
    const E = (id) => document.getElementById(id);

    /**
     * Sets up listeners for the "New Client" and "Open Client" buttons.
     */
    function setupClientManagement() {
        console.log("[ClientModals] Setting up client management buttons");
        const newClientBtn = E('new-client-btn');
        const openClientBtn = E('open-client-btn');
        let clientModalOverlay = E('client-modal-overlay');

        // Ensure the modal overlay exists in the DOM
        if (!clientModalOverlay) {
            console.warn("[ClientModals] Client modal overlay not found, creating it.");
            clientModalOverlay = document.createElement('div');
            clientModalOverlay.className = 'modal-overlay';
            clientModalOverlay.id = 'client-modal-overlay';
            clientModalOverlay.style.display = 'none'; // Start hidden
            document.body.appendChild(clientModalOverlay);
            // Add listener to close on overlay click
            clientModalOverlay.addEventListener('click', (event) => {
                if (event.target === clientModalOverlay) {
                    clientModalOverlay.style.display = 'none';
                }
            });
        }

        // New Client Button
        if (newClientBtn) {
            newClientBtn.addEventListener('click', () => {
                const overlay = E('client-modal-overlay');
                if (!overlay) { console.error("[ClientModals] Cannot open modal: Overlay not found."); return; }
                const clientModal = createClientModal('new');
                overlay.innerHTML = '';
                overlay.appendChild(clientModal);
                overlay.style.display = 'flex';
            });
        } else {
             console.warn("[ClientModals] 'New Client' button not found.");
        }

        // Open Client Button
        if (openClientBtn) {
            openClientBtn.addEventListener('click', () => {
                const overlay = E('client-modal-overlay');
                if (!overlay) { console.error("[ClientModals] Cannot open modal: Overlay not found."); return; }
                const clientModal = createClientModal('open');
                overlay.innerHTML = '';
                overlay.appendChild(clientModal);
                overlay.style.display = 'flex';
            });
        } else {
             console.warn("[ClientModals] 'Open Client' button not found.");
        }
    }

    /**
     * Creates the HTML content for the client modal (New or Open).
     * @param {string} type - 'new' or 'open'.
     * @returns {HTMLElement} The modal div element.
     */
    function createClientModal(type) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        const overlayId = 'client-modal-overlay';

        // Dependencies from global scope
        const ClientManager = window.ConstructionApp?.ClientManager;
        const DebugPanelUpdate = window.ConstructionApp?.DebugPanel?.update;

        if (type === 'new') {
            modal.innerHTML = `
                <div class="modal-header">
                    <h2 class="modal-title">New Client</h2>
                    <span class="modal-close" data-modal-id="${overlayId}">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="client-name">Client Name:</label>
                        <input type="text" id="client-name" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label for="client-address">Client Address:</label>
                        <input type="text" id="client-address" class="form-control">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-cancel" data-modal-id="${overlayId}">Cancel</button>
                    <button class="btn btn-save" id="save-new-client-btn">Save Client</button>
                </div>`;

            setTimeout(() => {
                setupModalCloseButtons(modal, overlayId);
                const saveBtn = modal.querySelector('#save-new-client-btn');
                if (saveBtn) {
                    saveBtn.addEventListener('click', () => {
                        const nameInput = modal.querySelector('#client-name');
                        const addressInput = modal.querySelector('#client-address');
                        if (!nameInput || !addressInput) return; // Element check
                        const name = nameInput.value.trim();
                        const address = addressInput.value.trim();

                        if (!name) { alert('Client name is required.'); nameInput.focus(); return; }

                        const newClientData = { name: name, address: address, moduleData: {} };
                        console.log("[ClientModals] Creating new client:", name);

                        if (ClientManager) {
                            ClientManager.addClient(newClientData, (success, result) => {
                                 if (success) {
                                      const addedClient = result;
                                      ClientManager.setCurrentClient(addedClient);
                                      if (DebugPanelUpdate) DebugPanelUpdate();
                                      alert(`Client "${name}" created and selected.`);
                                      const overlay = E(overlayId);
                                      if (overlay) overlay.style.display = 'none';
                                 } else {
                                      console.error("[ClientModals] Error adding client:", result);
                                      alert(`Error creating client: ${result || 'Unknown error'}`);
                                 }
                            });
                        } else { alert("Error: ClientManager is not available."); }
                    });
                }
            }, 0);

        } else if (type === 'open') {
            const clients = ClientManager?.getAllClients() || [];
            let clientListHTML = '';
            if (clients.length > 0) {
                clients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                clientListHTML = clients.map(client => `<div class="client-list-item" data-client-id="${client.id}">${client.name}</div>`).join('');
            } else {
                clientListHTML = '<div style="padding: 15px; text-align: center; color: #666;">No existing clients found.</div>';
            }

            modal.innerHTML = `
                <div class="modal-header">
                    <h2 class="modal-title">Open Client</h2>
                    <span class="modal-close" data-modal-id="${overlayId}">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="client-search">Search Clients:</label>
                        <input type="text" id="client-search" class="form-control" placeholder="Type to filter...">
                    </div>
                    <div class="client-list">${clientListHTML}</div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-cancel" data-modal-id="${overlayId}">Cancel</button>
                    </div>`;

            setTimeout(() => {
                setupModalCloseButtons(modal, overlayId);
                setupClientListSelection(modal);
                setupClientSearch(modal);
            }, 0);
        }
        return modal;
    }

    /**
     * Attaches close listeners to Cancel and X buttons within a modal.
     */
    function setupModalCloseButtons(modal, overlayId) {
        const closeBtns = modal.querySelectorAll(`.modal-close[data-modal-id="${overlayId}"], .btn-cancel[data-modal-id="${overlayId}"]`);
        closeBtns.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => {
                const overlay = E(overlayId);
                if (overlay) overlay.style.display = 'none';
                else console.error("[ClientModals] Overlay not found:", overlayId);
            });
        });
    }

    /**
     * Sets up the search functionality for the client list in the "Open Client" modal.
     */
    function setupClientSearch(modal) {
        const searchInput = modal.querySelector('#client-search');
        const clientListContainer = modal.querySelector('.client-list');
        if (searchInput && clientListContainer) {
            searchInput.addEventListener('input', () => {
                const searchTerm = searchInput.value.toLowerCase().trim();
                const clientItems = clientListContainer.querySelectorAll('.client-list-item');
                clientItems.forEach(item => {
                    if (item.dataset.clientId) {
                        const clientName = item.textContent.toLowerCase();
                        item.style.display = (searchTerm === '' || clientName.includes(searchTerm)) ? 'block' : 'none';
                    }
                });
            });
        }
    }

    /**
     * Sets up the click listener for selecting a client from the list in the "Open Client" modal.
     */
    function setupClientListSelection(modal) {
        const clientListContainer = modal.querySelector('.client-list');
        if (!clientListContainer) return;

        const ClientManager = window.ConstructionApp?.ClientManager;
        const DebugPanelUpdate = window.ConstructionApp?.DebugPanel?.update;

        clientListContainer.addEventListener('click', (event) => {
            const listItem = event.target.closest('.client-list-item');
            if (listItem && listItem.dataset.clientId) {
                const clientId = listItem.dataset.clientId;
                const clients = ClientManager?.getAllClients() || [];
                const selectedClient = clients.find(c => c.id === clientId);
                if (selectedClient) {
                    console.log("[ClientModals] Selecting client:", selectedClient.name);
                     if (ClientManager) {
                          ClientManager.setCurrentClient(selectedClient);
                          if (DebugPanelUpdate) DebugPanelUpdate();
                          const overlay = modal.closest('.modal-overlay');
                          if (overlay) overlay.style.display = 'none';
                          alert(`Client "${selectedClient.name}" selected.`);
                     } else { alert("Error: ClientManager not available."); }
                } else {
                    console.error("[ClientModals] Selected client ID not found:", clientId);
                    alert("Error: Could not find client data.");
                }
            }
        });
    }

    // Expose the setup function on the global namespace
    window.ConstructionApp.ClientModals = {
        setup: setupClientManagement
    };

})();
