// ------------------------------
// Initialisation Firebase
// ------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDopLci7L1EvUebzSermotMkMM-w5ocLzw",
  authDomain: "circet-dartmasters.firebaseapp.com",
  projectId: "circet-dartmasters",
  storageBucket: "circet-dartmasters.firebasestorage.app",
  messagingSenderId: "184457292501",
  appId: "1:184457292501:web:3e409efb2953aa57af105c",
  measurementId: "G-2Y3SPXVFFC"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ------------------------------
// Fonctions Joueurs
// ------------------------------
async function addPlayer() {
  const name = document.getElementById('playerName').value.trim();
  if (!name) { alert('Veuillez entrer un nom'); return; }

  // Vérifier si joueur existe
  const snapshot = await db.collection("players").where("name", "==", name).get();
  if (!snapshot.empty) { alert('Ce joueur existe déjà'); return; }

  await db.collection("players").add({
    name,
    elo: 1200,
    wins: 0,
    losses: 0,
    matches: 0
  });

  closeAddPlayerModal();
  renderRanking();
}

async function getPlayers() {
  const snapshot = await db.collection("players").get();
  const players = [];
  snapshot.forEach(doc => players.push({ id: doc.id, ...doc.data() }));
  return players;
}

// ------------------------------
// Fonctions Matchs
// ------------------------------
async function addMatch() {
  const p1Id = document.getElementById('player1').value;
  const p2Id = document.getElementById('player2').value;
  const scoreValue = document.getElementById('matchScore').value;

  if (!p1Id || !p2Id || !scoreValue) { alert('Veuillez remplir tous les champs'); return; }
  if (p1Id === p2Id) { alert('Veuillez sélectionner deux joueurs différents'); return; }

  const p1Doc = await db.collection("players").doc(p1Id).get();
  const p2Doc = await db.collection("players").doc(p2Id).get();
  const player1 = p1Doc.data();
  const player2 = p2Doc.data();

  let winnerPlayer, loserPlayer, score;
  if (scoreValue.includes('p1')) { winnerPlayer = player1; loserPlayer = player2; score = scoreValue.split('-p1')[0]; }
  else { winnerPlayer = player2; loserPlayer = player1; score = scoreValue.split('-p2')[0]; }

  const { newWinnerElo, newLoserElo } = calculateElo(winnerPlayer.elo, loserPlayer.elo, score);

  winnerPlayer.elo = newWinnerElo;
  loserPlayer.elo = newLoserElo;
  winnerPlayer.wins++; loserPlayer.losses++;
  winnerPlayer.matches++; loserPlayer.matches++;

  // Mise à jour des joueurs
  await db.collection("players").doc(p1Id).update(player1);
  await db.collection("players").doc(p2Id).update(player2);

  // Ajouter le match
  await db.collection("matches").add({
    timestamp: Date.now(),
    score: scoreValue,
    winner: winnerPlayer.name,
    loser: loserPlayer.name
  });

  closeAddMatchModal();
  renderRanking();
}

// ------------------------------
// Supprimer dernier match
// ------------------------------
async function deleteLastMatch() {
  const snapshot = await db.collection("matches").orderBy("timestamp", "desc").limit(1).get();
  if (snapshot.empty) { alert("Aucun match à supprimer"); return; }

  const lastMatchDoc = snapshot.docs[0];
  const match = lastMatchDoc.data();

  // Récupérer les joueurs
  const winnerSnap = await db.collection("players").where("name", "==", match.winner).get();
  const loserSnap = await db.collection("players").where("name", "==", match.loser).get();
  const winnerDoc = winnerSnap.docs[0];
  const loserDoc = loserSnap.docs[0];
  const winner = winnerDoc.data();
  const loser = loserDoc.data();

  // Annuler les effets du match
  winner.elo -= 32; winner.wins--; winner.matches--;
  loser.elo += 32; loser.losses--; loser.matches--;

  // Mettre à jour les joueurs
  await db.collection("players").doc(winnerDoc.id).update(winner);
  await db.collection("players").doc(loserDoc.id).update(loser);

  // Supprimer le match
  await db.collection("matches").doc(lastMatchDoc.id).delete();

  alert("Le dernier match a été supprimé");
  renderRanking();
}

// ------------------------------
// ELO
// ------------------------------
function calculateElo(winnerElo, loserElo, score) {
  const K = 32;
  const scoreMultiplier = score === '2-0' ? 1.2 : 1.0;
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));
  return {
    newWinnerElo: Math.round(winnerElo + K * scoreMultiplier * (1 - expectedWinner)),
    newLoserElo: Math.round(loserElo + K * scoreMultiplier * (0 - expectedLoser))
  };
}

// ------------------------------
// Affichage classement
// ------------------------------
async function renderRanking() {
  const players = await getPlayers();
  const sorted = [...players].sort((a,b)=> b.elo - a.elo);
  const table = document.getElementById('rankingTable');

  if (sorted.length === 0) {
    table.innerHTML = "<p>Aucun joueur</p>"; return;
  }

  let html = `<table>
    <thead><tr><th>Rang</th><th>Joueur</th><th>ELO</th><th>Victoires</th><th>Défaites</th><th>Matchs</th></tr></thead>
    <tbody>`;
  sorted.forEach((player,i)=>{
    html+= `<tr>
      <td>#${i+1}</td>
      <td>${player.name}</td>
      <td>${player.elo}</td>
      <td>${player.wins}</td>
      <td>${player.losses}</td>
      <td>${player.matches}</td>
    </tr>`;
  });
  html += "</tbody></table>";
  table.innerHTML = html;
}

// ------------------------------
// Modals (ouvrir/fermer)
// ------------------------------
function openAddPlayerModal(){ document.getElementById('addPlayerModal').classList.add('active'); }
function closeAddPlayerModal(){ document.getElementById('addPlayerModal').classList.remove('active'); }
function openAddMatchModal(){ document.getElementById('addMatchModal').classList.add('active'); }
function closeAddMatchModal(){ document.getElementById('addMatchModal').classList.remove('active'); }

// ------------------------------
// Initialisation
// ------------------------------
renderRanking();
