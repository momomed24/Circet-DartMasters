// Initialisation Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDopLci7L1EvUebzSermotMkMM-w5ocLzw",
  authDomain: "circet-dartmasters.firebaseapp.com",
  projectId: "circet-dartmasters",
  storageBucket: "circet-dartmasters.appspot.com",
  messagingSenderId: "184457292501",
  appId: "1:184457292501:web:3e409efb2953aa57af105c",
  measurementId: "G-2Y3SPXVFFC"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Navigation
function showPage(pageName) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`${pageName}-page`).classList.add('active');
  
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  if (pageName === 'ranking') renderRanking();
  if (pageName === 'players') renderPlayers();
  if (pageName === 'matches') { loadPlayersSelect(); renderMatchHistory(); }
}

// Joueurs
async function addPlayer() {
  const name = document.getElementById('playerName').value.trim();
  if (!name) return alert('Veuillez entrer un nom');
  
  const snapshot = await db.collection("players").where("name", "==", name).get();
  if (!snapshot.empty) return alert('Ce joueur existe déjà');
  
  await db.collection("players").add({
    name, elo: 1200, wins: 0, losses: 0, matches: 0
  });
  
  document.getElementById('playerName').value = '';
  closeAddPlayerModal();
  renderPlayers();
  renderRanking();
}

async function deletePlayer(playerId, playerName) {
  if (!confirm(`Supprimer ${playerName} ? Les matchs seront conservés.`)) return;
  await db.collection("players").doc(playerId).delete();
  renderPlayers();
  renderRanking();
}

async function getPlayers() {
  const snapshot = await db.collection("players").get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Matchs
let tempMatchData = null;

function openAddMatchModal() {
  const p1 = document.getElementById('player1').value;
  const p2 = document.getElementById('player2').value;
  const score = document.getElementById('matchScore').value.trim();
  
  if (!p1 || !p2 || !score) return alert('Veuillez remplir tous les champs');
  if (p1 === p2) return alert('Sélectionnez deux joueurs différents');
  
  tempMatchData = { p1Id: p1, p2Id: p2, scoreValue: score };
  document.getElementById('matchConfirmText').textContent = 
    `Confirmer le match : ${document.querySelector('#player1 option:checked').text} vs ${document.querySelector('#player2 option:checked').text} (${score})`;
  document.getElementById('addMatchModal').style.display = 'block';
}

function closeAddMatchModal() {
  document.getElementById('addMatchModal').style.display = 'none';
  tempMatchData = null;
}

async function confirmAddMatch() {
  if (!tempMatchData) return;
  
  const { p1Id, p2Id, scoreValue } = tempMatchData;
  const p1Doc = await db.collection("players").doc(p1Id).get();
  const p2Doc = await db.collection("players").doc(p2Id).get();
  const player1 = p1Doc.data();
  const player2 = p2Doc.data();
  
  let winner, loser, score, winnerId, loserId;
  if (scoreValue.includes('p1')) {
    winner = player1; loser = player2; winnerId = p1Id; loserId = p2Id; score = '2-0';
  } else if (scoreValue.includes('p2')) {
    winner = player2; loser = player1; winnerId = p2Id; loserId = p1Id; score = '2-0';
  } else {
    const [s1, s2] = scoreValue.split('-').map(Number);
    if (s1 > s2) {
      winner = player1; loser = player2; winnerId = p1Id; loserId = p2Id;
    } else {
      winner = player2; loser = player1; winnerId = p2Id; loserId = p1Id;
    }
    score = scoreValue;
  }
  
  const { newWinnerElo, newLoserElo } = calculateElo(winner.elo, loser.elo, score);
  
  await db.collection("players").doc(winnerId).update({
    elo: newWinnerElo,
    wins: firebase.firestore.FieldValue.increment(1),
    matches: firebase.firestore.FieldValue.increment(1)
  });
  
  await db.collection("players").doc(loserId).update({
    elo: newLoserElo,
    losses: firebase.firestore.FieldValue.increment(1),
    matches: firebase.firestore.FieldValue.increment(1)
  });
  
  await db.collection("matches").add({
    timestamp: Date.now(),
    score: scoreValue,
    winner: winner.name,
    loser: loser.name,
    winnerId,
    loserId
  });
  
  document.getElementById('matchScore').value = '';
  closeAddMatchModal();
  renderRanking();
  renderMatchHistory();
}

async function deleteLastMatch() {
  const snapshot = await db.collection("matches").orderBy("timestamp", "desc").limit(1).get();
  if (snapshot.empty) return alert("Aucun match à supprimer");
  
  const lastMatchDoc = snapshot.docs[0];
  const match = lastMatchDoc.data();
  
  const winnerDoc = await db.collection("players").doc(match.winnerId).get();
  const loserDoc = await db.collection("players").doc(match.loserId).get();
  
  await db.collection("players").doc(match.winnerId).update({
    elo: firebase.firestore.FieldValue.increment(-32),
    wins: firebase.firestore.FieldValue.increment(-1),
    matches: firebase.firestore.FieldValue.increment(-1)
  });
  
  await db.collection("players").doc(match.loserId).update({
    elo: firebase.firestore.FieldValue.increment(32),
    losses: firebase.firestore.FieldValue.increment(-1),
    matches: firebase.firestore.FieldValue.increment(-1)
  });
  
  await db.collection("matches").doc(lastMatchDoc.id).delete();
  
  renderRanking();
  renderMatchHistory();
}

// ELO
function calculateElo(winnerElo, loserElo, score) {
  const K = 32;
  const multiplier = score === '2-0' ? 1.2 : 1.0;
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  return {
    newWinnerElo: Math.round(winnerElo + K * multiplier * (1 - expectedWinner)),
    newLoserElo: Math.round(loserElo + K * multiplier * (0 - expectedWinner))
  };
}

// Render functions
async function renderRanking() {
  const players = await getPlayers();
  const tableDiv = document.getElementById('rankingTable');
  
  if (!players.length) {
    tableDiv.innerHTML = "<p class='no-data'>Aucun joueur</p>";
    return;
  }
  
  let html = `<table><thead><tr>
    <th>Rang</th><th>Joueur</th><th>ELO</th><th>V</th><th>D</th><th>Ratio</th>
  </tr></thead><tbody>`;
  
  players.sort((a,b) => b.elo - a.elo).forEach((p,i) => {
    const ratio = p.matches ? (p.wins / p.matches * 100).toFixed(1) : '0.0';
    html += `<tr>
      <td>${i+1}</td>
      <td><strong>${p.name}</strong></td>
      <td>${p.elo}</td>
      <td>${p.wins}</td>
      <td>${p.losses}</td>
      <td>${ratio}%</td>
    </tr>`;
  });
  html += "</tbody></table>";
  tableDiv.innerHTML = html;
}

async function renderPlayers() {
  const players = await getPlayers();
  const grid = document.getElementById('playersGrid');
  const select = document.getElementById('playerStatsSelect');
  
  grid.innerHTML = '';
  select.innerHTML = '<option value="">Choisir un joueur</option>';
  
  players.forEach(p => {
    const card = document.createElement('div');
    card.className = 'player-card';
    card.innerHTML = `
      <div>
        <strong>${p.name}</strong>
        <div style="font-size:0.9rem;color:var(--text-muted)">ELO: ${p.elo}</div>
      </div>
      <button onclick="deletePlayer('${p.id}', '${p.name}')" class="btn-danger" style="padding:0.4rem 0.8rem">Supprimer</button>
    `;
    grid.appendChild(card);
    
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.name;
    select.appendChild(option);
  });
}

async function loadPlayersSelect() {
  const players = await getPlayers();
  const p1Select = document.getElementById('player1');
  const p2Select = document.getElementById('player2');
  
  p1Select.innerHTML = '<option value="">Joueur 1</option>';
  p2Select.innerHTML = '<option value="">Joueur 2</option>';
  
  players.forEach(p => {
    p1Select.innerHTML += `<option value="${p.id}">${p.name}</option>`;
    p2Select.innerHTML += `<option value="${p.id}">${p.name}</option>`;
  });
}

async function renderMatchHistory() {
  const snapshot = await db.collection("matches").orderBy("timestamp", "desc").limit(20).get();
  const container = document.getElementById('matchHistory');
  
  if (snapshot.empty) {
    container.innerHTML = "<p class='no-data'>Aucun match</p>";
    return;
  }
  
  let html = '';
  snapshot.docs.forEach(doc => {
    const m = doc.data();
    const date = new Date(m.timestamp).toLocaleDateString('fr-FR');
    html += `<div class="match-item">
      <div>
        <strong>${m.winner}</strong> vs ${m.loser}
        <div style="font-size:0.85rem;color:var(--text-muted)">${date}</div>
      </div>
      <div style="color:var(--accent);font-weight:bold">${m.score}</div>
    </div>`;
  });
  container.innerHTML = html;
}

async function showPlayerStats() {
  const playerId = document.getElementById('playerStatsSelect').value;
  const statsDiv = document.getElementById('playerStats');
  
  if (!playerId) {
    statsDiv.innerHTML = '';
    return;
  }
  
  const player = await db.collection("players").doc(playerId).get();
  const p = player.data();
  const ratio = p.matches ? (p.wins / p.matches * 100).toFixed(1) : '0.0';
  
  statsDiv.innerHTML = `
    <div class="quick-stats">
      <div class="stat-item">
        <div>ELO</div>
        <strong>${p.elo}</strong>
      </div>
      <div class="stat-item">
        <div>Victoires</div>
        <strong>${p.wins}</strong>
      </div>
      <div class="stat-item">
        <div>Défaites</div>
        <strong>${p.losses}</strong>
      </div>
      <div class="stat-item">
        <div>Ratio</div>
        <strong>${ratio}%</strong>
      </div>
    </div>
  `;
}

// Modals
function openAddPlayerModal(){ 
  document.getElementById('addPlayerModal').style.display='block';
  document.getElementById('playerName').focus();
}

function closeAddPlayerModal(){ 
  document.getElementById('addPlayerModal').style.display='none';
  document.getElementById('playerName').value = '';
}

// Stats rapides
async function updateQuickStats() {
  const players = await getPlayers();
  const matches = await db.collection("matches").get();
  
  document.getElementById('quickStats').innerHTML = `
    <div class="stat-item">
      <div>Joueurs</div>
      <strong>${players.length}</strong>
    </div>
    <div class="stat-item">
      <div>Matchs joués</div>
      <strong>${matches.size}</strong>
    </div>
    <div class="stat-item">
      <div>Moyenne ELO</div>
      <strong>${players.length ? Math.round(players.reduce((a,p) => a + p.elo, 0) / players.length) : 0}</strong>
    </div>
  `;
}

// Initialisation
showPage('home');
updateQuickStats();