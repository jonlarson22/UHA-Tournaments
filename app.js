// --- FIREBASE CONFIG ---
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

// Ensure panels display correctly based on Admin state
if (isAdmin) {
    document.getElementById('admin-dashboard').style.display = 'block';
    document.getElementById('public-viewer').style.display = 'none';
} else {
    document.getElementById('admin-dashboard').style.display = 'none';
    document.getElementById('public-viewer').style.display = 'block';
}

const teamDraftArea = document.getElementById('team-draft-area');
const playerListDiv = document.getElementById('player-list');
const searchInput = document.getElementById('player-search');

// --- TOGGLES ---
document.getElementById('btn-mode-singles').addEventListener('click', (e) => {
    isDoublesMode = false;
    e.target.classList.add('active');
    document.getElementById('btn-mode-doubles').classList.remove('active');
    teamDraftArea.innerHTML = ''; 
    renderRoster();
});

document.getElementById('btn-mode-doubles').addEventListener('click', (e) => {
    isDoublesMode = true;
    e.target.classList.add('active');
    document.getElementById('btn-mode-singles').classList.remove('active');
    teamDraftArea.innerHTML = ''; 
    renderRoster();
});

// --- ROSTER LOGIC ---
function refreshRosterFromDB() {
    db.ref('players').once('value', (snapshot) => {
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
        div.dataset.id = player.id;
        div.dataset.name = player.name;
        div.dataset.elo = isDoublesMode ? (player.doubles || 1000) : (player.singles || 1000);
        div.innerHTML = `<span>${player.name}</span> <span style="color:var(--uha-blue); font-weight:bold;">${Math.round(div.dataset.elo)}</span>`;
        playerListDiv.appendChild(div);
    });
}

// --- DRAFT LOGIC ---
playerListDiv.addEventListener('click', (e) => {
    const playerItem = e.target.closest('.player-item');
    if (!playerItem) return;

    if (!isDoublesMode) {
        // Singles Draft
        const singlesDiv = document.createElement('div');
        singlesDiv.className = 'singles-slot';
        singlesDiv.dataset.finalName = playerItem.dataset.name;
        singlesDiv.dataset.finalElo = playerItem.dataset.elo;
        
        singlesDiv.innerHTML = `
            <div style="font-weight: bold;">
                ${playerItem.dataset.name} <span style="color:var(--uha-blue); margin-left:10px;">${Math.round(playerItem.dataset.elo)}</span>
            </div>
            <div class="drafted-id" data-id="${playerItem.dataset.id}" style="display:none;"></div>
            <button class="remove-team-btn">X</button>
        `;
        teamDraftArea.appendChild(singlesDiv);

    } else {
        // Doubles Draft (Auto-pairing)
        let openSlot = document.querySelector('.team-slot:last-child .slots');

        if (!openSlot || openSlot.children.length >= 2) {
            const teamId = Date.now();
            const teamDiv = document.createElement('div');
            teamDiv.className = 'team-slot';
            teamDiv.innerHTML = `
                <div class="team-header">
                    <span>Team ELO: <span class="team-elo">0</span></span>
                    <button class="remove-team-btn">X</button>
                </div>
                <div class="slots" data-team-id="${teamId}"></div>
            `;
            teamDraftArea.appendChild(teamDiv);
            openSlot = teamDiv.querySelector('.slots');
        }

        const clone = document.createElement('div');
        clone.className = 'drafted-id player-item';
        clone.dataset.id = playerItem.dataset.id;
        clone.dataset.name = playerItem.dataset.name;
        clone.dataset.elo = playerItem.dataset.elo;
        clone.innerHTML = playerItem.innerHTML;
        clone.style.marginBottom = "5px";
        
        openSlot.appendChild(clone);
        updateTeamElo(openSlot.closest('.team-slot'));
    }
    renderRoster();
});

// Remove Drafted Teams
teamDraftArea.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-team-btn')) {
        const slot = e.target.closest('.singles-slot') || e.target.closest('.team-slot');
        slot.remove();
        renderRoster(); 
    }
});

// Update ELO for Teams
function updateTeamElo(teamDiv) {
    const players = teamDiv.querySelectorAll('.drafted-id');
    let totalElo = 0;
    let names = [];
    players.forEach(p => {
        totalElo += parseFloat(p.dataset.elo);
        names.push(p.dataset.name);
    });
    const avgElo = players.length > 0 ? Math.round(totalElo / players.length) : 0;
    teamDiv.querySelector('.team-elo').innerText = avgElo;
    
    teamDiv.dataset.finalName = names.join(' & ');
    teamDiv.dataset.finalElo = avgElo;
}

// --- WILDCARD LOGIC ---
document.getElementById('btn-add-wildcard').addEventListener('click', () => {
    const nameStr = document.getElementById('wildcard-name').value;
    const eloVal = document.getElementById('wildcard-elo').value;
    
    if (!nameStr) return alert("Enter a wildcard name");

    const fakePlayerItem = document.createElement('div');
    fakePlayerItem.className = 'player-item';
    fakePlayerItem.dataset.id = 'wildcard_' + Date.now();
    fakePlayerItem.dataset.name = nameStr + " (WC)";
    fakePlayerItem.dataset.elo = eloVal || 1000;

    playerListDiv.appendChild(fakePlayerItem);
    fakePlayerItem.click(); 

    document.getElementById('wildcard-name').value = '';
});

// --- LOCKING LOGIC ---
document.getElementById('btn-lock-division').addEventListener('click', () => {
    const divName = document.getElementById('division-name').value;
    const format = document.getElementById('tourney-type').value;
    
    const participantElements = document.querySelectorAll('.singles-slot, .team-slot');
    if (participantElements.length < 2) return alert("Need at least 2 participants to lock a division.");

    const participants = Array.from(participantElements).map(el => ({
        name: el.dataset.finalName,
        elo: parseInt(el.dataset.finalElo)
    }));

    lockedDivisions.push({
        name: divName,
        format: format,
        participants: participants
    });

    const divLog = document.getElementById('locked-divisions-list');
    divLog.innerHTML += `<div style="margin-bottom: 5px;">✅ Locked: <b>${divName}</b> (${participants.length} entries)</div>`;

    document.getElementById('team-draft-area').innerHTML = '';
    renderRoster();
});

// --- TOURNAMENT PREVIEW LOGIC ---
document.getElementById('btn-start').addEventListener('click', () => {
    
    // Fallback: If nothing is locked, try to launch what is currently drafted
    if (lockedDivisions.length === 0) {
        document.getElementById('btn-lock-division').click();
    }

    if (lockedDivisions.length === 0) return; // Still nothing, exit

    let matchesHtml = '';

    lockedDivisions.forEach(division => {
        matchesHtml += `<div class="section-title" style="margin-top: 30px;">${division.name} (${division.format === 'round_robin' ? 'Round Robin' : 'Knockout'})</div>`;

        if (division.format === 'round_robin') {
            const groupCount = Math.ceil(division.participants.length / 4);
            const groups = Array.from({ length: groupCount }, () => []);
            
            let forward = true;
            let groupIndex = 0;
            
            division.participants.forEach((p) => {
                groups[groupIndex].push(p);
                if (forward) {
                    groupIndex++;
                    if (groupIndex >= groupCount) { groupIndex--; forward = false; }
                } else {
                    groupIndex--;
                    if (groupIndex < 0) { groupIndex++; forward = true; }
                }
            });

            groups.forEach((group, gIndex) => {
                matchesHtml += `<div style="background:#333; padding:8px 12px; margin-top:15px; font-weight:bold; color:var(--uha-gold); border-radius:4px;">Group ${String.fromCharCode(65 + gIndex)}</div>`;
                for (let i = 0; i < group.length; i++) {
                    for (let j = i + 1; j < group.length; j++) {
                        matchesHtml += createMatchCard(group[i].name, group[j].name);
                    }
                }
            });

        } else if (division.format === 'single_elim') {
            let p = [...division.participants];
            while (p.length > 1) {
                let highSeed = p.shift();
                let lowSeed = p.pop();
                matchesHtml += createMatchCard(highSeed.name, lowSeed.name);
            }
            if (p.length === 1) {
                matchesHtml += `<div style="padding:15px; color:var(--uha-blue); font-style: italic;">** ${p[0].name} receives a Bye **</div>`;
            }
        }
    });

    document.getElementById('matchup-container').innerHTML = matchesHtml;
    // THIS LINE IS CRITICAL - It hides the admin dashboard so you can see the preview
    document.getElementById('admin-dashboard').style.display = 'none';
    document.getElementById('tournament-view').style.display = 'block';
});

function createMatchCard(teamA, teamB) {
    return `
        <div class="match-card">
            <div style="flex:1;">
                <div class="team-a" style="font-weight:bold;">${teamA} <span class="score-a" style="color:var(--uha-blue); margin-left:10px;"></span></div>
                <div class="match-vs">vs</div>
                <div class="team-b" style="font-weight:bold;">${teamB} <span class="score-b" style="color:var(--uha-blue); margin-left:10px;"></span></div>
            </div>
            <button class="uha-btn" style="width:auto; padding:8px 15px;" onclick="mockScore(this)">Enter Score</button>
        </div>
    `;
}

// Mock Scoring Function for Preview
window.mockScore = function(btnElement) {
    const card = btnElement.closest('.match-card');
    const teamA = card.querySelector('.team-a').innerText;
    const teamB = card.querySelector('.team-b').innerText;

    const scoreStr = prompt(`Enter games won for ${teamA} vs ${teamB} (e.g., 2-1 or 2-0):`);
    
    if (scoreStr && scoreStr.includes('-')) {
        const scores = scoreStr.split('-');
        card.querySelector('.score-a').innerText = `[${scores[0]}]`;
        card.querySelector('.score-b').innerText = `[${scores[1]}]`;

        if (parseInt(scores[0]) > parseInt(scores[1])) {
            card.style.borderColor = 'var(--green-win)';
        } else {
            card.style.borderColor = 'var(--red-lose)';
        }
        
        btnElement.innerText = "Edit Score";
        btnElement.style.background = "#555";
    }
};

// Initialize
refreshRosterFromDB();
