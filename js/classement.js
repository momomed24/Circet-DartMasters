
(function(){
  const K = 32;
  window.calculerClassement = function(matchs){
    const stats = {};
    APP.JOUEURS.forEach(n => stats[n] = {nom:n,matchs:0,victoires:0,defaites:0,elo:1000});
    matchs.forEach(m => {
      const j1=m.joueur1, j2=m.joueur2, s1=m.score1, s2=m.score2;
      if(!stats[j1]||!stats[j2]) return;
      stats[j1].matchs++; stats[j2].matchs++;
      const eloA = stats[j1].elo, eloB = stats[j2].elo;
      const expectedA = 1/(1+Math.pow(10,(eloB-eloA)/400));
      const expectedB = 1/(1+Math.pow(10,(eloA-eloB)/400));
      const scoreA = s1>s2?1:0, scoreB = s2>s1?1:0;
      stats[j1].elo = eloA + K*(scoreA-expectedA);
      stats[j2].elo = eloB + K*(scoreB-expectedB);
      if(s1>s2){ stats[j1].victoires++; stats[j2].defaites++; } else { stats[j2].victoires++; stats[j1].defaites++; }
    });
    return Object.values(stats).sort((a,b)=>b.elo-a.elo);
  };

  window.afficherClassement = function(matchs){
    const tbody = document.getElementById('classement-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    const classement = calculerClassement(matchs);
    classement.forEach((j,idx)=>{
      const ratio = j.matchs?((j.victoires/j.matchs)*100).toFixed(2)+'%':'0.00%';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${j.nom}</td><td>${j.matchs}</td><td>${j.victoires}</td><td>${j.defaites}</td><td>${ratio}</td><td>${j.elo.toFixed(2)}</td>`;
      tbody.appendChild(tr);
    });
  };
})();
