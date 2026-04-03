let isAdmin = false;

function adminLogin(email, password) {
    firebase.auth().signInWithEmailAndPassword(email, password)
      .then((userCredential) => {
        isAdmin = true;
        document.body.classList.add('admin-mode'); 
        showToast("Admin Verified!");
        refreshRosterFromDB(); 
      })
      .catch((error) => {
        alert("Access Denied: " + error.message);
      });
}

function checkAdmin() {
    if (isAdmin) {
        firebase.auth().signOut();
        isAdmin = false;
        document.body.classList.remove('admin-mode');
        showToast("Logged out.");
        refreshRosterFromDB();
        return;
    }
    const email = prompt("Admin Email:");
    const pass = prompt("Admin Password:");
    if (email && pass) adminLogin(email, pass);
}

function refreshRosterFromDB() {
    db.ref('players').once('value', (snapshot) => {
        const players = snapshot.val() || [];
        renderRoster(players);
        document.getElementById('connection-status').innerText = "Realtime Connected ✅";
    });
}

refreshRosterFromDB();

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
  
  if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
  }
  const db = firebase.database();
  const playerListDiv = document.getElementById('player-list');

  db.ref('players').on('value', (snapshot) => {
      const players = snapshot.val() || [];
      renderRoster(players);
  });
  
  function renderRoster(players) {
    const playerListDiv = document.getElementById('player-list');
    playerListDiv.innerHTML = '';
    
    const isDoubles = document.getElementById('tourney-type').value.includes('doubles');
    
    players.filter(p => p.active).sort((a, b) => {
        const ratingA = isDoubles ? (a.doubles || 1000) : (a.singles || 1000);
        const ratingB = isDoubles ? (b.doubles || 1000) : (b.singles || 1000);
        return ratingB - ratingA;
    }).forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.dataset.id = player.id;
        div.dataset.name = player.name;

        div.dataset.elo = isDoubles ? (player.doubles || 1000) : (player.singles || 1000);
        
        div.innerText = `${player.name} (${Math.round(div.dataset.elo)})`;
        playerListDiv.appendChild(div);
    });
}

  document.getElementById('add-team-btn').addEventListener('click', () => {
      const teamId = Date.now();
      const teamDiv = document.createElement('div');
      teamDiv.className = 'team-slot';
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
      }
  });
  
  function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.style.background = isError ? "#e74c3c" : "#2ecc71";
    
    toast.style.display = "block";
    setTimeout(() => { 
        toast.style.opacity = "1"; 
        toast.style.top = "20px";
    }, 10);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.top = "-50px";
        setTimeout(() => { toast.style.display = "none"; }, 300);
    }, 3000);
}

  function updateTeamElo(teamDiv) {
      const players = teamDiv.querySelectorAll('.player-item');
      let totalElo = 0;
      players.forEach(p => totalElo += parseFloat(p.dataset.elo));
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
