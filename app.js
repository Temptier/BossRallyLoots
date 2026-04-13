// ==============================
// STATE MANAGEMENT
// ==============================

const state = {
    servers: [],
    currentServerId: null,
};

// ==============================
// STORAGE ADAPTERS
// ==============================

class LocalStorageAdapter {
    constructor(key = "timer_manager_data") {
        this.key = key;
    }

    load() {
        const data = localStorage.getItem(this.key);
        return data ? JSON.parse(data) : { servers: [] };
    }

    save(data) {
        localStorage.setItem(this.key, JSON.stringify(data));
    }
}

// Firebase scaffold (future-ready)
class FirebaseAdapter {
    constructor(config) {
        this.config = config;
    }

    async load() {
        console.warn("Firebase load not implemented yet");
        return { servers: [] };
    }

    async save(data) {
        console.warn("Firebase save not implemented yet");
    }
}

// Default adapter
let storage = new LocalStorageAdapter();

// ==============================
// INITIALIZATION
// ==============================

function init() {
    const data = storage.load();
    state.servers = data.servers || [];

    renderServers();
    bindEvents();
}

document.addEventListener("DOMContentLoaded", init);

// ==============================
// SERVER MANAGEMENT
// ==============================

function createServer(name = "New Server") {
    const newServer = {
        id: "srv_" + Date.now(),
        name,
        timers: [],
        config: {
            storageType: "local",
            firebaseConfig: null
        }
    };

    state.servers.push(newServer);
    state.currentServerId = newServer.id;

    persist();
    renderServers();
    renderTimers();
}

function switchServer(id) {
    state.currentServerId = id;
    renderServers();
    renderTimers();
}

function getCurrentServer() {
    return state.servers.find(s => s.id === state.currentServerId);
}

// ==============================
// TIMER MANAGEMENT
// ==============================

function addTimer(timerData) {
    const server = getCurrentServer();
    if (!server) return;

    const timer = {
        id: "tmr_" + Date.now(),
        ...timerData,
        createdAt: Date.now()
    };

    server.timers.push(timer);
    persist();
    renderTimers();
}

function deleteTimer(timerId) {
    const server = getCurrentServer();
    if (!server) return;

    server.timers = server.timers.filter(t => t.id !== timerId);
    persist();
    renderTimers();
}

// ==============================
// RENDERING
// ==============================

function renderServers() {
    const container = document.querySelector(".server-tabs");
    const label = document.getElementById("current-server-name");

    container.innerHTML = "";

    state.servers.forEach(server => {
        const tab = document.createElement("div");
        tab.className = "tab";
        if (server.id === state.currentServerId) {
            tab.classList.add("active");
            label.textContent = server.name;
        }

        tab.textContent = server.name;
        tab.onclick = () => switchServer(server.id);

        container.appendChild(tab);
    });

    if (!state.currentServerId) {
        label.textContent = "None";
    }
}

function renderTimers() {
    const container = document.getElementById("timers-view");
    const server = getCurrentServer();

    container.innerHTML = "";

    if (!server) {
        container.innerHTML = `<p class="placeholder">Select a server.</p>`;
        return;
    }

    if (server.timers.length === 0) {
        container.innerHTML = `<p class="placeholder">No timers yet.</p>`;
        return;
    }

    server.timers.forEach(timer => {
        const el = document.createElement("div");
        el.className = "timer-item";

        el.innerHTML = `
            <div>
                <strong>${timer.name}</strong><br>
                Type: ${timer.type} | Status: ${timer.status}
            </div>
            <div>
                <button data-id="${timer.id}">Delete</button>
            </div>
        `;

        el.querySelector("button").onclick = () => deleteTimer(timer.id);

        container.appendChild(el);
    });
}

// ==============================
// MODALS
// ==============================

const timerModal = document.getElementById("timer-modal");
const timerForm = document.getElementById("timer-form");

function openModal(modal) {
    modal.style.display = "flex";
}

function closeModal(modal) {
    modal.style.display = "none";
}

document.querySelectorAll(".close-button").forEach(btn => {
    btn.onclick = () => {
        btn.closest(".modal").style.display = "none";
    };
});

// ==============================
// EVENTS
// ==============================

function bindEvents() {
    document.getElementById("new-server-btn").onclick = () => {
        const name = prompt("Server name?");
        if (name) createServer(name);
    };

    document.getElementById("server-switcher").onclick = () => {
        alert("Use tabs to switch servers.");
    };

    document.getElementById("config-manager-btn").onclick = () => {
        openModal(document.getElementById("server-config-modal"));
    };

    // Open timer modal (you can add a button later)
    document.addEventListener("keydown", (e) => {
        if (e.key === "n") openModal(timerModal);
    });

    timerForm.onsubmit = (e) => {
        e.preventDefault();

        const data = {
            name: document.getElementById("timer-name").value,
            type: document.getElementById("timer-type").value,
            duration: Number(document.getElementById("timer-duration").value),
            group: document.getElementById("timer-group").value,
            serverId: document.getElementById("timer-server-id").value,
            status: document.getElementById("timer-status").value
        };

        addTimer(data);
        closeModal(timerModal);
        timerForm.reset();
    };

    // Storage mode switch
    document.getElementById("server-storageType").onchange = (e) => {
        const type = e.target.value;

        document.getElementById("local-storage-options").style.display =
            type === "local" ? "block" : "none";

        document.getElementById("firebase-storage-options").style.display =
            type === "firebase" ? "block" : "none";
    };
}

// ==============================
// PERSISTENCE
// ==============================

function persist() {
    storage.save({
        servers: state.servers
    });
}