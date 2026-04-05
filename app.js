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

// --- FIREBASE AUTHENTICATION ---
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // User is signed in, show Admin Dashboard
        isAdmin = true;
        document.getElementById('admin-dashboard').style.display = 'block';
        document.getElementById('public-viewer').style.display = 'none';
        // TODO: Load active tournaments from DB
    } else {
        // No user, default to Public View
        isAdmin = false;
        document.getElementById('admin-dashboard').style.display = 'none';
        document.getElementById('public-viewer').style.display = 'block';
        // TODO: Load read-only view from DB
    }
    updateVisibility();
});

window.loginAdmin = function() {
    const email = document.getElementById('admin-email').value;
    const pwd = document.getElementById('admin-pwd').value;
    firebase.auth().signInWithEmailAndPassword(email, pwd)
        .then(() => {
            document.getElementById('login-modal').style.display = 'none';
        })
        .catch((error) => alert("Login Failed: " + error.message));
};

// --- STATE MANAGEMENT ---
let allPlayers = []; 
let isDoublesMode = false;
let isAdmin = false;
let lockedDivisions = [];

// Ensure panels display correctly based on Admin state
function updateVisibility() {
    const resetBtn = document.getElementById('btn-reset');
    
    if (isAdmin) {
        document.getElementById('admin-dashboard').style.display = 'block';
        document.getElementById('public-viewer').style.display = 'none';
        if(resetBtn) resetBtn.style.display = 'block'; 
    } else {
        document.getElementById('admin-dashboard').style.display = 'none';
        document.getElementById('public-viewer').style.display = 'block';
        if(resetBtn) resetBtn.style.display = 'none'; 
    }
}

const teamDraftArea = document.getElementById('team-draft-area');
const playerListDiv = document.getElementById('player-list');
const searchInput = document.getElementById('player-search');

// --- TOGGLES ---
document.getElementById('btn-mode-singles').addEventListener('click', (e) => {
    isDoublesMode = false;
    e.target.classList.add('active');
    document.getElementById('btn-mode-doubles').classList.remove('active');
    document.getElementById('draft-header').innerText = "Selected Players";
    teamDraftArea.innerHTML = ''; 
    renderRoster();
});

document.getElementById('btn-mode-doubles').addEventListener('click', (e) => {
    isDoublesMode = true;
    e.target.classList.add('active');
    document.getElementById('btn-mode-singles').classList.remove('active');
    document.getElementById('draft-header').innerText = "Teams";
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

teamDraftArea.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-team-btn')) {
        const slot = e.target.closest('.singles-slot') || e.target.closest('.team-slot');
        slot.remove();
        renderRoster(); 
    }
});

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
    fakePlayerItem.dataset.name = nameStr;
    fakePlayerItem.dataset.elo = eloVal || 1000;

    playerListDiv.appendChild(fakePlayerItem);
    fakePlayerItem.click(); 

    document.getElementById('wildcard-name').value = '';
});

// --- LOCKING LOGIC ---
document.getElementById('btn-lock-division').addEventListener('click', () => {
    const nameInput = document.getElementById('division-name');
    const divName = nameInput ? nameInput.value : "Untitled Division";
    const format = document.getElementById('format-select').value;
    
    const participantElements = document.querySelectorAll('.singles-slot, .team-slot');
    if (participantElements.length < 2) return alert("Need at least 2 participants to lock a division.");

    const participants = Array.from(participantElements).map(el => ({
        name: el.dataset.finalName,
        elo: parseInt(el.dataset.finalElo)
    }));

    lockedDivisions.push({
        name: divName || "Untitled Division",
        format: format,
        mode: isDoublesMode ? "Doubles" : "Singles",
        participants: participants,
        bracket: [] 
    });

    renderLockedDivisions();
    document.getElementById('team-draft-area').innerHTML = '';
    if(nameInput) nameInput.value = '';
    renderRoster();
});

function renderLockedDivisions() {
    const divLog = document.getElementById('locked-divisions-list');
    divLog.innerHTML = '';
    lockedDivisions.forEach((div, index) => {
        divLog.innerHTML += `
            <div style="background: rgba(52, 152, 219, 0.1); padding: 8px; border-radius: 4px; margin-bottom: 5px; border-left: 3px solid var(--uha-blue);">
                ✅ Locked: <b>${div.name} (${div.mode})</b> - ${div.participants.length} entries
                <button class="unlock-btn" onclick="unlockDivision(${index})">Unlock</button>
            </div>
        `;
    });
}

window.unlockDivision = function(index) {
    const divToUnlock = lockedDivisions.splice(index, 1)[0];
    document.getElementById('division-name').value = divToUnlock.name;
    
    divToUnlock.participants.forEach(p => {
        const slot = document.createElement('div');
        slot.className = divToUnlock.mode === "Singles" ? 'singles-slot' : 'team-slot';
        slot.dataset.finalName = p.name;
        slot.dataset.finalElo = p.elo;
        slot.innerHTML = `
            <div style="font-weight: bold;">
                ${p.name} <span style="color:var(--uha-blue); margin-left:10px;">${Math.round(p.elo)}</span>
            </div>
            <button class="remove-team-btn">X</button>
        `;
        teamDraftArea.appendChild(slot);
    });
    renderLockedDivisions();
};

// --- TOURNAMENT PREVIEW & BRACKET PROGRESSION LOGIC ---

/**
 * Helper: Takes an array of players/teams and returns Round 1 matchups 
 * paired by ELO (1 vs 8, 2 vs 7, etc.) with BYEs handled automatically.
 */
function buildSeededMatchups(teams) {
    let numTeams = teams.length;
    let bracketSize = Math.pow(2, Math.ceil(Math.log2(numTeams || 1)));
    if (bracketSize < 2) bracketSize = 2;
    let byes = bracketSize - numTeams;

    // Add "BYE" objects to pad the array to a power of 2
    let paddedTeams = [...teams];
    for(let i=0; i<byes; i++) {
        paddedTeams.push({ name: "BYE", isBye: true });
    }

    // Generate the seed order (e.g., [0, 7, 3, 4, 1, 6, 2, 5] for 8 teams)
    let seeds = [0];
    for (let i = 1; i < Math.log2(bracketSize) + 1; i++) {
        let nextLevel = [];
        let sum = Math.pow(2, i) - 1;
        for (let j = 0; j < seeds.length; j++) {
            nextLevel.push(seeds[j]);
            nextLevel.push(sum - seeds[j]);
        }
        seeds = nextLevel;
    }

    let matchups = [];
    for (let i = 0; i < seeds.length; i += 2) {
        let p1 = paddedTeams[seeds[i]];
        let p2 = paddedTeams[seeds[i+1]];
        matchups.push({
            p1: p1.isBye ? null : p1,
            p2: p2.isBye ? null : p2,
            scores: (p1.isBye || p2.isBye) ? 'BYE' : '',
            p1Wins: 0, p2Wins: 0,
            winner: p1.isBye ? 'p2' : (p2.isBye ? 'p1' : null)
        });
    }
    return matchups;
}

// --- START TOURNAMENT & PUSH TO LIVE ---
document.getElementById('btn-start').addEventListener('click', () => {
    if (lockedDivisions.length === 0) return alert("You need to lock at least one division first!");

    lockedDivisions.forEach(division => {
        if (division.bracket.length > 0) return; // Don't rebuild if bracket already exists
        
        if (division.format === 'single_elim' && division.bracket.length === 0) {
            // 1. Get the participants
            let p = [...division.participants];
            
            // 2. SORT BY ELO (Highest to Lowest)
            p.sort((a, b) => (b.elo || 0) - (a.elo || 0));

            // 3. Build Round 1 using the seeded helper
            let round1 = buildSeededMatchups(p);

            // 4. Calculate rounds and initialize the full bracket
            let nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(p.length || 1)));
            if(nextPowerOf2 < 2) nextPowerOf2 = 2;
            let roundsCount = Math.log2(nextPowerOf2);
            
            let bracket = [round1];
            for(let r=1; r<roundsCount; r++) {
                let matchesInRound = nextPowerOf2 / Math.pow(2, r+1);
                bracket.push(Array.from({length: matchesInRound}, () => ({p1: null, p2: null, p1Wins: 0, p2Wins: 0, scores: '', winner: null})));
            }

            // 5. Progress any "BYE" winners automatically to Round 2
            round1.forEach((match, mIdx) => {
                if (match.scores === 'BYE' && match.winner && bracket[1]) {
                    let advancer = match[match.winner]; 
                    let nextMIdx = Math.floor(mIdx / 2);
                    if (mIdx % 2 === 0) bracket[1][nextMIdx].p1 = advancer;
                    else bracket[1][nextMIdx].p2 = advancer;
                }
            });

            division.bracket = bracket;
        } 
        else if (division.format === 'round_robin') {
            let p = [...division.participants];
            let matches = [];
            for(let i=0; i<p.length; i++) {
                for(let j=i+1; j<p.length; j++) {
                    matches.push({ p1: p[i], p2: p[j], p1Wins: 0, p2Wins: 0, scores: '', winner: null });
                }
            }
            division.bracket = [matches]; 
        }
    });

    // Save to Firebase
    db.ref('tournaments/active').set({
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
        divisions: lockedDivisions
    }).then(() => {
        alert("Tournament saved and pushed live!");
        document.getElementById('admin-dashboard').style.display = 'none';
        document.getElementById('tournament-view').style.display = 'block';
        renderTournamentView();
    }).catch((e) => alert("Error: " + e.message));
});

// --- STANDINGS CALCULATION (2-1-0 Logic & Tiebreakers) ---
function calculateStandings(players, matches) {
    let stats = {};
    players.forEach(p => {
        stats[p.name] = { player: p, matchWins: 0, matchLosses: 0, pts: 0, gamesWon: 0, totalScore: 0, h2hWins: [] };
    });

    matches.forEach(m => {
        if (m.winner) {
            let w = m.winner === 'p1' ? m.p1 : m.p2;
            let l = m.winner === 'p1' ? m.p2 : m.p1;

            stats[w.name].matchWins++;
            stats[w.name].pts += 2; // 2 Points for Match Win
            stats[l.name].matchLosses++;

            stats[m.p1.name].gamesWon += m.p1Wins;
            stats[m.p2.name].gamesWon += m.p2Wins;

            let games = m.scores.split(',');
            games.forEach(g => {
                let s = g.trim().split('-');
                if(s.length===2) {
                    stats[m.p1.name].totalScore += parseInt(s[0]);
                    stats[m.p2.name].totalScore += parseInt(s[1]);
                }
            });

            stats[w.name].h2hWins.push(l.name);
        }
    });

    return Object.values(stats).sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts; // 1. Points
        if (a.h2hWins.includes(b.player.name)) return -1; // 2. Head-to-Head
        if (b.h2hWins.includes(a.player.name)) return 1;
        if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon; // 3. Games Won
        return b.totalScore - a.totalScore; // 4. Total Points Scored
    });
}

window.advanceToKnockout = function(divIdx) {
    let oldDiv = lockedDivisions[divIdx];
    let stats = calculateStandings(oldDiv.participants, oldDiv.bracket[0]);
    
    // Create new division seeded perfectly by standings
    lockedDivisions.push({
        name: oldDiv.name + " (Championship Knockout)",
        format: "single_elim",
        mode: oldDiv.mode,
        participants: stats.map(s => s.player),
        bracket: []
    });

    document.getElementById('btn-start').click(); // Refresh with new bracket
};

    function renderTournamentView() {
    let html = '';
    lockedDivisions.forEach((div, divIdx) => {
        html += `<div class="section-title" style="margin-top: 40px; border-top: 1px solid #444; padding-top:20px;">${div.name} (${div.mode} - ${div.format === 'single_elim' ? 'Knockout' : 'Round Robin'})</div>`;
        
        if (div.format === 'single_elim') {
            html += `<div class="bracket-layout"><div class="bracket-columns">`;
            
            div.bracket.forEach((round, rIdx) => {
                html += `<div class="bracket-round">`;
                html += `<div class="bracket-header" style="margin-bottom: 20px;">Round ${rIdx + 1}</div>`; 
                html += `<div class="bracket-matches">`; 
                
                round.forEach((match, mIdx) => {
                    html += generateMatchCardHTML(match, divIdx, rIdx, mIdx);
                });
                
                html += `</div></div>`; // Closes bracket-matches and bracket-round
            }); // <--- FIX: Added ); to close the forEach loop correctly

            html += `</div></div>`; // Closes bracket-columns and bracket-layout
            
        } else if (div.format === 'round_robin') {
            // ... (Keep your existing round_robin logic here) ...
        }
    });
    document.getElementById('matchup-container').innerHTML = html;
}

function generateMatchCardHTML(match, divIdx, rIdx, mIdx) {
    // Safely check for player names, defaulting to "BYE" if null
    let teamA = match.p1 ? match.p1.name : "BYE";
    let teamB = match.p2 ? match.p2.name : "BYE";
    
    // Safely format scores if they exist
    let scoreA = match.scores && match.scores !== 'BYE' ? `[${match.p1Wins}]` : '';
    let scoreB = match.scores && match.scores !== 'BYE' ? `[${match.p2Wins}]` : '';

    // If it's a BYE, we don't need a score button
    let actionArea = (teamA === "BYE" || teamB === "BYE") 
        ? `<div style="color:var(--text-muted); font-size:12px; text-align:center; padding:8px;">Auto-Advance</div>`
        : `<button class="uha-btn" style="width:auto; padding:8px 15px;" onclick="openScoreModal(${divIdx}, ${rIdx}, ${mIdx})">Enter Score</button>`;

    return `
        <div class="match-card">
            <div style="flex:1;">
                <div class="team-a" style="font-weight:bold;">${teamA} <span class="score-a" style="color:var(--uha-blue); margin-left:10px;">${scoreA}</span></div>
                <div class="match-vs">vs</div>
                <div class="team-b" style="font-weight:bold;">${teamB} <span class="score-b" style="color:var(--uha-blue); margin-left:10px;">${scoreB}</span></div>
            </div>
            ${actionArea}
        </div>
    `;
}

// --- BEST OF 3 MODAL LOGIC ---
let currentScoreContext = null;

window.openScoreModal = function(divIdx, rIdx, mIdx) {
    currentScoreContext = { divIdx, rIdx, mIdx };
    const match = lockedDivisions[divIdx].bracket[rIdx][mIdx];
    document.getElementById('score-modal-title').innerText = `${match.p1.name} vs ${match.p2.name}`;

    let existing = match.scores && match.scores !== 'BYE' ? match.scores.split(',').map(s => s.split('-')) : [];
    
    let bodyHtml = `<div style="display:flex; justify-content:space-between; margin-bottom:10px; font-weight:bold; color:var(--uha-blue);">
        <div style="flex:1; text-align:left;">${match.p1.name}</div>
        <div style="flex:1; text-align:right;">${match.p2.name}</div>
    </div>`;

    for(let i=0; i<3; i++) {
        let s1 = existing[i] ? existing[i][0].trim() : '';
        let s2 = existing[i] ? existing[i][1].trim() : '';
        bodyHtml += `
        <div class="score-row">
            <span style="font-size:11px; color:#888; width: 40px; text-align: left;">Game ${i+1}</span>
            <input type="number" class="score-input p1-score" value="${s1}" min="0">
            <span style="color: #666;">-</span>
            <input type="number" class="score-input p2-score" value="${s2}" min="0">
        </div>`;
    }

    document.getElementById('score-modal-body').innerHTML = bodyHtml;
    document.getElementById('score-modal').style.display = 'flex';
};

window.closeScoreModal = function() {
    document.getElementById('score-modal').style.display = 'none';
    currentScoreContext = null;
};

window.saveScore = function() {
    const { divIdx, rIdx, mIdx } = currentScoreContext;
    const div = lockedDivisions[divIdx];
    const match = div.bracket[rIdx][mIdx];

    const p1Inputs = document.querySelectorAll('.p1-score');
    const p2Inputs = document.querySelectorAll('.p2-score');

    let scoreStrings = [];
    let p1Wins = 0, p2Wins = 0;

    for(let i=0; i<3; i++) {
        let s1 = parseInt(p1Inputs[i].value);
        let s2 = parseInt(p2Inputs[i].value);

        if (!isNaN(s1) && !isNaN(s2)) {
            scoreStrings.push(`${s1}-${s2}`);
            if (s1 > s2) p1Wins++;
            else if (s2 > s1) p2Wins++;
        }
    }

    if (scoreStrings.length === 0) return alert("Please enter at least one game score.");
    if (p1Wins === p2Wins) return alert("Match cannot end in a tie.");

    // THE BUTTERFLY EFFECT: If editing an old score, wipe subsequent rounds
    if (match.winner && div.format === 'single_elim') {
        let nextRIdx = rIdx + 1;
        let nextMIdx = Math.floor(mIdx / 2);
        if (div.bracket[nextRIdx] && div.bracket[nextRIdx][nextMIdx].p1) {
            if(!confirm("Warning: Changing this score will erase the bracket forward. Continue?")) return;
            wipeForwardBracket(divIdx, rIdx, mIdx);
        }
    }

    match.scores = scoreStrings.join(', ');
    match.p1Wins = p1Wins;
    match.p2Wins = p2Wins;
    match.winner = p1Wins > p2Wins ? 'p1' : 'p2';

    progressBracket(divIdx, rIdx, mIdx);
    renderTournamentView();
    closeScoreModal();
};

function wipeForwardBracket(divIdx, rIdx, mIdx) {
    let div = lockedDivisions[divIdx];
    let currRIdx = rIdx;
    let currMIdx = mIdx;

    while (div.bracket[currRIdx + 1]) {
        let nextRIdx = currRIdx + 1;
        let nextMIdx = Math.floor(currMIdx / 2);
        let nextMatch = div.bracket[nextRIdx][nextMIdx];

        nextMatch.p1 = null; nextMatch.p2 = null;
        nextMatch.scores = ''; nextMatch.p1Wins = 0; nextMatch.p2Wins = 0;
        nextMatch.winner = null;

        currRIdx = nextRIdx; currMIdx = nextMIdx;
    }
}

function progressBracket(divIdx, rIdx, mIdx) {
    let div = lockedDivisions[divIdx];
    if (div.format !== 'single_elim') return; 

    let match = div.bracket[rIdx][mIdx];
    let winner = match.winner === 'p1' ? match.p1 : match.p2;
    let nextRIdx = rIdx + 1;
    let nextMIdx = Math.floor(mIdx / 2);

    if (div.bracket[nextRIdx]) {
        if (mIdx % 2 === 0) div.bracket[nextRIdx][nextMIdx].p1 = winner;
        else div.bracket[nextRIdx][nextMIdx].p2 = winner;
    }
}

document.getElementById('btn-start').addEventListener('click', () => {
    if (lockedDivisions.length === 0) {
        return alert("You need to lock at least one division first!");
    }

    // Push to Firebase Realtime Database
    db.ref('tournaments/active').set({
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
        divisions: lockedDivisions
    }).then(() => {
        alert("Tournament saved to database and pushed live!");
        document.getElementById('admin-dashboard').style.display = 'none';
        document.getElementById('tournament-view').style.display = 'flex';
        renderTournamentView();
    }).catch((error) => {
        alert("Firebase Save Error: " + error.message);
    });
});

// Initialize
refreshRosterFromDB();
