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

// ============================================================================
// NAVIGATION
// ============================================================================
function showPage(pageName) {
  console.log(`Navigation vers: ${pageName}`);
  
  // Cacher toutes les pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  // Afficher la page demandée
  const targetPage = document.getElementById(`${pageName}-page`);
  if (targetPage) {
    targetPage.classList.add('active');
  }
  
  // Mettre à jour les boutons actifs
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  if (event && event.target) {
    event.target.classList.add('active');
  }
  
  // Charger les données spécifiques
  switch(pageName) {
    case 'ranking':
      renderRanking();
      break;
    case 'players':
      renderPlayers();
      break;
    case 'matches':
      loadPlayersSelect();
      renderMatchHistory();
      break;
    case 'home':
      updateQuickStats();
      break;
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
  
  await db.collection("players").add({ name, elo: 1200, wins: 0, losses: 0, matches: 0 });
  
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
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function renderPlayers() {
  const players = await getPlayers();
  const grid = document.getElementById('playersGrid');
  if (!grid) return;
  
  if (!players.length) {
    grid.innerHTML = "<p class='no-data'>Aucun joueur. Ajoutez-en un !</p>";
    return;
  }
  
  grid.innerHTML = '';
  players.forEach(p => {
    const card = document.createElement('div');
    card.className = 'player-card';
    card.innerHTML = `
      <div><strong>${p.name}</strong><div style="font-size:0.9rem;color:var(--text-muted)">ELO: ${p.elo}</div></div>
      <button onclick="deletePlayer('${p.id}', '${p.name}')" class="btn-danger">Supprimer</button>
    `;
    grid.appendChild(card);
  });
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
    if (s1 > s2) {
      winner = player1; loser = player2; winnerId = p1Id; loserId = p2Id;
    } else {
      winner = player2; loser = player1; winnerId = p2Id; loserId = p1Id;
    }
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
  await Promise.all([renderRanking(), renderMatchHistory(), updateQuickStats()]);
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

async function deleteMatch(matchId) {
  if (!confirm("⚠️ Voulez-vous vraiment supprimer ce match ?\n\nLes stats ELO et les compteurs des joueurs seront recalculés depuis le début.")) {
    return;
  }

  try {
    await db.collection("matches").doc(matchId).delete();
    await recalculateAllStats();
  } catch (error) {
    console.error("❌ Erreur deleteMatch:", error);
    alert("Erreur: " + error.message);
  }
}

// ============================================================================
// RECALCULER TOUTES LES STATS (ADMIN)
// ============================================================================
async function recalculateAllStats() {
  if (!db) return alert("Firebase non initialisé");
  
  if (!confirm("🚨 ATTENTION !\n\nCette action va :\n• Réinitialiser tous les ELO à 1200\n• Remettre à zéro toutes les statistiques\n• Recalculer le classement depuis le début\n\nConfirmer ?")) {
    return;
  }
  
  const button = event?.target;
  const originalText = button?.textContent || '🔄 Recalculer toutes les stats';
  
  try {
    // Indicateur de chargement
    if (button) {
      button.disabled = true;
      button.textContent = '⏳ Recalcul en cours...';
    }
    
    // Récupérer tous les joueurs et les réinitialiser
    const playersSnapshot = await db.collection("players").get();
    if (playersSnapshot.empty) {
      alert("Aucun joueur trouvé");
      return;
    }
    
    // Suivre les stats en mémoire pendant le recalcul
    const playersData = {};
    const batchReset = db.batch();
    
    playersSnapshot.forEach(doc => {
      playersData[doc.id] = { elo: 1200, wins: 0, losses: 0, matches: 0 };
      batchReset.update(db.collection("players").doc(doc.id), {
        elo: 1200,
        wins: 0,
        losses: 0,
        matches: 0
      });
    });
    
    await batchReset.commit();
    
    // Récupérer tous les matchs par ordre chronologique
    const matchesSnapshot = await db.collection("matches")
      .orderBy("timestamp", "asc")
      .get();
    
    if (matchesSnapshot.empty) {
      alert("Aucun match à recalculer");
      return;
    }
    
    // Recalculer chaque match un par un
    for (const doc of matchesSnapshot.docs) {
      const match = doc.data();
      
      const winnerData = playersData[match.winnerId];
      const loserData = playersData[match.loserId];
      
      if (!winnerData || !loserData) {
        console.warn(`⚠️ Joueurs introuvables pour le match ${doc.id}`);
        continue;
      }
      
      // Calculer le nouvel ELO
      const { newWinnerElo, newLoserElo } = calculateElo(
        winnerData.elo, 
        loserData.elo, 
        match.score
      );
      
      // Mettre à jour l'état en mémoire
      winnerData.elo = newWinnerElo;
      winnerData.wins++;
      winnerData.matches++;
      
      loserData.elo = newLoserElo;
      loserData.losses++;
      loserData.matches++;
    }
    
    // Appliquer toutes les mises à jour finales
    const batchUpdate = db.batch();
    Object.entries(playersData).forEach(([playerId, data]) => {
      batchUpdate.update(db.collection("players").doc(playerId), data);
    });
    
    await batchUpdate.commit();
    
    // Recharger l'interface
    await Promise.all([
      renderRanking(),
      renderMatchHistory(),
      updateQuickStats(),
      renderPlayers()
    ]);
    
    alert("✅ Recalcul terminé avec succès !");
    
  } catch (error) {
    console.error("❌ Erreur recalculateAllStats:", error);
    alert("Erreur lors du recalcul: " + error.message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

// ============================================================================
// CLASSEMENT
// ============================================================================
async function renderRanking() {
  const players = await getPlayers();
  const tableDiv = document.getElementById('rankingTable');
  if (!tableDiv) return;
  
  if (!players.length) {
    tableDiv.innerHTML = "<p class='no-data'>Aucun joueur dans le classement</p>";
    return;
  }
  
  players.sort((a,b) => b.elo - a.elo);
  
  let html = `<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:var(--accent);color:var(--primary);">
    <th style="padding:1rem;">Rang</th><th style="padding:1rem;">Joueur</th><th style="padding:1rem;">ELO</th><th style="padding:1rem;">V</th><th style="padding:1rem;">D</th><th style="padding:1rem;">Ratio</th>
  </tr></thead><tbody>`;
  
  players.forEach((p,i) => {
    const ratio = p.matches ? (p.wins / p.matches * 100).toFixed(1) : '0.0';
    html += `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:1rem;">${i+1}</td>
      <td style="padding:1rem;"><strong>${p.name}</strong></td>
      <td style="padding:1rem;">${p.elo}</td>
      <td style="padding:1rem;">${p.wins}</td>
      <td style="padding:1rem;">${p.losses}</td>
      <td style="padding:1rem;">${ratio}%</td>
    </tr>`;
  });
  html += "</tbody></table>";
  tableDiv.innerHTML = html;
}

// ============================================================================
// AUTRES FONCTIONS
// ============================================================================
async function loadPlayersSelect() {
  const players = await getPlayers();
  const p1Select = document.getElementById('player1');
  const p2Select = document.getElementById('player2');
  if (!p1Select || !p2Select) return;
  
  p1Select.innerHTML = '<option value="">-- Joueur 1 --</option>';
  p2Select.innerHTML = '<option value="">-- Joueur 2 --</option>';
  players.forEach(p => {
    p1Select.innerHTML += `<option value="${p.id}">${p.name}</option>`;
    p2Select.innerHTML += `<option value="${p.id}">${p.name}</option>`;
  });
}

async function renderMatchHistory() {
  try {
    const snapshot = await db.collection("matches").orderBy("timestamp", "desc").limit(20).get();
    const container = document.getElementById('matchHistory');
    if (!container) return;
    
    if (snapshot.empty) {
      container.innerHTML = "<p class='no-data'>Aucun match</p>";
      return;
    }
    
    let html = '';
    snapshot.docs.forEach(doc => {
      const m = doc.data();
      const date = new Date(m.timestamp).toLocaleDateString('fr-FR');
      html += `<div class="match-item">
        <div class="match-info">
          <strong>${m.winner}</strong> vs ${m.loser} 
          <span style="color:var(--accent); margin-left: 1rem;">${m.score}</span>
          <div style="font-size:0.85rem;color:var(--text-muted)">${date}</div>
        </div>
        <div class="match-actions">
          <button onclick="deleteMatch('${doc.id}')" class="btn-danger delete-match-btn" title="Supprimer ce match">🗑️ Supprimer</button>
        </div>
      </div>`;
    });
    container.innerHTML = html;
  } catch (error) {
    console.error("❌ Erreur renderMatchHistory:", error);
  }
}

async function updateQuickStats() {
  const players = await getPlayers();
  const matches = await db.collection("matches").get();
  
  document.getElementById('quickStats').innerHTML = `
    <div class="stat-item"><div>Joueurs</div><strong>${players.length}</strong></div>
    <div class="stat-item"><div>Matchs</div><strong>${matches.size}</strong></div>
    <div class="stat-item"><div>Moyenne ELO</div><strong>${players.length ? Math.round(players.reduce((a,p) => a + p.elo, 0) / players.length) : 0}</strong></div>
  `;
}

function calculateElo(winnerElo, loserElo, score) {
  const K = 32;
  const multiplier = score === '2-0' ? 1.2 : 1.0;
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  return {
    newWinnerElo: Math.round(winnerElo + K * multiplier * (1 - expectedWinner)),
    newLoserElo: Math.round(loserElo + K * multiplier * (0 - expectedWinner))
  };
}

// ============================================================================
// MODALS
// ============================================================================
function openAddPlayerModal() {
  const modal = document.getElementById('addPlayerModal');
  if (modal) {
    modal.style.display = 'block';
    const input = document.getElementById('playerName');
    if (input) input.focus();
  }
}

function closeAddPlayerModal() {
  const modal = document.getElementById('addPlayerModal');
  if (modal) modal.style.display = 'none';
  const input = document.getElementById('playerName');
  if (input) input.value = '';
}

// ============================================================================
// DÉMARRAGE
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 Application démarrée");
  setTimeout(async () => {
    await Promise.all([
      updateQuickStats(),
      loadPlayersSelect()
    ]);
  }, 300);
});