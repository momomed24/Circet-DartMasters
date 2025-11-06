
/*
  storage.js - Google Sheets integration
  Replace API_KEY below with your Google API key.
*/
const SHEET_ID = "1GmktJ5VlNZXDLbwuZ7oTsNJQuwJZLlCbxiISRnFaHCE";
const API_KEY = "A_COLLER_ICI_TA_CLE_API"; // <-- replace with your API key
const RANGE = "matchs!A:E";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzAXhlGFTU3oJrLBNkTiWexbAGV8hSETov2iV1pbIcshIKlFVvFEVaeQx7WwNoAuW2aig/exec";

const APP = (function(){
  const JOUEURS = ["Nico","Andy","Pierre","Mohammed","Clément","Thomas","Jérôme","Rémy"];
  async function loadMatchs(){
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
    try{
      const res = await fetch(url,{cache:'no-store'});
      const data = await res.json();
      if(!data.values || data.values.length < 2) return [];
      return data.values.slice(1).map(r=>({ joueur1:r[0], score1:parseInt(r[1]), joueur2:r[2], score2:parseInt(r[3]), date:r[4]||"" }));
    }catch(e){
      console.error("Erreur loadMatchs:", e);
      return [];
    }
  }
  async function saveMatchs(matchs){
    try{
      const res = await fetch(SCRIPT_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(matchs) });
      return res.ok;
    }catch(e){ console.error("Erreur saveMatchs:", e); return false; }
  }
  return { JOUEURS, loadMatchs, saveMatchs };
})();
