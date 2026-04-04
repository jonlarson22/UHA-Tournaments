// --- FIREBASE CONFIG (Kept exactly as provided) ---
const firebaseConfig = {
    apiKey: "AIzaSyCCV_WHA1Q7WKawfG68Y9z40xINVg5zbmw",
    authDomain: "utah-handball.firebaseapp.com",
    databaseURL: "https://utah-handball-default-rtdb.firebaseio.com",
    projectId: "utah-handball",
    storageBucket: "utah-handball.firebasestorage.app",
    messagingSenderId: "4109545863",
    appId: "1:4109545863:web:6a6de7f532be0bc20f2322"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- STATE MANAGEMENT ---
let allPlayers = []; 
let isDoublesMode = false;
let isAdmin = true;
let lockedDivisions = [];
let currentBracket = null; // Tracks the active tournament progression

// UI Elements
const teamDraftArea = document.getElementById('team-draft-area');
const playerListDiv = document.getElementById('player-list');
const searchInput = document.getElementById('player-search');
const draftHeader = document.getElementById('team-draft-area')?.previousElementSibling; // The <h3>

// Ensure panels display correctly
if (isAdmin) {
    document.getElementById('admin-dashboard').style.display = 'flex';
    document.getElementById('public-viewer').style.display = 'none';
} else {
    document.getElementById('admin-dashboard').style.display = 'none';
    document.getElementById('public-viewer').style.display = 'block';
}

// --- TOGGLES & LABELS ---
function updateLabels() {
    const draftTitle = document.querySelector('#admin-dashboard .uha-card:last-child h3');
    if (draftTitle) {
        draftTitle.innerText = isDoublesMode ? "Teams" : "Selected Players";
    }
    const rosterTitle = document.querySelector('#admin-dashboard .uha-card:nth-child(2) h3');
    if (rosterTitle) rosterTitle.innerText = "Players";
    
    const lockBtn = document.getElementById('btn-lock-division');
    if (lockBtn) lockBtn.innerText = "Division";
}

document.getElementById('btn-mode-singles').addEventListener('click', (e) => {
    isDoublesMode = false;
    e.target.style.background = '#3498db';
    document.getElementById('btn-mode-doubles').style.background = '#333';
    teamDraftArea.innerHTML = ''; 
    updateLabels();
    renderRoster();
});

document.getElementById('btn-mode-doubles').addEventListener('click', (e) => {
    isDoublesMode = true;
    e.target.style.background = '#3498db';
    document.getElementById('btn-mode-singles').style.background = '#333';
    teamDraftArea.innerHTML = ''; 
    updateLabels();
    renderRoster();
});

// --- ROSTER LOGIC ---
function refreshRosterFromDB() {
    db.ref('players').on('value', (snapshot) => {
        allPlayers = snapshot.val() || [];
        renderRoster();
        const connStatus = document.getElementById('connection-status');
        if(connStatus) connStatus.innerText = "Realtime Connected ✅";
    });
}

searchInput.addEventListener('input', renderRoster);

function getDraftedPlayerIds() {
    const draftedElements = Array.from(teamDraftArea.querySelectorAll('.drafted-id'));
    return draftedElements.map(p => p.dataset.id);
}

function renderRoster() {
    playerListDiv.innerHTML = '';
    const draftedIds = getDraftedPlayerIds();
    const searchTerm = searchInput.value.toLowerCase();

    let availablePlayers = allPlayers.filter(p => 
        p.active && 
        !draftedIds.includes(String(p.id)) &&
        p.name.toLowerCase().includes(searchTerm)
    );
    
    availablePlayers.sort((a, b) => {
        const ratingA = isDoublesMode ? (a.doubles || 1000) : (a.singles || 1000);
        const ratingB = isDoublesMode ? (b.doubles || 1000) : (b.singles || 1000);
        return ratingB - ratingA;
    });

    availablePlayers.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.style = "background: #252525; padding: 10px; margin-bottom: 5px; border-radius: 4px; cursor: pointer; display: flex; justify-content: space-between;";
        div.dataset.id = player.id;
        div.dataset.name = player.name;
        div.dataset.elo = isDoublesMode ? (player.doubles || 1000) : (player.singles || 1000);
        div.innerHTML = `<span>${player.name}</span> <span style="color:#3498db; font-weight:bold;">${Math.round(div.dataset.elo)}</span>`;
        div.onclick = () => addToDraft(div);
        playerListDiv.appendChild(div);
    });
}

// --- DRAFT LOGIC ---
function addToDraft(playerItem) {
    if (!isDoublesMode) {
        const singlesDiv = document.createElement('div');
        singlesDiv.className = 'singles-slot';
        singlesDiv.style = "background: #1e1e1e; padding: 15px; border-left: 4px solid #f1c40f; margin-bottom: 10px; display: flex; justify-content: space-between;";
        singlesDiv.dataset.finalName = playerItem.dataset.name;
        singlesDiv.dataset.finalElo = playerItem.dataset.elo;
        
        singlesDiv.innerHTML = `
            <div style="font-weight: bold;">${playerItem.dataset.name}</div>
            <div class="drafted-id" data-id="${playerItem.dataset.id}" style="display:none;"></div>
            <button class="remove-team-btn" style="background:none; border:none; color:red; cursor:pointer;">X</button>
        `;
        teamDraftArea.appendChild(singlesDiv);
    } else {
        let openSlot = document.querySelector('.team-slot:last-child .slots');
        if (!openSlot || openSlot.children.length >= 2) {
            const teamDiv = document.createElement('div');
            teamDiv.className = 'team-slot';
            teamDiv.style = "background: #1e1e1e; border-left: 4px solid #f1c40f; margin-bottom: 15px; padding: 10px;";
            teamDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #888; margin-bottom: 5px;">
                    <span>Team ELO: <span class="team-elo">0</span></span>
                    <button class="remove-team-btn" style="color:red; background:none; border:none; cursor:pointer;">X</button>
                </div>
                <div class="slots"></div>
            `;
            teamDraftArea.appendChild(teamDiv);
            openSlot = teamDiv.querySelector('.slots');
        }

        const clone = document.createElement('div');
        clone.className = 'drafted-id';
        clone.dataset.id = playerItem.dataset.id;
        clone.dataset.name = playerItem.dataset.name;
        clone.dataset.elo = playerItem.dataset.elo;
        clone.innerHTML = `<div style="padding: 5px; background: #2a2a2a; margin-top: 2px;">${playerItem.dataset.name}</div>`;
        openSlot.appendChild(clone);
        updateTeamElo(openSlot.closest('.team-slot'));
    }
    renderRoster();
}

function updateTeamElo(teamDiv) {
    const players = teamDiv.querySelectorAll('.drafted-id');
    let totalElo = 0; let names = [];
    players.forEach(p => { totalElo += parseFloat(p.dataset.elo); names.push(p.dataset.name); });
    const avgElo = players.length > 0 ? Math.round(totalElo / players.length) : 0;
    teamDiv.querySelector('.team-elo').innerText = avgElo;
    teamDiv.dataset.finalName = names.join(' & ');
    teamDiv.dataset.finalElo = avgElo;
}

teamDraftArea.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-team-btn')) {
        e.target.closest('.singles-slot, .team-slot').remove();
        renderRoster(); 
    }
});

// --- UNLOCK & LOCK LOGIC ---
document.getElementById('btn-lock-division').addEventListener('click', () => {
    const divName = document.getElementById('division-name').value;
    const format = document.getElementById('tourney-type').value;
    const items = document.querySelectorAll('.singles-slot, .team-slot');
    
    if (items.length < 2) return alert("Need at least 2 entries.");

    const participants = Array.from(items).map(el => ({
        name: el.dataset.finalName,
        elo: parseInt(el.dataset.finalElo)
    }));

    lockedDivisions.push({ name: divName, format: format, participants: participants });
    renderLockedList();
    teamDraftArea.innerHTML = '';
    renderRoster();
});

function renderLockedList() {
    const list = document.getElementById('locked-divisions-list');
    list.innerHTML = '';
    lockedDivisions.forEach((div, idx) => {
        const divRow = document.createElement('div');
        divRow.style = "display:flex; justify-content:space-between; align-items:center; background:#222; padding:8px; border-radius:4px; margin-bottom:5px;";
        divRow.innerHTML = `
            <span>✅ ${div.name} (${div.participants.length})</span>
            <button onclick="unlockDivision(${idx})" style="background:#444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">Unlock</button>
        `;
        list.appendChild(divRow);
    });
}

window.unlockDivision = (index) => {
    const div = lockedDivisions[index];
    document.getElementById('division-name').value = div.name;
    document.getElementById('tourney-type').value = div.format;
    
    // Move participants back to draft as Wildcards to preserve custom teams
    div.participants.forEach(p => {
        const fakeItem = { dataset: { name: p.name, elo: p.elo, id: 'unlocked_' + Math.random() } };
        // This is a simplified restore—it treats them as singles for the draft layout
        const singlesDiv = document.createElement('div');
        singlesDiv.className = 'singles-slot';
        singlesDiv.dataset.finalName = p.name;
        singlesDiv.dataset.finalElo = p.elo;
        singlesDiv.innerHTML = `<div style="font-weight:bold;">${p.name}</div><div class="drafted-id" data-id="${fakeItem.dataset.id}" style="display:none;"></div><button class="remove-team-btn">X</button>`;
        teamDraftArea.appendChild(singlesDiv);
    });

    lockedDivisions.splice(index, 1);
    renderLockedList();
    renderRoster();
};

// --- BRACKET & PROGRESSION LOGIC ---
document.getElementById('btn-start').addEventListener('click', () => {
    if (lockedDivisions.length === 0) return alert("Please lock a division first.");
    
    const div = lockedDivisions[0]; // Focusing on the first locked division for the preview
    if (div.format === 'single_elim') {
        initBracket(div.participants);
    } else {
        // Round Robin remains simple list for now
        renderRoundRobin(div);
    }

    document.getElementById('admin-dashboard').style.display = 'none';
    document.getElementById('tournament-view').style.display = 'block';
});

function initBracket(participants) {
    // Sort by ELO for seeding
    const sorted = [...participants].sort((a, b) => b.elo - a.elo);
    const round1 = [];
    while (sorted.length > 1) {
        round1.push({ p1: sorted.shift(), p2: sorted.pop(), score: null, winner: null });
    }
    // Handle bye
    if (sorted.length === 1) round1.push({ p1: sorted.shift(), p2: { name: "BYE", elo: 0 }, score: "BYE", winner: "p1" });

    currentBracket = [round1]; // Array of rounds
    renderBracket();
}

function renderBracket() {
    const container = document.getElementById('matchup-container');
    container.innerHTML = '<div style="display: flex; gap: 40px; overflow-x: auto; padding: 20px;"></div>';
    const bracketWrapper = container.firstChild;

    currentBracket.forEach((round, rIdx) => {
        const roundCol = document.createElement('div');
        roundCol.style = "display:flex; flex-direction:column; justify-content:space-around; min-width:200px;";
        roundCol.innerHTML = `<h4 style="text-align:center; color:#3498db;">Round ${rIdx + 1}</h4>`;

        round.forEach((match, mIdx) => {
            const matchCard = document.createElement('div');
            matchCard.style = "background:#1e1e1e; border:1px solid #333; padding:10px; margin:10px 0; border-radius:8px;";
            
            const p1Color = match.winner === 'p1' ? '#2ecc71' : (match.winner === 'p2' ? '#e74c3c' : '#fff');
            const p2Color = match.winner === 'p2' ? '#2ecc71' : (match.winner === 'p1' ? '#e74c3c' : '#fff');

            matchCard.innerHTML = `
                <div style="color:${p1Color}; font-weight:bold; display:flex; justify-content:space-between;">
                    <span>${match.p1.name}</span> <span>${match.p1Score || ''}</span>
                </div>
                <div style="text-align:center; font-size:10px; color:#555; margin:4px 0;">vs</div>
                <div style="color:${p2Color}; font-weight:bold; display:flex; justify-content:space-between;">
                    <span>${match.p2 ? match.p2.name : 'TBD'}</span> <span>${match.p2Score || ''}</span>
                </div>
                ${!match.winner && match.p2 && match.p2.name !== "BYE" ? `<button onclick="enterMatchScore(${rIdx}, ${mIdx})" style="width:100%; margin-top:8px; font-size:10px; cursor:pointer;">Score</button>` : ''}
            `;
            roundCol.appendChild(matchCard);
        });
        bracketWrapper.appendChild(roundCol);
    });
}

window.enterMatchScore = (rIdx, mIdx) => {
    const match = currentBracket[rIdx][mIdx];
    const scoreInput = prompt(`Enter individual game scores for ${match.p1.name} vs ${match.p2.name}\n(e.g., 21-15, 18-21, 11-7)`);
    
    if (!scoreInput) return;

    // Parse scores: count how many games each won
    const games = scoreInput.split(',').map(g => g.trim().split('-').map(Number));
    let p1Games = 0; let p2Games = 0;
    
    games.forEach(g => {
        if (g[0] > g[1]) p1Games++;
        else if (g[1] > g[0]) p2Games++;
    });

    match.p1Score = p1Games;
    match.p2Score = p2Games;
    match.winner = p1Games > p2Games ? 'p1' : 'p2';
    match.detailedScores = scoreInput;

    progressBracket(rIdx, mIdx);
    renderBracket();
};

function progressBracket(rIdx, mIdx) {
    const winner = currentBracket[rIdx][mIdx][currentBracket[rIdx][mIdx].winner];
    const nextRoundIdx = rIdx + 1;
    const nextMatchIdx = Math.floor(mIdx / 2);

    // Create next round if it doesn't exist
    if (!currentBracket[nextRoundIdx]) {
        const nextRoundSize = Math.ceil(currentBracket[rIdx].length / 2);
        if (nextRoundSize === 0) return; // Tournament over
        currentBracket[nextRoundIdx] = Array.from({ length: nextRoundSize }, () => ({ p1: {name: 'TBD'}, p2: null }));
    }

    // Place winner in the next match
    if (mIdx % 2 === 0) {
        currentBracket[nextRoundIdx][nextMatchIdx].p1 = winner;
    } else {
        currentBracket[nextRoundIdx][nextMatchIdx].p2 = winner;
    }
}

// Initial Call
refreshRosterFromDB();
updateLabels();
