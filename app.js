import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
   apiKey: "AIzaSyCCV_WHA1Q7WKawfG68Y9z40xINVg5zbmw",
   authDomain: "utah-handball.firebaseapp.com",
   databaseURL: "https://utah-handball-default-rtdb.firebaseio.com",
   projectId: "utah-handball",
   storageBucket: "utah-handball.firebasestorage.app",
   messagingSenderId: "4109545863",
   appId: "1:4109545863:web:6a6de7f532be0bc20f2322"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const playerListDiv = document.getElementById('player-list');

onValue(ref(db, 'players'), (snapshot) => {
    const players = snapshot.val();
    document.getElementById('connection-status').innerText = "Connected to UHA DB";
    renderPlayerCheckboxes(players);
});

function renderPlayerCheckboxes(players) {
    playerListDiv.innerHTML = '';

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

import { TournamentEngine } from './bracket-engine.js';
const engine = new TournamentEngine(db);

document.getElementById('btn-start').addEventListener('click', () => {
    const selected = Array.from(document.querySelectorAll('#player-list input:checked')).map(cb => ({
        id: cb.value,
        name: cb.dataset.name,
        elo: parseInt(cb.dataset.elo)
    }));

    if (selected.length < 2) return alert("Select more players!");

    engine.createRoundRobin("Group Stage", selected).then(stage => {
        console.log("Ready to render UI");
    });
});
