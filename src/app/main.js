import {all,get,put,remove,exportDB,importDB} from '../data/db.js';
import {uuid,now,esc,TYPES,keyCode,downloadJSON} from '../utils/helpers.js';
import {analyzeImage,buildReference,similarity,label} from '../services/analyzer.js';
import {initRouter} from '../navigation/router.js';

const app=document.querySelector('#app');
const modal=document.querySelector('#modal');
const modalBody=document.querySelector('#modalBody');
const photoInput=document.querySelector('#photoInput');
const subtitle=document.querySelector('#subtitle');
const titles={keys:'Clés',analyze:'Analyser',loans:'Prêts',sites:'Sites',settings:'Réglages'};
let go;
let analyzeState={mode:'identify',captures:[null,null,null],pendingIndex:null,lastSingle:null,reference:null};

function setNav(route){
  subtitle.textContent=titles[route]||'Clés';
  document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.route===route));
}
async function render(route){
  setNav(route);
  const fn={keys:renderKeys,analyze:renderAnalyze,loans:renderLoans,sites:renderSites,settings:renderSettings}[route]||renderKeys;
  await fn();
}
function open(html){modalBody.innerHTML=html;modal.showModal()}
function close(){modal.close()}

async function renderKeys(){
  const [keys,locks,sites]=await Promise.all([all('keys'),all('locks'),all('sites')]);
  const lm=Object.fromEntries(locks.map(x=>[x.id,x])),sm=Object.fromEntries(sites.map(x=>[x.id,x]));
  const counts={total:keys.length,reserve:keys.filter(k=>k.status==='reserve').length,loan:keys.filter(k=>k.status==='loan').length,lost:keys.filter(k=>k.status==='lost').length};
  app.innerHTML=`<h1>🔑 Clés</h1>
  <div class="grid stats">
    <div class="card stat"><small>Total</small><strong>${counts.total}</strong></div>
    <div class="card stat"><small>En réserve</small><strong>${counts.reserve}</strong></div>
    <div class="card stat"><small>Prêtées</small><strong>${counts.loan}</strong></div>
    <div class="card stat"><small>Perdues</small><strong>${counts.lost}</strong></div>
  </div>
  <div class="toolbar"><button class="primary" id="addKey">➕ Ajouter</button><button id="toAnalyze">📷 Identifier</button><input id="search" placeholder="🔎 Code, description…" aria-label="Rechercher"></div>
  <div id="keyList"></div>`;
  const list=app.querySelector('#keyList');
  const draw=q=>{
    const filtered=keys.filter(k=>{const l=lm[k.lockId],s=sm[l?.siteId];return `${keyCode(s,l,k.copy)} ${l?.description||''}`.toLowerCase().includes(q.toLowerCase())});
    list.innerHTML=filtered.length?filtered.map(k=>{const l=lm[k.lockId],s=sm[l?.siteId];return `<div class="card row"><div><div class="code">${esc(keyCode(s,l,k.copy))}</div><div>${esc(l?.description||'Sans serrure')}</div><small>${esc(s?.name||'Site inconnu')}</small></div><div><span class="badge ${k.status}">${k.status==='loan'?'Prêtée':k.status==='lost'?'Perdue':'En réserve'}</span><br><button data-edit="${k.id}">✏️</button></div></div>`}).join(''):'<div class="card empty">Aucune clé.</div>';
    list.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>keyDialog(b.dataset.edit)));
  };
  draw('');
  app.querySelector('#search').addEventListener('input',e=>draw(e.target.value));
  app.querySelector('#addKey').addEventListener('click',()=>keyDialog());
  app.querySelector('#toAnalyze').addEventListener('click',()=>go('analyze'));
}

async function keyDialog(id){
  const [sites,locks,k]=await Promise.all([all('sites'),all('locks'),id?get('keys',id):null]);
  if(!sites.length){open(`<h2>📍 Site requis</h2><p>Crée d’abord un site.</p><button value="cancel">Fermer</button>`);return}
  open(`<h2>${id?'✏️ Modifier':'➕ Ajouter une clé'}</h2>
    <div class="form-grid two"><div><label>Site</label><select id="siteSel">${sites.map(s=>`<option value="${s.id}">${esc(s.number)} — ${esc(s.name)}</option>`).join('')}</select></div>
    <div><label>Serrure</label><select id="lockSel"></select></div>
    <div><label>Copie</label><input id="copy" maxlength="2" value="${esc(k?.copy||'A')}"></div>
    <div><label>Statut</label><select id="status"><option value="reserve">En réserve</option><option value="loan">Prêtée</option><option value="lost">Perdue</option></select></div></div>
    <label>Remarques</label><textarea id="notes">${esc(k?.notes||'')}</textarea>
    <div class="actions"><button type="button" class="primary" id="save">💾 Enregistrer</button>${id?'<button type="button" class="danger" id="delete">🗑️ Supprimer</button>':''}<button value="cancel">Annuler</button></div>`);
  const ss=modalBody.querySelector('#siteSel'),ls=modalBody.querySelector('#lockSel');
  if(k){const lk=locks.find(x=>x.id===k.lockId);if(lk)ss.value=lk.siteId;modalBody.querySelector('#status').value=k.status}
  const fill=()=>{const avail=locks.filter(l=>l.siteId===ss.value);ls.innerHTML=avail.map(l=>`<option value="${l.id}">${l.type}${l.number} — ${esc(l.description)}</option>`).join('');if(k&&avail.some(l=>l.id===k.lockId))ls.value=k.lockId};
  fill(); ss.addEventListener('change',fill);
  modalBody.querySelector('#save').addEventListener('click',async()=>{if(!ls.value)return alert('Crée une serrure pour ce site.');const obj={...(k||{}),id:k?.id||uuid(),lockId:ls.value,copy:(modalBody.querySelector('#copy').value||'A').toUpperCase(),status:modalBody.querySelector('#status').value,notes:modalBody.querySelector('#notes').value,createdAt:k?.createdAt||now(),updatedAt:now()};await put('keys',obj);await put('events',{id:uuid(),entityId:obj.id,type:k?'MODIFICATION':'CREATION',at:now()});close();renderKeys()});
  modalBody.querySelector('#delete')?.addEventListener('click',async()=>{if(confirm('Supprimer cette clé ?')){await remove('keys',id);close();renderKeys()}});
}

async function renderSites(){
  const [sites,locks]=await Promise.all([all('sites'),all('locks')]);
  app.innerHTML=`<h1>📍 Sites & serrures</h1><div class="toolbar"><button class="primary" id="addSite">➕ Site</button><button id="addLock">🔒 Serrure</button></div>${sites.length?sites.map(s=>`<div class="card"><h2>${esc(s.number)} — ${esc(s.name)}</h2>${locks.filter(l=>l.siteId===s.id).map(l=>`<div class="row"><span><span class="code">${esc(s.number)}${esc(l.type)}${esc(l.number)}</span> · ${esc(l.description)}</span><span class="muted">${esc(TYPES[l.type]||l.type)}</span></div>`).join('')||'<span class="muted">Aucune serrure</span>'}</div>`).join(''):'<div class="card empty">Crée ton premier site.</div>'}`;
  app.querySelector('#addSite').addEventListener('click',siteDialog);app.querySelector('#addLock').addEventListener('click',lockDialog);
}
function siteDialog(){open(`<h2>➕ Site</h2><label>Numéro</label><input id="num" inputmode="numeric"><label>Nom</label><input id="name"><div class="actions"><button type="button" class="primary" id="save">💾 Enregistrer</button><button value="cancel">Annuler</button></div>`);modalBody.querySelector('#save').addEventListener('click',async()=>{const number=modalBody.querySelector('#num').value.trim(),name=modalBody.querySelector('#name').value.trim();if(!number||!name)return alert('Numéro et nom requis.');await put('sites',{id:uuid(),number,name,createdAt:now(),updatedAt:now()});close();renderSites()})}
async function lockDialog(){const sites=await all('sites');if(!sites.length)return siteDialog();open(`<h2>🔒 Nouvelle serrure</h2><label>Site</label><select id="site">${sites.map(s=>`<option value="${s.id}">${esc(s.number)} — ${esc(s.name)}</option>`).join('')}</select><label>Type</label><select id="type">${Object.entries(TYPES).map(([k,v])=>`<option value="${k}">${k} — ${v}</option>`).join('')}</select><label>Numéro de serrure</label><input id="num" inputmode="numeric" value="1"><label>Description</label><input id="desc" placeholder="Porte arrière"><div class="actions"><button type="button" class="primary" id="save">💾 Enregistrer</button><button value="cancel">Annuler</button></div>`);modalBody.querySelector('#save').addEventListener('click',async()=>{const description=modalBody.querySelector('#desc').value.trim();if(!description)return alert('Description requise.');await put('locks',{id:uuid(),siteId:modalBody.querySelector('#site').value,type:modalBody.querySelector('#type').value,number:modalBody.querySelector('#num').value.trim()||'1',description,createdAt:now(),updatedAt:now()});close();renderSites()})}

function vectorGraph(vector){
  if(!vector?.length)return '<div class="empty mini">Aucune courbe.</div>';
  const w=640,h=170,p=14;
  const pts=vector.map((v,i)=>`${p+i*(w-2*p)/(vector.length-1)},${h-p-v*(h-2*p)}`).join(' ');
  return `<svg class="profile-graph" viewBox="0 0 ${w} ${h}" role="img" aria-label="Empreinte normalisée"><line x1="${p}" y1="${h/2}" x2="${w-p}" y2="${h/2}" class="gridline"/><polyline points="${pts}" fill="none" class="profile-line"/></svg>`;
}
function qualityRow(labelText,value){return `<div class="qrow"><span>${labelText}</span><div class="qbar"><i style="width:${Math.max(0,Math.min(100,value||0))}%"></i></div><strong>${Math.round(value||0)}%</strong></div>`}
function controlPanel(sig,title='🧪 Contrôle de l’analyse'){
  const q=sig.qualityDetails||{};
  return `<div class="card analysis-control"><h2>${title}</h2>
    ${qualityRow('Carte détectée',q.cardDetection)}${qualityRow('Perspective',q.perspective)}${qualityRow('Segmentation clé',q.keySegmentation)}${qualityRow('Extraction profil',q.profileExtraction)}
    <div class="analysis-summary"><div><small>Qualité globale</small><strong>${sig.quality??0}%</strong></div><div><small>Creux</small><strong>${sig.valleyCount??'—'}</strong></div><div><small>Variation</small><strong class="code">${esc(sig.variationSimple??'—')}</strong></div><div><small>Creux principal</small><strong>${sig.mainValley??'—'}</strong></div></div>
    ${sig.acquisitionCount===3?`<div class="repeat"><span>Répétabilité</span><strong>${sig.repeatability}%</strong></div>`:''}
    <h3>📈 Empreinte normalisée</h3>${vectorGraph(sig.vector)}
    <details><summary>🔧 Détails techniques</summary><dl class="tech"><dt>analysisVersion</dt><dd>${sig.analysisVersion}</dd><dt>vectorLength</dt><dd>${sig.vectorLength}</dd><dt>orientation</dt><dd>${esc(sig.orientation||'—')}</dd><dt>profileSide</dt><dd>${esc(sig.profileSide||'—')}</dd><dt>variation détaillée</dt><dd>${esc((sig.variationDetailed||[]).join(' / ')||'—')}</dd>${sig.pairwiseSimilarity?`<dt>similarités 3 prises</dt><dd>${sig.pairwiseSimilarity.join(' / ')}%</dd>`:''}</dl></details>
  </div>`;
}

async function candidateHTML(sig){
  const [sigs,keys,locks,sites]=await Promise.all([all('signatures'),all('keys'),all('locks'),all('sites')]);
  const candidates=sigs.filter(s=>s.analysisVersion===2).map(s=>({s,score:similarity(sig,s)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,5);
  const km=Object.fromEntries(keys.map(k=>[k.id,k])),lm=Object.fromEntries(locks.map(l=>[l.id,l])),sm=Object.fromEntries(sites.map(s=>[s.id,s]));
  if(!candidates.length)return '<div class="card empty">Aucune empreinte V2 enregistrée à comparer.</div>';
  return candidates.map(c=>{const k=km[c.s.keyId],l=lm[k?.lockId],site=sm[l?.siteId],lab=label(c.score);return `<div class="card match ${c.score>=.75?'strong':c.score>=.55?'medium':''}"><div class="row"><div><span class="code">${esc(keyCode(site,l,k?.copy))}</span><br>${esc(l?.description||'')}</div><strong>${lab}</strong></div><small>Score technique : ${Math.round(c.score*100)}/100</small></div>`}).join('');
}

async function renderAnalyze(){
  app.innerHTML=`<h1>📷 Identifier / enregistrer</h1>
    <div class="segmented"><button id="modeIdentify" class="${analyzeState.mode==='identify'?'active':''}">🔎 Identifier</button><button id="modeReference" class="${analyzeState.mode==='reference'?'active':''}">💾 Créer une référence</button></div>
    <div id="analyzeBody"></div>`;
  app.querySelector('#modeIdentify').addEventListener('click',()=>{analyzeState.mode='identify';renderAnalyze()});
  app.querySelector('#modeReference').addEventListener('click',()=>{analyzeState.mode='reference';renderAnalyze()});
  if(analyzeState.mode==='identify')await renderIdentifyBody();else await renderReferenceBody();
}

async function renderIdentifyBody(){
  const body=app.querySelector('#analyzeBody');
  body.innerHTML=`<div class="card"><h2>🔎 Recherche rapide</h2><p>Une seule prise suffit. Place la carte en <strong>portrait</strong>, la clé <strong>verticale, tête en bas</strong>, bien centrée. La photo est traitée en mémoire puis supprimée.</p><button class="primary" id="pickSingle">📷 Photographier / choisir une image</button></div><div id="singleResult"></div>`;
  body.querySelector('#pickSingle').addEventListener('click',()=>{analyzeState.pendingIndex='single';photoInput.value='';photoInput.click()});
  if(analyzeState.lastSingle)await drawSingleResult(analyzeState.lastSingle);
}
async function drawSingleResult(sig){
  const out=app.querySelector('#singleResult'); if(!out)return;
  out.innerHTML=controlPanel(sig)+`<h2>🔎 Correspondances</h2>${await candidateHTML(sig)}<div class="actions"><button id="discardSingle">🗑️ Effacer l’analyse</button></div>`;
  out.querySelector('#discardSingle').addEventListener('click',()=>{analyzeState.lastSingle=null;renderAnalyze()});
}

async function renderReferenceBody(){
  const body=app.querySelector('#analyzeBody');
  const slots=analyzeState.captures.map((s,i)=>`<div class="capture-slot ${s?'done':''}"><div><strong>📷 Prise ${i+1}</strong><small>${s?`Qualité ${s.quality}% · ${s.valleyCount??'—'} creux`:'À réaliser'}</small></div><button data-shot="${i}">${s?'↻ Reprendre':'📷 Prendre'}</button></div>`).join('');
  body.innerHTML=`<div class="card"><h2>💾 Empreinte de référence</h2><p>Prends 3 photos successives de la même clé. Carte en <strong>portrait</strong>, clé <strong>verticale, tête en bas</strong>, bien centrée. Déplace légèrement le téléphone entre les prises ; la clé et la carte restent immobiles.</p>${slots}</div><div id="referenceResult"></div>`;
  body.querySelectorAll('[data-shot]').forEach(b=>b.addEventListener('click',()=>{analyzeState.pendingIndex=Number(b.dataset.shot);photoInput.value='';photoInput.click()}));
  if(analyzeState.reference)await drawReferenceResult(analyzeState.reference);
  else if(analyzeState.captures.every(Boolean)){
    analyzeState.reference=buildReference(analyzeState.captures);
    await drawReferenceResult(analyzeState.reference);
  }
}
async function drawReferenceResult(ref){
  const out=app.querySelector('#referenceResult');if(!out)return;
  const warning=ref.divergent?`<div class="card warning"><strong>⚠️ Les trois prises divergent trop.</strong><p>La prise ${ref.outlierIndex+1} semble la moins cohérente avec les deux autres.</p><button class="primary" id="retakeOutlier">📷 Reprendre la prise ${ref.outlierIndex+1}</button></div>`:'';
  out.innerHTML=warning+controlPanel(ref,'🧪 Contrôle de la référence')+`<h2>🔎 Correspondances</h2>${await candidateHTML(ref)}<div class="actions">${ref.divergent?'':'<button class="primary" id="attachRef">💾 Associer cette référence à une clé</button>'}<button id="resetRef">🗑️ Recommencer les 3 prises</button></div>`;
  out.querySelector('#retakeOutlier')?.addEventListener('click',()=>{analyzeState.pendingIndex=ref.outlierIndex;photoInput.value='';photoInput.click()});
  out.querySelector('#attachRef')?.addEventListener('click',()=>attachSignature(ref));
  out.querySelector('#resetRef').addEventListener('click',()=>{analyzeState.captures=[null,null,null];analyzeState.reference=null;renderAnalyze()});
}

photoInput.addEventListener('change',async()=>{
  const file=photoInput.files?.[0];if(!file||analyzeState.pendingIndex===null)return;
  const target=app.querySelector('#analyzeBody'); if(target)target.insertAdjacentHTML('afterbegin','<div class="card" id="busy">⏳ Analyse V2 en cours…</div>');
  try{
    const sig=await analyzeImage(file);
    if(analyzeState.pendingIndex==='single')analyzeState.lastSingle=sig;
    else {analyzeState.captures[analyzeState.pendingIndex]=sig;analyzeState.reference=null}
  }catch(e){alert(`Analyse impossible : ${e.message}`)}
  finally{analyzeState.pendingIndex=null;photoInput.value='';await renderAnalyze()}
});

async function attachSignature(sig){
  const [keys,locks,sites]=await Promise.all([all('keys'),all('locks'),all('sites')]);
  const lm=Object.fromEntries(locks.map(l=>[l.id,l])),sm=Object.fromEntries(sites.map(s=>[s.id,s]));
  if(!keys.length)return alert('Ajoute d’abord une clé manuellement.');
  open(`<h2>💾 Associer l’empreinte V2</h2><label>Clé</label><select id="key">${keys.map(k=>`<option value="${k.id}">${esc(keyCode(sm[lm[k.lockId]?.siteId],lm[k.lockId],k.copy))} — ${esc(lm[k.lockId]?.description||'')}</option>`).join('')}</select><div class="actions"><button type="button" class="primary" id="save">Associer</button><button value="cancel">Annuler</button></div>`);
  modalBody.querySelector('#save').addEventListener('click',async()=>{const keyId=modalBody.querySelector('#key').value;await put('signatures',{...sig,id:uuid(),keyId});await put('events',{id:uuid(),entityId:keyId,type:'ANALYSE_V2',at:now(),analysisVersion:2,acquisitionCount:sig.acquisitionCount});close();alert('Empreinte V2 enregistrée. Aucune photo n’a été conservée.');analyzeState.captures=[null,null,null];analyzeState.reference=null;renderAnalyze()});
}

async function renderLoans(){
  const [keys,loans,locks,sites]=await Promise.all([all('keys'),all('loans'),all('locks'),all('sites')]);
  const lm=Object.fromEntries(locks.map(l=>[l.id,l])),sm=Object.fromEntries(sites.map(s=>[s.id,s])),km=Object.fromEntries(keys.map(k=>[k.id,k]));
  const active=loans.filter(l=>!l.returnedAt);
  app.innerHTML=`<h1>🤝 Prêts</h1><button class="primary" id="newLoan">➕ Enregistrer un prêt</button><div style="height:12px"></div>${active.length?active.map(l=>{const k=km[l.keyId],lk=lm[k?.lockId],s=sm[lk?.siteId];return `<div class="card row"><div><span class="code">${esc(keyCode(s,lk,k?.copy))}</span><br>${esc(l.holder)}<br><small>Depuis ${new Date(l.loanedAt).toLocaleDateString('fr-FR')}</small></div><button data-return="${l.id}">↩️ Retour</button></div>`}).join(''):'<div class="card empty">Aucun prêt en cours.</div>'}`;
  app.querySelector('#newLoan').addEventListener('click',()=>loanDialog(keys,lm,sm));
  app.querySelectorAll('[data-return]').forEach(b=>b.addEventListener('click',async()=>{const l=await get('loans',b.dataset.return),k=await get('keys',l.keyId);l.returnedAt=now();k.status='reserve';k.updatedAt=now();await put('loans',l);await put('keys',k);await put('events',{id:uuid(),entityId:k.id,type:'RETOUR',at:now(),holder:l.holder});renderLoans()}));
}
function loanDialog(keys,lm,sm){
  const avail=keys.filter(k=>k.status==='reserve');if(!avail.length)return alert('Aucune clé disponible.');
  open(`<h2>🤝 Nouveau prêt</h2><label>Clé</label><select id="key">${avail.map(k=>`<option value="${k.id}">${esc(keyCode(sm[lm[k.lockId]?.siteId],lm[k.lockId],k.copy))} — ${esc(lm[k.lockId]?.description||'')}</option>`).join('')}</select><label>Détenteur</label><input id="holder"><label>Motif / note</label><input id="note"><div class="actions"><button type="button" class="primary" id="save">💾 Enregistrer</button><button value="cancel">Annuler</button></div>`);
  modalBody.querySelector('#save').addEventListener('click',async()=>{const keyId=modalBody.querySelector('#key').value,holder=modalBody.querySelector('#holder').value.trim();if(!holder)return alert('Détenteur requis.');const k=await get('keys',keyId);k.status='loan';k.updatedAt=now();await put('keys',k);await put('loans',{id:uuid(),keyId,holder,note:modalBody.querySelector('#note').value,loanedAt:now(),returnedAt:null});await put('events',{id:uuid(),entityId:keyId,type:'PRET',at:now(),holder});close();renderLoans()});
}

async function renderSettings(){
  const sigs=await all('signatures'); const v1=sigs.filter(s=>s.analysisVersion===1).length,v2=sigs.filter(s=>s.analysisVersion===2).length;
  app.innerHTML=`<h1>⚙️ Réglages</h1>
  <div class="card"><h2>💾 Sauvegarde</h2><div class="actions"><button id="export">⬇️ Exporter JSON</button><button id="import">⬆️ Importer JSON</button></div><input id="importFile" type="file" accept="application/json,.json" hidden><p class="muted">Schéma d’export V2. Les sauvegardes V1 restent importables. Aucune photo n’est incluse.</p></div>
  <div class="card"><h2>🧪 Analyse</h2><p>Algorithme courant : <strong>V2</strong></p><p>Empreintes V2 : <strong>${v2}</strong> · V1 conservées : <strong>${v1}</strong></p><p class="muted">Les V1 restent dans la base mais ne sont pas comparées aux V2.</p></div>
  <div class="card"><h2>🔒 Confidentialité</h2><p>IndexedDB local · aucun serveur · aucun compte · aucune photo persistée · pas de chiffrement dans cette version.</p></div>`;
  app.querySelector('#export').addEventListener('click',async()=>downloadJSON(await exportDB(),`key-inventory-${new Date().toISOString().slice(0,10)}.json`));
  const inp=app.querySelector('#importFile'); app.querySelector('#import').addEventListener('click',()=>inp.click());
  inp.addEventListener('change',async()=>{try{const p=JSON.parse(await inp.files[0].text());if(confirm('L’import remplacera la base locale actuelle. Continuer ?')){await importDB(p);alert('Import terminé.');renderSettings()}}catch(e){alert(`Import impossible : ${e.message}`)}});
}

let installPrompt;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;const b=document.querySelector('#installBtn');b.hidden=false;b.onclick=async()=>{await installPrompt.prompt();installPrompt=null;b.hidden=true}});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js');
go=initRouter(render);
