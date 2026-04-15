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

let allPlayers = []; 
let isDoublesMode = false;
let isAdmin = false;
let lockedDivisions = [];
let isViewingArchive = false;

document.getElementById('header-title').addEventListener('click', () => {
    if (!isAdmin) {
        document.getElementById('login-modal').style.display = 'flex';
    }
});

firebase.auth().onAuthStateChanged((user) => {
    const safeDisplay = (id, displayStyle) => {
        const el = document.getElementById(id);
        if (el) el.style.display = displayStyle;
    };

    if (user) {
        isAdmin = true;
        safeDisplay('btn-logout', 'block');
        safeDisplay('admin-dashboard', 'block');
        safeDisplay('public-viewer', 'none');
        safeDisplay('tournament-view', 'none'); 
    } else {
        isAdmin = false;
        safeDisplay('btn-logout', 'none');
        safeDisplay('admin-dashboard', 'none');
        safeDisplay('public-viewer', 'none'); 
        safeDisplay('tournament-view', 'block');
        loadTournamentData('active');
    }
    updateVisibility();
});

window.loginAdmin = function() {
    const email = document.getElementById('admin-email').value;
    const pwd = document.getElementById('admin-pwd').value;
    firebase.auth().signInWithEmailAndPassword(email, pwd)
        .then(() => {
            document.getElementById('login-modal').style.display = 'none';
            document.getElementById('admin-email').value = '';
            document.getElementById('admin-pwd').value = '';
        })
        .catch((error) => alert("Login Failed: " + error.message));
};

window.logoutAdmin = function() {
    firebase.auth().signOut().then(() => {
        window.location.reload(); 
    });
};

function updateVisibility() {
    const archiveBtn = document.getElementById('btn-archive');
    const resetBtn = document.getElementById('btn-reset');
    const backSetupBtn = document.getElementById('btn-back-setup');
    
    if (isAdmin) {
        if(archiveBtn) archiveBtn.style.display = 'block';
        if(resetBtn) resetBtn.style.display = 'block'; 
    } else {
        if(archiveBtn) archiveBtn.style.display = 'none';
        if(resetBtn) resetBtn.style.display = 'none'; 
        if(backSetupBtn) backSetupBtn.style.display = 'none';
    }
}

const teamDraftArea = document.getElementById('team-draft-area');
const playerListDiv = document.getElementById('player-list');
const searchInput = document.getElementById('player-search');

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

window.toggleFormatOptions = function() {
    const format = document.getElementById('division-format').value;
    const multiSettings = document.getElementById('multi-group-settings');
    const doubleSettings = document.getElementById('double-elim-settings');

    if (multiSettings) multiSettings.style.display = (format === 'multi_group_rr') ? 'block' : 'none';
    if (doubleSettings) doubleSettings.style.display = (format === 'double_elim') ? 'block' : 'none';
};

function refreshRosterFromDB() {
    db.ref('players').once('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            allPlayers = Object.keys(data).map(key => {
                const p = data[key];
                p.id = p.id || key; 
                return p;
            });
        } else {
            allPlayers = [];
        }
        
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

document.getElementById('btn-add-player').addEventListener('click', () => {
    const nameStr = document.getElementById('new-player-name').value.trim();
    const singlesVal = parseFloat(document.getElementById('new-player-singles').value) || 1000;
    const doublesVal = parseFloat(document.getElementById('new-player-doubles').value) || 1000;
    const isMember = document.getElementById('new-player-member').checked;
    
    if (!nameStr) return alert("Enter a player name");
    
    if (allPlayers.some(p => p.name.toLowerCase() === nameStr.toLowerCase())) {
        return alert("Player already exists in the database.");
    }

    const newPlayer = {
        id: Date.now(),
        name: nameStr,
        singles: singlesVal,
        doubles: doublesVal,
        baseS: singlesVal,
        baseD: doublesVal,
        peakS: singlesVal,
        peakD: doublesVal,
        active: true,
        isMember: isMember
    };

    allPlayers.push(newPlayer);
    db.ref('players').set(allPlayers)
        .then(() => {
            document.getElementById('new-player-name').value = '';
            document.getElementById('new-player-singles').value = '1000';
            document.getElementById('new-player-doubles').value = '1000';
            document.getElementById('new-player-member').checked = true;

            const searchInput = document.getElementById('player-search');
            if (searchInput) searchInput.value = nameStr;
            refreshRosterFromDB(); 
        })
        .catch(e => alert("Error adding player: " + e.message));
});

document.getElementById('btn-lock-division').addEventListener('click', () => {
    const nameInput = document.getElementById('division-name');
    const divName = nameInput ? nameInput.value : "Untitled Division";
    const format = document.getElementById('division-format').value;
    const finalRuleEl = document.getElementById('double-elim-final');
    const finalRule = finalRuleEl ? finalRuleEl.value : 'true_double';
    
    const participantElements = document.querySelectorAll('.singles-slot, .team-slot');
    if (participantElements.length < 2) return alert("Need at least 2 participants to lock a division.");

   const participants = Array.from(participantElements).map(el => {
        const idElements = el.querySelectorAll('.drafted-id');
        const ids = Array.from(idElements).map(idEl => {
            return Number(idEl.dataset.id);
    });

        return {
            name: el.dataset.finalName,
            elo: parseInt(el.dataset.finalElo),
            ids: ids 
        };
    });

    lockedDivisions.push({
        name: divName || "Untitled Division",
        format: format,
        mode: isDoublesMode ? "Doubles" : "Singles",
        grandFinalRule: finalRule,
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
    const nameInput = document.getElementById('division-name');
    if (nameInput) nameInput.value = divToUnlock.name;
    
    divToUnlock.participants.forEach(p => {
        const slot = document.createElement('div');
        slot.className = divToUnlock.mode === "Singles" ? 'singles-slot' : 'team-slot';
        slot.dataset.finalName = p.name;
        slot.dataset.finalElo = p.elo;

        let idHtml = (p.ids || []).map(id => `<div class="drafted-id" data-id="${id}" style="display:none;"></div>`).join('');

        slot.innerHTML = `
            <div style="font-weight: bold;">
                ${p.name} <span style="color:var(--uha-blue); margin-left:10px;">${Math.round(p.elo)}</span>
            </div>
            ${idHtml}
            <button class="remove-team-btn">X</button>
        `;
        teamDraftArea.appendChild(slot);
    });
    renderLockedDivisions();
};

window.goToBracketView = function() {
    document.getElementById('admin-dashboard').style.display = 'none';
    document.getElementById('tournament-view').style.display = 'block';

    const backBtn = document.getElementById('btn-back-setup');
    if (backBtn) backBtn.style.display = 'block';
};

window.goToSetupView = function() {
    document.getElementById('tournament-view').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'block';
};

function buildSeededMatchups(teams) {
    let numTeams = teams.length;
    let bracketSize = Math.pow(2, Math.ceil(Math.log2(numTeams || 1)));
    if (bracketSize < 2) bracketSize = 2;
    let byes = bracketSize - numTeams;

    let paddedTeams = [...teams];
    for(let i=0; i<byes; i++) {
        paddedTeams.push({ name: "BYE", isBye: true });
    }

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

document.getElementById('btn-start').addEventListener('click', () => {
    if (lockedDivisions.length === 0) return alert("You need to lock at least one division first!");

    lockedDivisions.forEach(division => {
        if (division.bracket.length > 0) return; 
        
        if (division.format === 'single_elim') {
            let p = [...division.participants];

            if (!division.isFromRR) {
                p.sort((a, b) => (b.elo || 0) - (a.elo || 0));
            }

            let round1 = buildSeededMatchups(p);

            let nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(p.length || 1)));
            if(nextPowerOf2 < 2) nextPowerOf2 = 2;
            let roundsCount = Math.log2(nextPowerOf2);
            
            let bracket = [round1];
            for(let r=1; r<roundsCount; r++) {
                let matchesInRound = nextPowerOf2 / Math.pow(2, r+1);
                bracket.push(Array.from({length: matchesInRound}, () => ({p1: null, p2: null, p1Wins: 0, p2Wins: 0, scores: '', winner: null})));
            }

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
            
        else if (division.format === 'double_elim') {
            let p = [...division.participants];

            if (!division.isFromRR) {
                p.sort((a, b) => (b.elo || 0) - (a.elo || 0));
            }

            let round1 = buildSeededMatchups(p);

            let nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(p.length || 1)));
            if(nextPowerOf2 < 2) nextPowerOf2 = 2;
            let winnersRoundsCount = Math.log2(nextPowerOf2);
            
            let wBracket = [round1];
            for(let r=1; r < winnersRoundsCount; r++) {
                let matchesInRound = nextPowerOf2 / Math.pow(2, r+1);
                wBracket.push(Array.from({length: matchesInRound}, () => ({p1: null, p2: null, p1Wins: 0, p2Wins: 0, scores: '', winner: null})));
            }

            let losersRoundsCount = (winnersRoundsCount * 2) - 2;
            let lBracket = [];
            let currentLoserMatches = Math.max(1, nextPowerOf2 / 4); 
            
            for (let r = 0; r < losersRoundsCount; r++) {
                if (r > 0 && r % 2 === 0) {
                    currentLoserMatches = Math.floor(currentLoserMatches / 2);
                }
                lBracket.push(Array.from({length: Math.max(1, currentLoserMatches)}, () => ({p1: null, p2: null, p1Wins: 0, p2Wins: 0, scores: '', winner: null, isLosers: true})));
            }

           wBracket.forEach((round, rIdx) => {
                round.forEach((match, mIdx) => {
                    if (rIdx === 0) {
                        match.loserDest = {
                            rIdx: 0,
                            mIdx: Math.floor(mIdx / 2),
                            slot: mIdx % 2 === 0 ? 'p1' : 'p2'
                        };
                    } else if (rIdx === 1) {
                        let crossoverMIdx = mIdx % 2 === 0 ? mIdx + 1 : mIdx - 1;

                        if (crossoverMIdx >= round.length) crossoverMIdx = mIdx;
            
                        match.loserDest = {
                            rIdx: (rIdx * 2) - 1,
                            mIdx: crossoverMIdx,
                            slot: 'p2'
                        };
                    } else {

                        match.loserDest = {
                            rIdx: (rIdx * 2) - 1,
                            mIdx: mIdx,
                            slot: 'p2'
                        };
                    }
                });
            });

            round1.forEach((match, mIdx) => {
                if (match.scores === 'BYE' && match.winner && wBracket[1]) {
                    let advancer = match[match.winner]; 
                    let loser = match.winner === 'p1' ? match.p2 : match.p1;
                    
                    let nextMIdx = Math.floor(mIdx / 2);
                    if (mIdx % 2 === 0) wBracket[1][nextMIdx].p1 = advancer;
                    else wBracket[1][nextMIdx].p2 = advancer;

                    if (match.loserDest && lBracket[match.loserDest.rIdx]) {
                        lBracket[match.loserDest.rIdx][match.loserDest.mIdx][match.loserDest.slot] = loser;
                    }
                }
            });

            division.bracket = wBracket;
            division.losersBracket = lBracket;
          
            round1.forEach((match, mIdx) => {
                if (match.scores === 'BYE' && match.winner && wBracket[1]) {
                    let advancer = match[match.winner]; 
                    let loser = match.winner === 'p1' ? match.p2 : match.p1;
                    
                    let nextMIdx = Math.floor(mIdx / 2);
                    if (mIdx % 2 === 0) wBracket[1][nextMIdx].p1 = advancer;
                    else wBracket[1][nextMIdx].p2 = advancer;

                    if (match.loserDest && lBracket[match.loserDest.rIdx]) {
                        lBracket[match.loserDest.rIdx][match.loserDest.mIdx][match.loserDest.slot] = loser;
                    }
                }
            });

            division.bracket = wBracket;
            division.losersBracket = lBracket;

            let fBracket = [];
            fBracket.push([{p1: null, p2: null, p1Wins: 0, p2Wins: 0, scores: '', winner: null}]);

            if (division.grandFinalRule === 'true_double') {
                fBracket.push([{p1: null, p2: null, p1Wins: 0, p2Wins: 0, scores: '', winner: null}]);
            }
            division.finalsBracket = fBracket;
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

        else if (division.format === 'multi_group_rr') {
            let p = [...division.participants];
            p.sort((a, b) => (b.elo || 0) - (a.elo || 0));
            
            let numGroups = parseInt(document.getElementById('num-groups').value) || 2;
            let groups = Array.from({length: numGroups}, () => []);

            let direction = 1; 
            let groupIndex = 0;
            for (let i = 0; i < p.length; i++) {
                groups[groupIndex].push(p[i]);
                groupIndex += direction;
                if (groupIndex >= numGroups || groupIndex < 0) {
                    direction *= -1;
                    groupIndex += direction;
                }
            }

            let allGroupMatches = [];
            groups.forEach(groupPlayers => {
                let groupMatches = [];
                for(let i=0; i<groupPlayers.length; i++) {
                    for(let j=i+1; j<groupPlayers.length; j++) {
                        groupMatches.push({ p1: groupPlayers[i], p2: groupPlayers[j], p1Wins: 0, p2Wins: 0, scores: '', winner: null });
                    }
                }
                allGroupMatches.push(groupMatches);
            });

            division.draftedGroups = groups; 
            division.bracket = allGroupMatches; 
            division.advancementRule = document.getElementById('multi-group-advancement').value; 
        }

    });

    const tName = document.getElementById('tournament-name').value || "Untitled Tournament";

    db.ref('tournaments/active').set({
        name: tName,
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
        divisions: lockedDivisions
    }).then(() => {
        document.getElementById('admin-dashboard').style.display = 'none';
        document.getElementById('tournament-view').style.display = 'block';
        document.getElementById('tourney-title').innerText = tName; 
        renderTournamentView();
    }).catch((e) => alert("Error: " + e.message));
});

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
            stats[w.name].pts += 2; 
            stats[l.name].matchLosses++;

            // --- 2-1-0 POINT LOGIC ---
            let games = (m.scores || "").split(',');
            if (games.length === 3 && games[0] !== 'BYE') {
                stats[l.name].pts += 1; // 1 pt for tie-breaker loss
            }

            stats[m.p1.name].gamesWon += m.p1Wins;
            stats[m.p2.name].gamesWon += m.p2Wins;

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
    if (b.pts !== a.pts) return b.pts - a.pts;
    
    if (a.h2hWins.includes(b.player.name)) return -1;
    if (b.h2hWins.includes(a.player.name)) return 1;

    let aGameRatio = a.gamesWon / (a.matchWins + a.matchLosses || 1);
    let bGameRatio = b.gamesWon / (b.matchWins + b.matchLosses || 1);
    if (bGameRatio !== aGameRatio) return bGameRatio - aGameRatio;

    return b.totalScore - a.totalScore;
});
}

    window.advanceToKnockout = function(divIdx) {
    let div = lockedDivisions[divIdx];

    const champName = div.name + " (Championship)";
    if (lockedDivisions.some(d => d.name === champName)) {
        return alert("Knockout brackets have already been generated for this group.");
    }

    let allStandings = [];

    div.bracket.forEach((groupMatches, gIdx) => {
        let groupParticipants = div.format === 'multi_group_rr' ? div.draftedGroups[gIdx] : div.participants;
        let standings = calculateStandings(groupParticipants, groupMatches);

        standings.forEach((s, rankIndex) => {
            allStandings.push({
                player: s.player,
                groupRank: rankIndex + 1,
                groupIdx: gIdx,
                pts: s.pts,
                winRatio: (s.matchWins + s.matchLosses) > 0 ? (s.matchWins / (s.matchWins + s.matchLosses)) : 0,
                totalScore: s.totalScore,
                gamesWon: s.gamesWon
            });
        });
    });

    const rule = div.advancementRule || 'all_to_single'; 
    
    let championshipPlayers = [];
    let consolationPlayers = [];

    if (rule === 'all_to_single') {

        const superSort = (a, b) => {
            if (a.groupRank !== b.groupRank) return a.groupRank - b.groupRank;
            if (b.pts !== a.pts) return b.pts - a.pts;
            if (b.winRatio !== a.winRatio) return b.winRatio - a.winRatio;
            if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
            return b.totalScore - a.totalScore;
        };
        let sortedAll = allStandings.sort(superSort);
        championshipPlayers = sortedAll.map(s => s.player);
        
    } else {

        const perfSort = (a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            if (b.winRatio !== a.winRatio) return b.winRatio - a.winRatio;
            if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
            return b.totalScore - a.totalScore;
        };
        
        let rank1s = allStandings.filter(s => s.groupRank === 1).sort(perfSort);
        let poolOrder = rank1s.map(s => s.groupIdx); 

        if (poolOrder.length === 0) poolOrder = div.bracket.map((_, i) => i);

        const crossSort = (a, b) => {
            if (a.groupRank !== b.groupRank) return a.groupRank - b.groupRank;
            return poolOrder.indexOf(a.groupIdx) - poolOrder.indexOf(b.groupIdx);
        };

        let sortedAll = allStandings.sort(crossSort);

        const buildCrossRoster = (standings, ranks) => {
            let roster = [];
            for (let i = 0; i < ranks.length; i++) {
                let rankPlayers = standings.filter(s => s.groupRank === ranks[i]).map(s => s.player);

                if (i % 2 !== 0 && rankPlayers.length >= 4) {
                    let half = Math.floor(rankPlayers.length / 2);
                    rankPlayers = rankPlayers.slice(half).concat(rankPlayers.slice(0, half));
                }
                roster = roster.concat(rankPlayers);
            }
            return roster;
        };

        if (rule === 'single_bracket') { 
            championshipPlayers = buildCrossRoster(sortedAll, [1, 2]);
        } else if (rule === 'split_bracket') { 
            championshipPlayers = buildCrossRoster(sortedAll, [1, 2]);
            
            let maxRank = Math.max(...allStandings.map(s => s.groupRank));
            let consRanks = [];
            for(let r = 3; r <= maxRank; r++) consRanks.push(r);
            
            consolationPlayers = buildCrossRoster(sortedAll, consRanks);
        }
    }

    if (championshipPlayers.length > 0) {
        lockedDivisions.push({
            name: champName,
            format: "single_elim",
            mode: div.mode,
            participants: championshipPlayers,
            bracket: [],
            isFromRR: true
        });
    }

    if (consolationPlayers.length > 0) {
        lockedDivisions.push({
            name: div.name + " (Consolation)",
            format: "single_elim",
            mode: div.mode,
            participants: consolationPlayers,
            bracket: [],
            isFromRR: true
        });
    }

    document.getElementById('btn-start').click(); 

    const tName = document.getElementById('tournament-name').value || "Tournament";
    db.ref('tournaments/active').set({
        name: tName,
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
        divisions: lockedDivisions
    }).then(() => {
        console.log("Knockout brackets synced to Firebase.");
    }).catch(e => {
        console.error("Failed to sync knockout brackets:", e);
    });
};

function renderTournamentView() {
    let html = '';
    lockedDivisions.forEach((div, divIdx) => {
        let formatLabel = div.format.includes('elim') ? 'Knockout' : 'Round Robin';
        html += `<div class="section-title" style="margin-top: 40px; border-top: 1px solid #444; padding-top:20px;">${div.name} (${div.mode} - ${formatLabel})</div>`;
        
        if (div.format === 'single_elim' || div.format === 'double_elim') {

            if (div.format === 'double_elim') {
                html += `<h3 style="color:var(--uha-blue); margin-top: 10px;">Winners Bracket</h3>`;
            }
            html += `<div class="bracket-layout"><div class="bracket-columns">`;
            
            div.bracket.forEach((round, rIdx) => {
                html += `<div class="bracket-round">`;
                html += `<div class="bracket-header" style="margin-bottom: 20px; color: var(--uha-gold);">Round ${rIdx + 1}</div>`; 
                html += `<div class="bracket-matches">`; 
                round.forEach((match, mIdx) => {
                    html += generateMatchCardHTML(match, divIdx, rIdx, mIdx);
                });
                html += `</div></div>`; 
            }); 
            html += `</div></div>`; 

            if (div.format === 'double_elim' && div.losersBracket) {
                html += `<hr style="border: 0; border-top: 2px dashed #444; margin: 40px 0;">`;
                html += `<h3 style="color:var(--uha-blue); margin-top: 10px;">Losers Bracket</h3>`;
                
                // Added flex-wrap to prevent the horizontal scrollbar
                html += `<div class="bracket-layout"><div class="bracket-columns" style="flex-wrap: wrap; justify-content: center;">`;
                div.losersBracket.forEach((round, rIdx) => {
                    html += `<div class="bracket-round">`;
                    html += `<div class="bracket-header" style="margin-bottom: 20px; color: var(--uha-gold);">L-Round ${rIdx + 1}</div>`; 
                    html += `<div class="bracket-matches">`; 
                    round.forEach((match, mIdx) => {
                        html += generateMatchCardHTML(match, divIdx, rIdx, mIdx, 'losers'); 
                    });
                    html += `</div></div>`; 
                }); 
                html += `</div></div>`;
            }

            if (div.format === 'double_elim' && div.finalsBracket) {
                html += `<hr style="border: 0; border-top: 2px solid var(--uha-gold); margin: 50px 0 20px 0;">`;
                html += `<h2 style="color:var(--uha-gold); text-align:center; text-transform:uppercase;">Championship Finals</h2>`;
                html += `<div style="display: flex; justify-content: center; gap: 40px; padding: 20px; flex-wrap: wrap;">`;
                
                div.finalsBracket.forEach((round, rIdx) => {
                    let match = round[0]; 
                    if (rIdx === 0 || (rIdx === 1 && match.p1)) { 
                        html += `<div class="bracket-round">`;
                        html += `<div class="bracket-header" style="margin-bottom: 20px; color: var(--uha-gold);">${rIdx === 0 ? 'Match 1' : 'If Necessary'}</div>`;
                        html += `<div class="bracket-matches">`;
                        html += generateMatchCardHTML(match, divIdx, rIdx, 0, 'finals'); 
                        html += `</div></div>`;
                    }
                });
                html += `</div>`;
            }
            
        } else if (div.format === 'round_robin' || div.format === 'multi_group_rr') {

            div.bracket.forEach((groupMatches, groupIndex) => {
                let groupParticipants = div.format === 'multi_group_rr' ? div.draftedGroups[groupIndex] : div.participants;
                let standings = calculateStandings(groupParticipants, groupMatches);

                if (div.format === 'multi_group_rr') {
                    html += `<h3 style="color:var(--uha-blue); margin-top: 30px; border-left: 4px solid var(--uha-gold); padding-left: 10px;">Group ${groupIndex + 1}</h3>`;
                }

                html += `<table class="standings-table" style="margin-bottom: 20px;">
                    <tr><th>Rk</th><th>Player / Team</th><th>Pts</th><th>W-L</th><th>Games Won</th><th>Total Score</th></tr>`;
                standings.forEach((s, i) => {
                    html += `<tr>
                        <td style="color:var(--uha-gold); font-weight:bold;">${i+1}</td>
                        <td style="text-align:left; font-weight:bold;">${s.player.name}</td>
                        <td style="color:var(--uha-blue); font-weight:bold;">${s.pts}</td>
                        <td>${s.matchWins}-${s.matchLosses}</td>
                        <td>${s.gamesWon}</td>
                        <td>${s.totalScore}</td>
                    </tr>`;
                });
                html += `</table>`;

                html += `<div class="bracket-columns" style="flex-wrap: wrap; margin-bottom: 40px;">`;
                groupMatches.forEach((match, mIdx) => {
                    html += generateMatchCardHTML(match, divIdx, groupIndex, mIdx);
                });
                html += `</div>`;
            });

            if (isAdmin) {
                html += `<button class="uha-btn uha-btn-gold" style="margin-top:10px; margin-bottom:30px;" onclick="advanceToKnockout(${divIdx})">Generate Knockout(s) from Standings</button>`;
            }
        }
    });

    const container = document.getElementById('matchup-container');
    if (container) container.innerHTML = html;
}

function generateMatchCardHTML(match, divIdx, rIdx, mIdx, bracketType = 'winners') {
    let teamA = match.p1 ? match.p1.name : "BYE";
    let teamB = match.p2 ? match.p2.name : "BYE";
    
    let hasScore = match.scores && match.scores !== 'BYE';
    let scoreA = hasScore ? `[${match.p1Wins}]` : '';
    let scoreB = hasScore ? `[${match.p2Wins}]` : '';

    // --- NEW COLOR LOGIC ---
    let classA = "";
    let classB = "";

    if (hasScore) {
        if (match.p1Wins > match.p2Wins) {
            classA = "text-win";
            classB = "text-lose";
        } else if (match.p2Wins > match.p1Wins) {
            classA = "text-lose";
            classB = "text-win";
        }
    }
    // -----------------------

    let actionArea = '';

    if (isViewingArchive) {
        actionArea = `<div style="color:var(--text-muted); font-size:12px; text-align:center; padding:8px;">Archived - Read Only</div>`;
    } else if (teamA === "BYE" || teamB === "BYE") {
        actionArea = `<div style="color:var(--text-muted); font-size:12px; text-align:center; padding:8px;">Auto-Advance</div>`;
    } else if (!hasScore) {
        actionArea = `<button class="uha-btn" style="width:auto; padding:8px 15px;" onclick="openScoreModal(${divIdx}, ${rIdx}, ${mIdx}, '${bracketType}')">Enter Score</button>`;
    } else if (hasScore && isAdmin) {
        actionArea = `<button class="uha-btn uha-btn-outline" style="width:auto; padding:8px 15px;" onclick="openScoreModal(${divIdx}, ${rIdx}, ${mIdx}, '${bracketType}')">Edit Score</button>`;
    } else {
        actionArea = `<div style="color:var(--uha-gold); font-size:12px; text-align:center; padding:8px; font-weight:bold;">Match Complete</div>`;
    }

    return `
        <div class="match-card">
            <div style="flex:1;">
                <div class="match-team ${classA}">
                    <span>${teamA}</span>
                    <span>${scoreA}</span>
                </div>

                <div class="match-vs" style="color: #3498db;">vs</div>

                <div class="match-team ${classB}">
                    <span>${teamB}</span>
                    <span>${scoreB}</span>
                </div>

                ${hasScore ? `<div style="text-align:center; font-size:11px; color:#fff; margin-top:8px; border-top: 1px solid #2a2a2a; padding-top: 5px;">${match.scores}</div>` : ''}
            </div>
            <div style="margin-top: 10px; display: flex; justify-content: center;">
                ${actionArea}
            </div>
        </div>
    `;
}

let currentScoreContext = null;

window.openScoreModal = function(divIdx, rIdx, mIdx, bType = 'winners') {
    currentScoreContext = { divIdx, rIdx, mIdx, bType };
    const targetBracket = bType === 'finals' ? lockedDivisions[divIdx].finalsBracket : (bType === 'losers' ? lockedDivisions[divIdx].losersBracket : lockedDivisions[divIdx].bracket);
    const match = targetBracket[rIdx][mIdx];
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
    const { divIdx, rIdx, mIdx, bType } = currentScoreContext;
    const div = lockedDivisions[divIdx];
    
    const targetBracket = bType === 'finals' ? div.finalsBracket : (bType === 'losers' ? div.losersBracket : div.bracket);
    const match = targetBracket[rIdx][mIdx];

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

    if (match.winner && (div.format === 'single_elim' || div.format === 'double_elim')) {
        let nextRIdx = rIdx + 1;
        let nextMIdx = (bType === 'losers' && rIdx % 2 === 0) ? mIdx : Math.floor(mIdx / 2);
        
        if (targetBracket[nextRIdx] && targetBracket[nextRIdx][nextMIdx] && targetBracket[nextRIdx][nextMIdx].p1) {
            if(!confirm("Warning: Changing this score will erase the bracket forward. Continue?")) return;
            wipeForwardBracket(divIdx, rIdx, mIdx, bType);
        }
    }

    match.scores = scoreStrings.join(', ');
    match.p1Wins = p1Wins;
    match.p2Wins = p2Wins;
    match.winner = p1Wins > p2Wins ? 'p1' : 'p2';

    const winningTeam = match.winner === 'p1' ? match.p1 : match.p2;
    const losingTeam = match.winner === 'p1' ? match.p2 : match.p1;

    let detailedGames = [];
    for(let i=0; i<3; i++) {
        let s1 = parseInt(p1Inputs[i].value);
        let s2 = parseInt(p2Inputs[i].value);

        if (!isNaN(s1) && !isNaN(s2)) {
            let wScore = match.winner === 'p1' ? s1 : s2;
            let lScore = match.winner === 'p1' ? s2 : s1;
            detailedGames.push({ w: wScore, l: lScore });
        }
    }

    const getIdsFromNames = (teamNameStr) => {
        const names = teamNameStr.split(' & '); 
        return names.map(name => {
            const trimmedName = name.trim();
            const foundPlayer = allPlayers.find(p => p.name === trimmedName);
            return foundPlayer ? Number(foundPlayer.id) : 0; 
        }).filter(id => id !== 0);
    };

    const pendingMatch = {
        id: Date.now(),
        mode: div.mode.toLowerCase(), 
        score: `${Math.max(p1Wins, p2Wins)}-${Math.min(p1Wins, p2Wins)}`,
        winners: getIdsFromNames(winningTeam.name),
        losers: getIdsFromNames(losingTeam.name),
        games: detailedGames
    };

    db.ref('pending').push(pendingMatch)
    .then(() => console.log("Match successfully added to pending queue."))
    .catch(e => console.error("Firebase Rules blocked pending write:", e));

    progressBracket(divIdx, rIdx, mIdx);
    renderTournamentView();
    closeScoreModal();

    const tName = document.getElementById('tourney-title').innerText;

    db.ref('tournaments/active').set({
        name: tName, 
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
        divisions: lockedDivisions
    }).catch(e => console.error("Firebase auto-save failed:", e));
};

function wipeForwardBracket(divIdx, rIdx, mIdx, bType = 'winners') {
    let div = lockedDivisions[divIdx];
    let targetBracket = bType === 'finals' ? div.finalsBracket : (bType === 'losers' ? div.losersBracket : div.bracket);

    let currR = rIdx;
    let currM = mIdx;

    while (targetBracket[currR + 1]) {

        let nextM = (bType === 'losers' && currR % 2 === 0) ? currM : Math.floor(currM / 2);
        let nextMatch = targetBracket[currR + 1][nextM];

        if (nextMatch) {
            nextMatch.p1 = null; nextMatch.p2 = null;
            nextMatch.scores = ''; nextMatch.p1Wins = 0; nextMatch.p2Wins = 0;
            nextMatch.winner = null;
        }
        currR++;
        currM = nextM;
    }
}

function progressBracket(divIdx, rIdx, mIdx) {
    let div = lockedDivisions[divIdx];
    if (div.format !== 'single_elim' && div.format !== 'double_elim') return; 

    const bType = currentScoreContext ? currentScoreContext.bType : 'winners';
    let targetBracket = bType === 'finals' ? div.finalsBracket : (bType === 'losers' ? div.losersBracket : div.bracket);
    let match = targetBracket[rIdx][mIdx];
    
    let winner = match.winner === 'p1' ? match.p1 : match.p2;
    let loser = match.winner === 'p1' ? match.p2 : match.p1;
    
    let nextRIdx = rIdx + 1;
    let nextMIdx = Math.floor(mIdx / 2);

    if (bType === 'winners') {
        if (div.bracket[nextRIdx]) {
            if (mIdx % 2 === 0) div.bracket[nextRIdx][nextMIdx].p1 = winner;
            else div.bracket[nextRIdx][nextMIdx].p2 = winner;
        } else if (div.format === 'double_elim' && div.finalsBracket) {
            div.finalsBracket[0][0].p1 = winner;
        }

        if (div.format === 'double_elim' && div.losersBracket && match.loserDest) { 
            let lr = match.loserDest.rIdx;
            let lm = match.loserDest.mIdx;
            let slot = match.loserDest.slot;

            if (div.losersBracket[lr] && div.losersBracket[lr][lm]) {
                div.losersBracket[lr][lm][slot] = loser;
            }
        }
    } else if (bType === 'losers') {
        if (div.losersBracket[nextRIdx]) {
            if (rIdx % 2 === 0) {
                div.losersBracket[nextRIdx][mIdx].p1 = winner;
            } else {
                if (mIdx % 2 === 0) div.losersBracket[nextRIdx][nextMIdx].p1 = winner;
                else div.losersBracket[nextRIdx][nextMIdx].p2 = winner;
            }
        } else if (div.format === 'double_elim' && div.finalsBracket) {
            div.finalsBracket[0][0].p2 = winner;
        }
    } else if (bType === 'finals') {

        if (rIdx === 0 && div.finalsBracket[1]) {
            if (match.winner === 'p2') {
                div.finalsBracket[1][0].p1 = match.p1;
                div.finalsBracket[1][0].p2 = match.p2;
            } else {
                div.finalsBracket[1][0].p1 = null;
                div.finalsBracket[1][0].p2 = null;
                div.finalsBracket[1][0].scores = '';
                div.finalsBracket[1][0].winner = null;
            }
        }
    }
}

window.archiveTournament = function() {
    if (!isAdmin) return;
    
    db.ref('tournaments/active').once('value').then((snapshot) => {
        const data = snapshot.val();
        if (!data) return alert("No active tournament found to archive.");

        const tName = data.name || "Untitled Tournament";
        if (!confirm(`Are you sure you want to archive "${tName}"?\n\nIt will be moved to history and become read-only. This will clear the dashboard for a new event.`)) return;

        const archiveID = "tourney_" + Date.now();
        return db.ref('tournaments/archived/' + archiveID).set(data).then(() => {
            return db.ref('tournaments/active').remove();
        }).then(() => {
            alert(`"${tName}" archived successfully.`);
            location.reload();
        });
    }).catch(e => console.error("Archive failed:", e));
};

function loadArchiveList() {
    const selector = document.getElementById('public-tournament-selector');
    if (!selector) return;

    db.ref('tournaments/archived').on('value', (snapshot) => {
        const archives = snapshot.val();

        selector.innerHTML = '<option value="active">Current Live Tournament</option>';
        
        if (!archives) return;

        Object.keys(archives).forEach(key => {
            const tourney = archives[key];
            const date = new Date(tourney.updatedAt).toLocaleDateString();
            const name = tourney.name || "Past Event";
            const option = document.createElement('option');
            option.value = 'archived/' + key;
            option.textContent = `${name} (${date})`;
            selector.appendChild(option);
        });
        console.log("Archives loaded:", Object.keys(archives).length);
    });
}

function loadTournamentData(path) {
    db.ref('tournaments/' + path).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && data.divisions) {
            lockedDivisions = data.divisions;
            const titleEl = document.getElementById('tourney-title');
            if(titleEl) titleEl.innerText = data.name || "Live Tournament";
            
            renderTournamentView(); 
        } else {
            const container = document.getElementById('matchup-container');
            if(container) container.innerHTML = "<div style='text-align:center; padding: 50px; color: #888;'>No tournament data found for this selection.</div>";
        }
    });
}

window.editActiveTournament = function() {
    if (!confirm("This will pull the current live tournament back into the setup area. You can then 'Unlock' divisions to edit players. Ready?")) return;

    db.ref('tournaments/active').once('value').then((snapshot) => {
        const data = snapshot.val();
        if (!data || !data.divisions) return alert("No active tournament found to edit.");

        lockedDivisions = data.divisions;
        document.getElementById('tournament-name').value = data.name || "";

        document.getElementById('admin-dashboard').style.display = 'block';
        document.getElementById('tournament-view').style.display = 'none';

        renderLockedDivisions();
        renderRoster();
        
        alert("Setup reloaded. Use the 'Unlock' buttons below to make changes to specific divisions.");
    });
};

const pubSelector = document.getElementById('public-tournament-selector');
if (pubSelector) {
    pubSelector.addEventListener('change', (e) => {
        const path = e.target.value;

        isViewingArchive = path.startsWith('archived');

        const archiveBtn = document.getElementById('btn-archive');
        if (archiveBtn) {
            archiveBtn.style.display = (isAdmin && !isViewingArchive) ? 'block' : 'none';
        }

        db.ref('tournaments').off(); 
        loadTournamentData(path);
    });
}

loadArchiveList();
refreshRosterFromDB();

loadTournamentData('active');
