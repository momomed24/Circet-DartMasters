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
    case 'history': loadHistoryPage(); break; // NOUVEAU
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
          <div style="font-size:0.9rem;color:var(--text-muted)">ELO: ${Math.round(p.elo)}</div>
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
    db.collection("matches").add({ 
      timestamp: Date.now(), 
      score: scoreValue, 
      winner: winner.name, 
      loser: loser.name, 
      winnerId, 
      loserId,
      date: new Date().toISOString().split('T')[0] // NOUVEAU: pour filtrer par date
    })
  ]);
  
  // Sauvegarder l'évolution ELO individuelle
  await savePlayerEloHistory(winnerId, newWinnerElo);
  await savePlayerEloHistory(loserId, newLoserElo);
  
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
    
    // Nettoyer l'historique ELO lors du recalcul complet
    await db.collection("player_elo_history").get().then(snapshot => {
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      return batch.commit();
    });
    
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
        <td style="padding:1rem;">${Math.round(p.elo)}</td>
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
// PLAYER STATS MODAL AMÉLIORÉ
// ============================================================================
async function openPlayerStats(playerId) {
  const player = allPlayersCache.find(p => p.id === playerId);
  if (!player) {
    alert("Joueur introuvable");
    return;
  }

  const ratio = player.matches > 0 ? (player.wins / player.matches).toFixed(2) : "0.00";

  // RÉCUPÉRER L'HISTORIQUE DES MATCHS DU JOUEUR
  const matchesSnapshot = await db.collection("matches")
    .where("winnerId", "==", playerId)
    .where("loserId", "==", playerId)
    .orderBy("timestamp", "desc")
    .limit(10)
    .get();

  // Combiner les matchs où le joueur est winner ou loser
  const playerMatches = [];
  const allMatches = await db.collection("matches").orderBy("timestamp", "desc").get();
  allMatches.docs.forEach(doc => {
    const m = doc.data();
    if (m.winnerId === playerId || m.loserId === playerId) {
      playerMatches.push({ id: doc.id, ...m });
    }
  });

  // Prendre les 10 derniers
  const lastMatches = playerMatches.slice(0, 10);

  let matchHistoryHtml = '';
  if (lastMatches.length > 0) {
    matchHistoryHtml = '<h4 style="margin-top: 1.5rem; color: var(--accent);">📊 Derniers matchs</h4>';
    lastMatches.forEach(m => {
      const isWin = m.winnerId === playerId;
      const opponentName = isWin ? m.loser : m.winner;
      const date = new Date(m.timestamp).toLocaleDateString('fr-FR');
      matchHistoryHtml += `
        <div class="player-history-match ${isWin ? 'won' : 'lost'}">
          <strong>${isWin ? 'Victoire' : 'Défaite'}</strong> vs ${opponentName}
          <span style="color:var(--accent); margin-left:1rem;">${m.score}</span>
          <div style="font-size:0.85rem;color:var(--text-muted)">${date}</div>
        </div>
      `;
    });
  }

  const content = `
    <h3 style="margin-bottom:0.5rem;">${player.name}</h3>
    <div style="font-size:0.95rem;color:var(--text-muted);margin-bottom:0.75rem;">Informations du joueur</div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem;">
      <div><strong>ELO</strong></div><div>${Math.round(player.elo)}</div>
      <div><strong>Victoires</strong></div><div>${player.wins}</div>
      <div><strong>Défaites</strong></div><div>${player.losses}</div>
      <div><strong>Matchs joués</strong></div><div>${player.matches}</div>
      <div><strong>Ratio</strong></div><div>${ratio}</div>
    </div>
    ${matchHistoryHtml}
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
// ===== NOUVELLES FONCTIONS POUR L'HISTORIQUE DES CLASSEMENTS =====
// ============================================================================

// Sauvegarder l'historique ELO d'un joueur
async function savePlayerEloHistory(playerId, elo) {
  const today = new Date().toISOString().split('T')[0];
  await db.collection("player_elo_history").doc(`${playerId}_${today}`).set({
    playerId: playerId,
    date: today,
    elo: elo,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// Charger la page d'historique
async function loadHistoryPage() {
  if (!db) return;

  const select = document.getElementById('historyDateSelect');
  select.innerHTML = '<option value="">-- Chargement des dates... --</option>';

  try {
    const snapshot = await db.collection('ranking_history')
      .orderBy('date', 'desc')
      .get();
    
    select.innerHTML = '<option value="">-- Sélectionner une date --</option>';
    
    if (snapshot.empty) {
      select.innerHTML = '<option value="">Aucun historique disponible</option>';
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      const option = document.createElement('option');
      option.value = data.date;
      option.textContent = formatDate(data.date) + ` (${data.rankings?.length || 0} joueurs)`;
      select.appendChild(option);
    });

    // Charger automatiquement le dernier
    if (snapshot.docs[0]) {
      const lastDate = snapshot.docs[0].data().date;
      select.value = lastDate;
      loadHistoricalRanking(lastDate);
    }
  } catch (error) {
    console.error('Erreur chargement historique:', error);
    showNotification('Erreur lors du chargement de l\'historique', 'error');
  }
}

// Charger un classement historique
async function loadHistoricalRanking(date) {
  if (!date || !db) return;

  const container = document.getElementById('historyRankingTable');
  container.innerHTML = '<div class="loading">Chargement du classement...</div>';

  try {
    const doc = await db.collection('ranking_history').doc(date).get();
    
    if (!doc.exists) {
      container.innerHTML = '<div class="no-data">Aucun classement pour cette date</div>';
      return;
    }

    const data = doc.data();
    const rankings = data.rankings || [];
    
    // Récupérer le classement précédent pour comparaison
    const prevSnapshot = await db.collection('ranking_history')
      .where('date', '<', date)
      .orderBy('date', 'desc')
      .limit(1)
      .get();
    
    const previousRankings = prevSnapshot.empty ? [] : prevSnapshot.docs[0].data().rankings;
    const rankChanges = calculateRankChanges(rankings, previousRankings);

    displayHistoricalRankings(rankings, rankChanges, date);
  } catch (error) {
    console.error('Erreur chargement classement:', error);
    container.innerHTML = '<div class="no-data">Erreur lors du chargement</div>';
  }
}

// Calculer les changements de rang
function calculateRankChanges(current, previous) {
  const changes = {};
  const previousMap = {};
  
  previous.forEach(p => {
    previousMap[p.playerId] = p.position;
  });

  current.forEach(c => {
    if (previousMap[c.playerId]) {
      const diff = previousMap[c.playerId] - c.position;
      changes[c.playerId] = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
    } else {
      changes[c.playerId] = 'Nouveau';
    }
  });

  return changes;
}

// Afficher le tableau historique
function displayHistoricalRankings(rankings, rankChanges, date) {
  const container = document.getElementById('historyRankingTable');
  
  if (rankings.length === 0) {
    container.innerHTML = '<div class="no-data">Aucun joueur dans ce classement</div>';
    return;
  }

  let html = `
    <h3 style="color: var(--accent); margin-bottom: 1rem;">Classement du ${formatDate(date)}</h3>
    <table class="history-table">
      <thead>
        <tr>
          <th>Rang</th>
          <th>Joueur</th>
          <th>ELO</th>
          <th style="text-align: center;">Évolution</th>
        </tr>
      </thead>
      <tbody>
  `;

  rankings.forEach(rank => {
    const change = rankChanges[rank.playerId] || '-';
    let changeClass = 'rank-same';
    if (change === '↑') changeClass = 'rank-up';
    else if (change === '↓') changeClass = 'rank-down';
    else if (change === 'Nouveau') changeClass = 'rank-new';
    
    html += `
      <tr>
        <td><strong>${rank.position}</strong></td>
        <td>${rank.playerName}</td>
        <td>${Math.round(rank.elo)}</td>
        <td style="text-align: center;">
          <span class="rank-change ${changeClass}">
            ${change}
          </span>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// Sauvegarder le classement actuel
async function saveCurrentRanking() {
  if (!db || !confirm('Sauvegarder le classement actuel ?')) return;

  try {
    const playersSnapshot = await db.collection('players')
      .orderBy('elo', 'desc')
      .get();

    const rankings = [];
    let position = 1;
    
    playersSnapshot.forEach(doc => {
      const data = doc.data();
      rankings.push({
        playerId: doc.id,
        playerName: data.name,
        elo: data.elo,
        position: position++
      });
    });

    const today = new Date().toISOString().split('T')[0];
    
    // Vérifier si déjà sauvegardé aujourd'hui
    const existingDoc = await db.collection('ranking_history').doc(today).get();
    if (existingDoc.exists) {
      if (!confirm('Un classement existe déjà pour aujourd\'hui. Voulez-vous l\'écraser ?')) {
        return;
      }
    }

    await db.collection('ranking_history').doc(today).set({
      date: today,
      rankings: rankings,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showNotification('Classement sauvegardé avec succès !', 'success');
    loadHistoryPage(); // Rafraîchir la liste
  } catch (error) {
    console.error('Erreur sauvegarde:', error);
    showNotification('Erreur lors de la sauvegarde', 'error');
  }
}

// Afficher une notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 9999;
    background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--accent)'};
    color: white; padding: 1rem 1.5rem; border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-weight: 600;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

// Formater une date YYYY-MM-DD en format lisible
function formatDate(dateString) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('fr-FR', options);
}

// Gestionnaire d'événement pour le select
document.addEventListener('DOMContentLoaded', function() {
  const historySelect = document.getElementById('historyDateSelect');
  if (historySelect) {
    historySelect.addEventListener('change', (e) => {
      if (e.target.value) {
        loadHistoricalRanking(e.target.value);
      }
    });
  }
  
  // Sauvegarde automatique hebdomadaire (lundi)
  const today = new Date();
  const lastSave = localStorage.getItem('lastRankingSave');
  if (today.getDay() === 1 && lastSave !== today.toISOString().split('T')[0]) {
    setTimeout(() => {
      saveCurrentRanking();
      localStorage.setItem('lastRankingSave', today.toISOString().split('T')[0]);
    }, 5000);
  }
});

// ============================================================================
// DÉMARRAGE
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 Application démarrée");
  setTimeout(() => { updateQuickStats(); loadPlayersSelect(); renderPlayers(); }, 300);
});
