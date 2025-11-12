// ============================================================================
// CONFIGURATION FIREBASE
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDopLci7L1EvUebzSermotMkMM-w5ocLzw",
  authDomain: "circet-dartmasters.firebaseapp.com",
  projectId: "circet-dartmasters",
  storageBucket: "circet-dartmasters.appspot.com",
  messagingSenderId: "184457292501",
  appId: "1:184457292501:web:3e409efb2953aa57af105c",
  measurementId: "G-2Y3SPXVFFC"
};

let db = null;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  console.log("✅ Firebase initialisé avec succès");
} catch (error) {
  console.error("❌ Erreur Firebase:", error);
  alert("Impossible de se connecter à Firebase. Vérifiez la configuration.");
}

// Global cache des joueurs pour la modale
let allPlayersCache = [];

// ============================================================================
// NAVIGATION
// ============================================================================
function showPage(pageName) {
  console.log(`Navigation vers: ${pageName}`);
  
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const targetPage = document.getElementById(`${pageName}-page`);
  if (targetPage) targetPage.classList.add('active');
  
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
  
  switch(pageName) {
    case 'ranking': renderRanking(); break;
    case 'players': renderPlayers(); break;
    case 'matches': loadPlayersSelect(); renderMatchHistory(); break;
    case 'home': updateQuickStats(); break;
  }
}

// ============================================================================
// JOUEURS
// ============================================================================
async function addPlayer() {
  const name = document.getElementById('playerName').value.trim();
  if (!name) return alert('Veuillez entrer un nom');
  
  const snapshot = await db.collection("players").where("name", "==", name).get();
  if (!snapshot.empty) return alert('Ce joueur existe déjà');
  
  await db.collection("players").add({ name, elo: 1000, wins: 0, losses: 0, matches: 0 });
  document.getElementById('playerName').value = '';
  closeAddPlayerModal();
  await Promise.all([renderPlayers(), renderRanking(), updateQuickStats()]);
}

async function deletePlayer(playerId, playerName) {
  if (!confirm(`Supprimer ${playerName} ? Les matchs seront conservés.`)) return;
  await db.collection("players").doc(playerId).delete();
  await Promise.all([renderPlayers(), renderRanking(), updateQuickStats()]);
}

async function getPlayers() {
  if (!db) return [];
  const snapshot = await db.collection("players").orderBy("name").get();
  const players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  // met à jour le cache global
  allPlayersCache = players;
  return players;
}

async function renderPlayers() {
  const players = await getPlayers();
  const grid = document.getElementById('playersGrid');
  if (!grid) return;
  
  if (!players.length) {
    grid.innerHTML = "<p class='no-data'>Aucun joueur. Ajoutez-en un !</p>";
    return;
  }
  
  // Construire le HTML pour chaque joueur : nom + bouton Voir stats + supprimer
  let html = '';
  players.forEach(p => {
    html += `
      <div class="player-card">
        <div>
          <strong>${p.name}</strong>
          <div style="font-size:0.9rem;color:var(--text-muted)">ELO: ${p.elo}</div>
        </div>
        <div style="display:flex; gap:0.5rem; align-items:center;">
          <button onclick="openPlayerStats('${p.id}')" class="btn-secondary">📊 Voir stats</button>
          <button onclick="deletePlayer('${p.id}', '${p.name}')" class="btn-danger">Supprimer</button>
        </div>
      </div>
    `;
  });
  grid.innerHTML = html;
}

// ============================================================================
// MATCHS
// ============================================================================
let tempMatchData = null;

function openAddMatchModal() {
  const p1 = document.getElementById('player1').value;
  const p2 = document.getElementById('player2').value;
  const score = document.getElementById('matchScore').value.trim().toLowerCase();
  
  if (!p1 || !p2 || !score) return alert('Veuillez remplir tous les champs');
  if (p1 === p2) return alert('Sélectionnez deux joueurs différents');
  if (!/^\d+-\d+(-p\d+)?$/.test(score)) return alert('Format invalide. Ex: 2-0-p1 ou 2-1-p2');
  
  tempMatchData = { p1Id: p1, p2Id: p2, scoreValue: score };
  const p1Name = document.querySelector('#player1 option:checked').text;
  const p2Name = document.querySelector('#player2 option:checked').text;
  document.getElementById('matchConfirmText').innerHTML = `<strong>${p1Name}</strong> vs <strong>${p2Name}</strong><br>Score: ${score}`;
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
  
  let winner, loser, winnerId, loserId;
  if (scoreValue.includes('p1')) {
    winner = player1; loser = player2; winnerId = p1Id; loserId = p2Id;
  } else if (scoreValue.includes('p2')) {
    winner = player2; loser = player1; winnerId = p2Id; loserId = p1Id;
  } else {
    const [s1, s2] = scoreValue.split('-').map(Number);
    if (s1 > s2) { winner = player1; loser = player2; winnerId = p1Id; loserId = p2Id; }
    else { winner = player2; loser = player1; winnerId = p2Id; loserId = p1Id; }
  }
  
  const { newWinnerElo, newLoserElo } = calculateElo(winner.elo, loser.elo, scoreValue);
  
  await Promise.all([
    db.collection("players").doc(winnerId).update({
      elo: newWinnerElo,
      wins: firebase.firestore.FieldValue.increment(1),
      matches: firebase.firestore.FieldValue.increment(1)
    }),
    db.collection("players").doc(loserId).update({
      elo: newLoserElo,
      losses: firebase.firestore.FieldValue.increment(1),
      matches: firebase.firestore.FieldValue.increment(1)
    }),
    db.collection("matches").add({ timestamp: Date.now(), score: scoreValue, winner: winner.name, loser: loser.name, winnerId, loserId })
  ]);
  
  document.getElementById('matchScore').value = '';
  closeAddMatchModal();
  await Promise.all([renderRanking(), renderMatchHistory(), updateQuickStats(), renderPlayers()]);
}

async function deleteLastMatch() {
  const snapshot = await db.collection("matches").orderBy("timestamp", "desc").limit(1).get();
  if (snapshot.empty) return alert("Aucun match à supprimer");
  
  const lastMatchDoc = snapshot.docs[0];
  
  if (confirm("⚠️ Supprimer le dernier match ?\n\nLes stats seront recalculées depuis le début.")) {
    await db.collection("matches").doc(lastMatchDoc.id).delete();
    await recalculateAllStats();
  }
}

// 🆕 SUPPRIMER TOUS LES MATCHS
async function deleteAllMatches() {
  if (!confirm("⚠️ Supprimer TOUS les matchs ?\n\nCette action est irréversible et toutes les statistiques seront recalculées.")) {
    return;
  }

  try {
    const snapshot = await db.collection("matches").get();
    if (snapshot.empty) {
      alert("Aucun match à supprimer.");
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    await recalculateAllStats();
    alert("✅ Tous les matchs ont été supprimés avec succès !");
  } catch (error) {
    console.error("❌ Erreur deleteAllMatches:", error);
    alert("Erreur lors de la suppression des matchs: " + error.message);
  }
}

async function deleteMatch(matchId) {
  if (!confirm("⚠️ Voulez-vous vraiment supprimer ce match ?\n\nLes stats ELO seront recalculées.")) return;
  try {
    await db.collection("matches").doc(matchId).delete();
    await recalculateAllStats();
  } catch (error) {
    console.error("❌ Erreur deleteMatch:", error);
    alert("Erreur: " + error.message);
  }
}

// ============================================================================
// RECALCUL STATS
// ============================================================================
async function recalculateAllStats() {
  if (!db) return alert("Firebase non initialisé");
  
  if (!confirm("🚨 ATTENTION ! Cette action réinitialise tous les ELO et recalcule toutes les stats.")) return;
  
  const button = event?.target;
  const originalText = button?.textContent || '🔄 Recalculer toutes les stats';
  
  try {
    if (button) { button.disabled = true; button.textContent = '⏳ Recalcul en cours...'; }
    
    const playersSnapshot = await db.collection("players").get();
    if (playersSnapshot.empty) return alert("Aucun joueur trouvé");
    
    const playersData = {};
    const batchReset = db.batch();
    
    playersSnapshot.forEach(doc => {
      playersData[doc.id] = { elo: 1000, wins: 0, losses: 0, matches: 0 };
      batchReset.update(db.collection("players").doc(doc.id), playersData[doc.id]);
    });
    await batchReset.commit();
    
    const matchesSnapshot = await db.collection("matches").orderBy("timestamp", "asc").get();
    if (matchesSnapshot.empty) return alert("Aucun match à recalculer");
    
    for (const doc of matchesSnapshot.docs) {
      const m = doc.data();
      const winner = playersData[m.winnerId];
      const loser = playersData[m.loserId];
      if (!winner || !loser) continue;
      
      const { newWinnerElo, newLoserElo } = calculateElo(winner.elo, loser.elo, m.score);
      winner.elo = newWinnerElo; winner.wins++; winner.matches++;
      loser.elo = newLoserElo; loser.losses++; loser.matches++;
    }
    
    const batchUpdate = db.batch();
    Object.entries(playersData).forEach(([id, data]) => batchUpdate.update(db.collection("players").doc(id), data));
    await batchUpdate.commit();
    
    await Promise.all([renderRanking(), renderMatchHistory(), updateQuickStats(), renderPlayers()]);
    alert("✅ Recalcul terminé !");
  } catch (error) {
    console.error("❌ Erreur recalculateAllStats:", error);
    alert("Erreur lors du recalcul: " + error.message);
  } finally {
    if (button) { button.disabled = false; button.textContent = originalText; }
  }
}

// ============================================================================
// CLASSEMENT
// ============================================================================
async function renderRanking() {
  const players = await getPlayers();
  const rankingDiv = document.getElementById('rankingTable');

  if (!players.length) {
    rankingDiv.innerHTML = '<p class="no-data">Aucun joueur enregistré</p>';
    return;
  }

  // Tri des joueurs par ELO
  players.sort((a, b) => b.elo - a.elo);

  let html = `
    <table style="width:100%; border-collapse:collapse; text-align:center;">
      <thead>
        <tr style="background: var(--primary); color: var(--accent);">
          <th style="padding:1rem;">Rang</th>
          <th style="padding:1rem;">Joueur</th>
          <th style="padding:1rem;">ELO</th>
          <th style="padding:1rem;">Victoires</th>
          <th style="padding:1rem;">Défaites</th>
          <th style="padding:1rem;">Matchs joués</th>
          <th style="padding:1rem;">Ratio</th>
        </tr>
      </thead>
      <tbody>
  `;

  players.forEach((p, i) => {
    const ratio = p.matches > 0 ? (p.wins / p.matches).toFixed(2) : "0.00";
    let medal = "";

    // 🥇🥈🥉 Ajout des médailles selon le rang
    if (i === 0) medal = " 🥇";
    else if (i === 1) medal = " 🥈";
    else if (i === 2) medal = " 🥉";

    html += `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:1rem;">${i + 1}</td>
        <td style="padding:1rem; text-align:left;">${p.name}${medal}</td>
        <td style="padding:1rem;">${p.elo}</td>
        <td style="padding:1rem;">${p.wins}</td>
        <td style="padding:1rem;">${p.losses}</td>
        <td style="padding:1rem;">${p.matches}</td>
        <td style="padding:1rem;">${ratio}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  rankingDiv.innerHTML = html;
}

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================
async function loadPlayersSelect() {
  const players = await getPlayers();
  const p1 = document.getElementById('player1');
  const p2 = document.getElementById('player2');
  if (!p1 || !p2) return;
  
  p1.innerHTML = '<option value="">-- Joueur 1 --</option>';
  p2.innerHTML = '<option value="">-- Joueur 2 --</option>';
  players.forEach(p => {
    p1.innerHTML += `<option value="${p.id}">${p.name}</option>`;
    p2.innerHTML += `<option value="${p.id}">${p.name}</option>`;
  });
}

async function renderMatchHistory() {
  const snapshot = await db.collection("matches").orderBy("timestamp", "desc").limit(20).get();
  const c = document.getElementById('matchHistory');
  if (snapshot.empty) return c.innerHTML = "<p class='no-data'>Aucun match</p>";
  
  let html = '';
  snapshot.docs.forEach(doc => {
    const m = doc.data();
    const date = new Date(m.timestamp).toLocaleDateString('fr-FR');
    html += `<div class="match-item">
      <div class="match-info">
        <strong>${m.winner}</strong> vs ${m.loser}
        <span style="color:var(--accent); margin-left:1rem;">${m.score}</span>
        <div style="font-size:0.85rem;color:var(--text-muted)">${date}</div>
      </div>
      <div class="match-actions">
        <button onclick="deleteMatch('${doc.id}')" class="btn-danger delete-match-btn">🗑️ Supprimer</button>
      </div>
    </div>`;
  });
  c.innerHTML = html;
}

async function updateQuickStats() {
  const players = await getPlayers();
  const matches = await db.collection("matches").get();
  document.getElementById('quickStats').innerHTML = `
    <div class="stat-item"><div>Joueurs</div><strong>${players.length}</strong></div>
    <div class="stat-item"><div>Matchs</div><strong>${matches.size}</strong></div>
    <div class="stat-item"><div>Moyenne ELO</div><strong>${players.length ? Math.round(players.reduce((a,p)=>a+p.elo,0)/players.length) : 0}</strong></div>
  `;
}

function calculateElo(wElo, lElo, score) {
  const K = 32;
  const mult = score === '2-0' ? 1.2 : 1.0;
  const exp = 1 / (1 + Math.pow(10, (lElo - wElo)/400));
  return {
    newWinnerElo: Math.round(wElo + K * mult * (1 - exp)),
    newLoserElo: Math.round(lElo + K * mult * (0 - exp))
  };
}

// ============================================================================
// PLAYER STATS MODAL
// ============================================================================
function openPlayerStats(playerId) {
  // chercher dans le cache global (rempli par getPlayers)
  const player = allPlayersCache.find(p => p.id === playerId);
  if (!player) {
    alert("Joueur introuvable");
    return;
  }

  const ratio = player.matches > 0 ? (player.wins / player.matches).toFixed(2) : "0.00";

  const content = `
    <h3 style="margin-bottom:0.5rem;">${player.name}</h3>
    <div style="font-size:0.95rem;color:var(--text-muted);margin-bottom:0.75rem;">Informations du joueur</div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem;">
      <div><strong>ELO</strong></div><div>${player.elo}</div>
      <div><strong>Victoires</strong></div><div>${player.wins}</div>
      <div><strong>Défaites</strong></div><div>${player.losses}</div>
      <div><strong>Matchs joués</strong></div><div>${player.matches}</div>
      <div><strong>Ratio</strong></div><div>${ratio}</div>
    </div>
  `;

  const modal = document.getElementById('playerStatsModal');
  const inner = document.getElementById('playerStatsInner');
  if (inner) inner.innerHTML = content;
  if (modal) modal.style.display = 'block';
}

function closePlayerStats() {
  const modal = document.getElementById('playerStatsModal');
  if (modal) modal.style.display = 'none';
}

// ============================================================================
// MODALS - ADD PLAYER
// ============================================================================
function openAddPlayerModal() {
  document.getElementById('addPlayerModal').style.display = 'block';
  const input = document.getElementById('playerName');
  if (input) input.focus();
}
function closeAddPlayerModal() {
  document.getElementById('addPlayerModal').style.display = 'none';
  const input = document.getElementById('playerName');
  if (input) input.value = '';
}

// ============================================================================
// DÉMARRAGE
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 Application démarrée");
  setTimeout(() => { updateQuickStats(); loadPlayersSelect(); renderPlayers(); }, 300);
});
