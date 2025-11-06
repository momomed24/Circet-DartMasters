
document.addEventListener('DOMContentLoaded', async ()=>{
  window.matchs = await APP.loadMatchs();
  initNav();
  initMatchModule();
  afficherClassement(window.matchs || []);
  initPlayersModule();
});
