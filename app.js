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

let selectedPlayers = [];
let teams = [];

document.getElementById('add-team-btn').addEventListener('click', () => {
    const teamId = Date.now();
    const teamDiv = document.createElement('div');
    teamDiv.className = 'team-slot';
    teamDiv.id = `team-${teamId}`;
    teamDiv.innerHTML = `
        <div class="team-header">Team <span class="team-elo">0</span> ELO</div>
        <div class="slots" data-team-id="${teamId}"></div>
    `;
    document.getElementById('team-draft-area').appendChild(teamDiv);
});

playerListDiv.addEventListener('click', (e) => {
    const playerItem = e.target.closest('.player-item');
    if (!playerItem) return;

    const openSlot = document.querySelector('.team-slot:last-child .slots');
    if (openSlot && openSlot.children.length < 2) {
        openSlot.appendChild(playerItem);
        updateTeamElo(openSlot.closest('.team-slot'));
    } else {
        alert("Create a new team slot first (Max 2 players per team)!");
    }
});

function updateTeamElo(teamDiv) {
    const players = teamDiv.querySelectorAll('.player-item');
    let totalElo = 0;
    players.forEach(p => totalElo += parseInt(p.dataset.elo));
 
    const avgElo = players.length > 0 ? Math.round(totalElo / players.length) : 0;
    teamDiv.querySelector('.team-elo').innerText = avgElo;
    teamDiv.dataset.finalElo = avgElo;
}

import { BracketsViewer } from 'https://cdn.jsdelivr.net/npm/brackets-viewer@latest/dist/brackets-viewer.min.js';

const viewer = new BracketsViewer();

document.getElementById('btn-start').addEventListener('click', async () => {
    const teamElements = document.querySelectorAll('.team-slot');
    const participants = Array.from(teamElements).map(t => ({
        name: Array.from(t.querySelectorAll('.player-item')).map(p => p.dataset.name).join(' / '),
        elo: parseInt(t.dataset.finalElo)
    }));

    const tourneyData = await engine.createRoundRobin("Qualifying Groups", participants);
    
    document.getElementById('setup-container').style.display = 'none';
    document.getElementById('tournament-view').style.display = 'block';

    viewer.render({
        stages: [tourneyData.stage],
        matches: tourneyData.matches,
        participants: tourneyData.participants
    });
});
