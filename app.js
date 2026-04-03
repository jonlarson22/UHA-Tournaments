import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    // PASTE YOUR EXISTING UHA CONFIG HERE
    apiKey: "...",
    authDomain: "...",
    databaseURL: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "..."
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Fetch players and render the checkbox list
const playerListDiv = document.getElementById('player-list');

onValue(ref(db, 'players'), (snapshot) => {
    const players = snapshot.val();
    document.getElementById('connection-status').innerText = "Connected to UHA DB";
    renderPlayerCheckboxes(players);
});

function renderPlayerCheckboxes(players) {
    playerListDiv.innerHTML = '';
    // Sort by ELO descending for easy seeding
    const sorted = Object.values(players).sort((a, b) => b.current_elo - a.current_elo);

    sorted.forEach(player => {
        const item = document.createElement('div');
        item.className = 'player-item';
        item.innerHTML = `
            <input type="checkbox" value="${player.id}" data-name="${player.name}" data-elo="${player.current_elo}">
            <span>${player.name} (${player.current_elo})</span>
        `;
        playerListDiv.appendChild(item);
    });
}
