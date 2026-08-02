// ─── STATE ───────────────────────────────────────────────────────────────────
let DB = { abonnes: [], convocations: [], activity: [] };
let currentAbonneId = null;
let sortKey = 'pdl';
let sortAsc = true;
let currentSecteur = 'millet'; // 'millet' ou 'metivier'

// ─── PDL PARSER ──────────────────────────────────────────────────────────────
function parsePDL(pdl) {
  if (!pdl || pdl.length < 6) return { secteur: '—', zone: '—', bloc: '—', kay: '—' };
  const s = pdl.toString();
  return {
    secteur: s.charAt(0),
    zone: s.substring(1, 3),
    bloc: s.substring(3, 6),
    kay: s.substring(6)
  };
}
// ─── INDEXEDDB ENGINE ────────────────────────────────────────────────────────
const DB_NAME = "BodwoDB";
const DB_VERSION = 1;
let db = null;

function initDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (e) => reject("Pa kapab louvri IndexedDB");
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    request.onupgradeneeded = (e) => {
      const dbInstance = e.target.result;
      if (!dbInstance.objectStoreNames.contains("clients")) {
        dbInstance.createObjectStore("clients", { keyPath: "id" });
      }
      if (!dbInstance.objectStoreNames.contains("voiceNotes")) {
        dbInstance.createObjectStore("voiceNotes", { keyPath: "id" });
      }
    };
  });
}

function dbGetAllClients() {
  return new Promise((resolve) => {
    const tx = db.transaction("clients", "readonly");
    const store = tx.objectStore("clients");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

function normalizeClient(c) {
  c.kòd = c.kòd || c.pdl || '';
  c.pdl = c.kòd;
  
  c.nòt = c.nòt || c.adresse || '';
  c.adresse = c.nòt;
  
  if (c.non) {
    const parts = c.non.split(' ');
    c.nom = c.nom || parts[0] || '';
    c.prenom = c.prenom || parts.slice(1).join(' ') || '';
  } else {
    c.non = `${c.nom || ''} ${c.prenom || ''}`.trim().toUpperCase();
  }
  
  if (c.sektè === 'Métivier' || c.secteur === 'METV1') {
    c.sektè = 'Métivier';
    c.secteur = 'METV1';
  } else {
    c.sektè = 'Millet';
    c.secteur = 'MILL1';
  }
  
  c.solde_ant = parseFloat(c.solde_ant) || 0;
  return c;
}

function zoneName(pdl) {
  const p = parsePDL(pdl);
  return `${p.secteur}-${p.zone}`;
}
function blocName(pdl) {
  const p = parsePDL(pdl);
  return `${p.secteur}-${p.zone}-${p.bloc}`;
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
window.onload = async () => {
  await initDb().catch(console.error);
  const savedSecteur = localStorage.getItem('dinepa_active_secteur');
  if (savedSecteur) {
    currentSecteur = savedSecteur;
    const selectEl = document.getElementById('sektèSelect');
    if (selectEl) selectEl.value = currentSecteur;
    const labels = {
      millet: 'Sektè Millet (MILL1) · Archive 2019',
      metivier: 'Sektè Métivier (METV1) · Archive 2019'
    };
    const el = document.getElementById('pageSubtitle');
    if (el) el.textContent = labels[currentSecteur] || '';
  }
  await loadFromStorage();
  updateDashboard();
  renderAbonnes();
  renderConvocations();
};

function getStorageKey() {
  return currentSecteur === 'metivier' ? 'dinepa_metivier_db' : 'dinepa_millet_db';
}

async function loadFromStorage() {
  const savedConvs = localStorage.getItem(getStorageKey() + '_convs');
  const savedActivity = localStorage.getItem(getStorageKey() + '_activity');
  DB.convocations = savedConvs ? JSON.parse(savedConvs) : [];
  DB.activity = savedActivity ? JSON.parse(savedActivity) : [];
  
  let allClients = [];
  if (db) {
    allClients = await dbGetAllClients();
  }
  
  const isMetivier = currentSecteur === 'metivier';
  let filtered = allClients.filter(c => {
    const sect = c.sektè || c.secteur || '';
    if (isMetivier) {
      return sect.toLowerCase().includes('metv') || sect === 'Métivier';
    } else {
      return sect.toLowerCase().includes('mill') || sect === 'Millet';
    }
  });
  
  if (filtered.length > 0) {
    DB.abonnes = filtered.map(normalizeClient);
    
    if (isMetivier && DB.abonnes.length < 500 && typeof DINEPA_METIVIER !== 'undefined' && DINEPA_METIVIER.length > 500) {
      await upgradeSectorData('metivier', DINEPA_METIVIER);
    } else if (!isMetivier && DB.abonnes.length < 1300 && typeof DINEPA_ARCHIVE_2019 !== 'undefined' && DINEPA_ARCHIVE_2019.length > 1300) {
      await upgradeSectorData('millet', DINEPA_ARCHIVE_2019);
    }
  } else {
    if (!isMetivier && typeof DINEPA_ARCHIVE_2019 !== 'undefined' && DINEPA_ARCHIVE_2019.length > 0) {
      await upgradeSectorData('millet', DINEPA_ARCHIVE_2019);
    } else if (isMetivier && typeof DINEPA_METIVIER !== 'undefined' && DINEPA_METIVIER.length > 0) {
      await upgradeSectorData('metivier', DINEPA_METIVIER);
    }
  }
  populateFilters();
}

async function upgradeSectorData(sector, archive) {
  const isMetivier = sector === 'metivier';
  const prefix = isMetivier ? 'metv-' : 'arch-';
  const sectTag = isMetivier ? 'Métivier' : 'Millet';
  const sectCode = isMetivier ? 'METV1' : 'MILL1';
  
  const abonnesToSave = archive.map((s, i) => {
    return normalizeClient({
      ...s,
      id: prefix + i,
      lastAction: isMetivier ? 'Archive Métivier' : 'Archive 2019',
      secteur: sectCode,
      sektè: sectTag,
      notes: s.notes || '',
      doleances: s.doleances || '',
      swivi: '',
      randevou: '',
      lat: null,
      lng: null,
      dènyeBòdwo: null
    });
  });
  
  if (db) {
    const tx = db.transaction("clients", "readwrite");
    const store = tx.objectStore("clients");
    abonnesToSave.forEach(c => store.put(c));
    await new Promise(r => tx.oncomplete = r);
  }
  
  DB.abonnes = abonnesToSave;
  addActivity(isMetivier ? 'blue' : 'green', `Archive ${sectTag} chargée : ${archive.length} abonés`);
  localStorage.setItem(getStorageKey() + '_activity', JSON.stringify(DB.activity));
}

async function changeSecteur(val) {
  currentSecteur = val;
  localStorage.setItem('dinepa_active_secteur', val);
  const labels = {
    millet: 'Sektè Millet (MILL1) · Archive 2019',
    metivier: 'Sektè Métivier (METV1) · Archive 2019'
  };
  const el = document.getElementById('pageSubtitle');
  if (el) el.textContent = labels[val] || '';
  await loadFromStorage();
  updateDashboard();
  renderAbonnes();
  renderConvocations();
  toast(`Sektè ${val === 'metivier' ? 'Métivier' : 'Millet'} chajé ✓`, 'success');
}

function populateFilters() {
  const zones = [...new Set(DB.abonnes.map(a => zoneName(a.pdl)))].sort();
  const zoneSelect = document.getElementById('filterZone');
  if (zoneSelect) {
    zoneSelect.innerHTML = '<option value="">Toutes les Zones</option>' + zones.map(z => `<option value="${z}">${z}</option>`).join('');
  }
  // Populate category filter
  const cats = [...new Set(DB.abonnes.map(a => a.categorie).filter(Boolean))].sort();
  const catSelect = document.getElementById('filterCategorie');
  if (catSelect) {
    catSelect.innerHTML = '<option value="">Toutes Catégories</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
  }
  updateBlocFilter();
}

function updateBlocFilter() {
  const zone = document.getElementById('filterZone')?.value;
  const filteredAbonnes = zone ? DB.abonnes.filter(a => zoneName(a.pdl) === zone) : DB.abonnes;
  const blocs = [...new Set(filteredAbonnes.map(a => parsePDL(a.pdl).bloc))].sort();
  const blocSelect = document.getElementById('filterBloc');
  if (blocSelect) {
    blocSelect.innerHTML = '<option value="">Tous les Blocs</option>' + blocs.map(b => `<option value="${b}">${b}</option>`).join('');
  }
}

async function saveToStorage() {
  localStorage.setItem(getStorageKey() + '_convs', JSON.stringify(DB.convocations));
  localStorage.setItem(getStorageKey() + '_activity', JSON.stringify(DB.activity));
  if (db) {
    const tx = db.transaction("clients", "readwrite");
    const store = tx.objectStore("clients");
    DB.abonnes.forEach(a => {
      const c = normalizeClient(a);
      store.put(c);
    });
    return new Promise(r => tx.oncomplete = r);
  }
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function showView(viewId, navEl) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + viewId).classList.add('active');
  if (navEl) navEl.classList.add('active');
  
  const titles = { 
    dashboard: 'Dashboard', 
    abonnes: 'Abonnés', 
    convocations: 'Convocations', 
    map: 'Kat GPS Tèren', 
    bodwo: 'Bòdwo Tèren',
    rapo: 'Rapò Swivi',
    import: 'Importer Archive' 
  };
  document.getElementById('pageTitle').textContent = titles[viewId] || viewId;
  
  if (viewId === 'map') {
    setTimeout(initMap, 100);
  } else if (viewId === 'bodwo') {
    renderBodwo();
  } else if (viewId === 'rapo') {
    renderRapo();
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function updateDashboard() {
  const a = DB.abonnes;
  const total = a.length;
  const actif = a.filter(x => x.statut === 'actif').length;
  const dette = a.filter(x => x.statut === 'dette').length;
  const conv  = a.filter(x => x.statut === 'convoque').length;
  const ferme = a.filter(x => x.statut === 'ferme').length;
  const verifye = a.filter(x => x.verifye && x.verifye.toString().toLowerCase() === 'wi').length;
  const totalTarif = a.reduce((sum, x) => sum + (parseFloat(x.tarif_taxe) || 0), 0);

  setText('kpi-total', total);
  setText('kpi-actif', actif);
  setText('kpi-dette', dette);
  setText('kpi-conv', conv);
  setText('kpi-ferme', ferme);
  setText('kpi-verifye', verifye);
  setText('kpi-tarif', totalTarif > 0 ? Math.round(totalTarif).toLocaleString() + ' HTG/mwa' : '0');
  setText('badge-abonnes', total);
  setText('badge-conv', DB.convocations.filter(c => c.statut === 'pending').length);

  if (total > 0) {
    setBar('actif', actif, total);
    setBar('dette', dette, total);
    setBar('conv', conv, total);
    setBar('ferme', ferme, total);
  }

  // Activity list
  const list = document.getElementById('activityList');
  if (DB.activity.length === 0) {
    list.innerHTML = `<div class="empty-state"><span>📭</span><p>Aucune activité récente.<br>Commencez par importer l'archive 2019.</p></div>`;
  } else {
    list.innerHTML = DB.activity.slice(-10).reverse().map(a =>
      `<div class="activity-item"><span class="activity-dot ${a.type}"></span><span>${a.msg}</span><span style="margin-left:auto;font-size:.72rem;color:var(--text2)">${a.time}</span></div>`
    ).join('');
  }
}

function setBar(key, val, total) {
  const pct = total > 0 ? Math.round(val / total * 100) : 0;
  const el = document.getElementById('bar-' + key);
  const pctEl = document.getElementById('pct-' + key);
  if (el) el.style.width = pct + '%';
  if (pctEl) pctEl.textContent = pct + '%';
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─── ABONNES TABLE ────────────────────────────────────────────────────────────
function renderAbonnes(list) {
  const data = list !== undefined ? list : getFiltered();
  const tbody = document.getElementById('abonnesBody');
  setText('resultCount', data.length + ' résultats');

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13" class="empty-row"><div class="empty-state"><span>📭</span><p>Aucun résultat.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((a, idx) => {
    const p = parsePDL(a.pdl);
    const isVerifye = a.verifye && a.verifye.toString().toLowerCase() === 'wi';
    const verifBadge = isVerifye
      ? `<span title="Vizit verifye" style="color:#22c55e;font-size:1rem">✅</span>`
      : `<span title="Pa verifye" style="color:#94a3b8;font-size:.85rem">—</span>`;
    const tarif = parseFloat(a.tarif_taxe) || 0;
    const tarifStr = tarif > 0 ? tarif.toLocaleString() + ' HTG' : '—';
    return `
    <tr>
      <td style="color:var(--text2);font-size:.75rem">${idx + 1}</td>
      <td><span class="loc-code">${p.secteur}-${p.zone}</span></td>
      <td><span class="loc-code">${p.bloc}</span></td>
      <td><span class="pdl-code">${a.pdl || '—'}</span></td>
      <td><strong>${a.nom || ''}</strong> ${a.prenom || ''}</td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.adresse || '—'}</td>
      <td style="font-size:.8rem">${a.telephone || '—'}</td>
      <td><span class="badge badge-${a.statut}">${labelStatut(a.statut)}</span></td>
      <td style="font-size:.75rem">${a.categorie || '—'}</td>
      <td style="font-size:.75rem;font-weight:600;color:var(--teal)">${tarifStr}</td>
      <td style="text-align:center">${verifBadge}</td>
      <td>${a.solde_ant && Number(a.solde_ant) > 0 ? '<span style="color:var(--red);font-weight:600">' + Number(a.solde_ant).toLocaleString() + ' HTG</span>' : '<span style="color:var(--text2)">0</span>'}</td>
      <td>
        <div class="action-btns">
          <button class="btn-icon" onclick="showDetail('${a.id}')" title="Voir détail">👁️</button>
          <button class="btn-icon" onclick="showConvForId('${a.id}')" title="Convoquer">📋</button>
          <button class="btn-icon danger" onclick="deleteAbonne('${a.id}')" title="Supprimer">🗑️</button>
        </div>
      </td>
    </tr>
  `;
  }).join('');
}

function getFiltered() {
  let data = [...DB.abonnes];
  const zone = document.getElementById('filterZone')?.value || '';
  const bloc = document.getElementById('filterBloc')?.value || '';
  const cat  = document.getElementById('filterCategorie')?.value || '';
  const ver  = document.getElementById('filterVerifye')?.value || '';
  const search = document.getElementById('searchAbonne')?.value?.toLowerCase() || '';

  if (zone) data = data.filter(a => zoneName(a.pdl) === zone);
  if (bloc) data = data.filter(a => parsePDL(a.pdl).bloc === bloc);
  if (cat)  data = data.filter(a => (a.categorie || '') === cat);
  if (ver === 'wi')  data = data.filter(a => a.verifye && a.verifye.toString().toLowerCase() === 'wi');
  if (ver === 'non') data = data.filter(a => !a.verifye || a.verifye.toString().toLowerCase() !== 'wi');

  if (search) data = data.filter(a =>
    (a.pdl || '').toLowerCase().includes(search) ||
    (a.nom || '').toLowerCase().includes(search) ||
    (a.prenom || '').toLowerCase().includes(search) ||
    (a.adresse || '').toLowerCase().includes(search) ||
    (a.telephone || '').toLowerCase().includes(search) ||
    (a.categorie || '').toLowerCase().includes(search) ||
    zoneName(a.pdl).toLowerCase().includes(search) ||
    blocName(a.pdl).toLowerCase().includes(search) ||
    (a.swivi || '').toLowerCase().includes(search)
  );
  data.sort((a, b) => {
    const va = (a[sortKey] || '').toString().toLowerCase();
    const vb = (b[sortKey] || '').toString().toLowerCase();
    return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
  });
  return data;
}

function filterAbonnes() { renderAbonnes(); }

function sortTable(key) {
  if (sortKey === key) sortAsc = !sortAsc;
  else { sortKey = key; sortAsc = true; }
  renderAbonnes();
}

function labelStatut(s) {
  return { actif:'Actif', dette:'En Dette', convoque:'Convoqué', ferme:'Fermé', nouveau:'Nouveau' }[s] || s;
}

function globalSearch(q) {
  if (!q) return;
  showView('abonnes', document.querySelector('.nav-item:nth-child(2)'));
  document.getElementById('searchAbonne').value = q;
  filterAbonnes();
}

// ─── ADD / EDIT ABONNE ────────────────────────────────────────────────────────
function showAddModal() { showView('import', document.querySelector('.nav-item:nth-child(5)')); }

function saveAbonne(e) {
  e.preventDefault();
  const a = {
    id: Date.now().toString(),
    pdl: v('f-pdl'),
    nom: v('f-nom').toUpperCase(),
    prenom: v('f-prenom'),
    adresse: v('f-adresse'),
    telephone: v('f-telephone') || '',
    solde_ant: v('f-solde') || '0',
    statut: v('f-statut'),
    notes: v('f-notes'),
    doleances: v('f-doleances') || '',
    swivi: v('f-swivi') || '',
    randevou: v('f-randevou') || '',
    lastAction: new Date().toLocaleDateString('fr-FR'),
    secteur: 'MILL1'
  };
  DB.abonnes.push(a);
  addActivity('green', `Abonné ajouté : ${a.nom} ${a.prenom} (PDL ${a.pdl})`);
  saveToStorage();
  updateDashboard();
  renderAbonnes();
  populateFilters();
  document.getElementById('addForm').reset();
  toast('Abonné enregistré ✓', 'success');
}

function deleteAbonne(id) {
  if (!confirm('Supprimer cet abonné?')) return;
  const a = DB.abonnes.find(x => x.id === id);
  DB.abonnes = DB.abonnes.filter(x => x.id !== id);
  if (a) addActivity('red', `Abonné supprimé : ${a.nom} ${a.prenom}`);
  saveToStorage();
  updateDashboard();
  renderAbonnes();
  toast('Abonné supprimé', 'info');
}

function showDetail(id) {
  const a = DB.abonnes.find(x => x.id === id);
  if (!a) return;
  currentAbonneId = id;
  const p = parsePDL(a.pdl);
  const isVerifye = a.verifye && a.verifye.toString().toLowerCase() === 'wi';
  const verifBadge = isVerifye
    ? `<span style="background:#dcfce7;color:#16a34a;border:1px solid #86efac;padding:.2rem .6rem;border-radius:20px;font-size:.8rem;font-weight:600">✅ Verifye</span>`
    : `<span style="background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1;padding:.2rem .6rem;border-radius:20px;font-size:.8rem">⏳ Pa Verifye</span>`;
  const tarif = parseFloat(a.tarif_taxe) || 0;
  const solde = Number(a.solde_ant || 0);
  document.getElementById('detailBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
      <div><label style="font-size:.72rem;color:var(--text2)">PDL (LOKALIZASYON)</label><p class="pdl-code" style="font-size:1.2rem;margin-top:.25rem">${a.pdl || '—'}</p></div>
      <div><label style="font-size:.72rem;color:var(--text2)">ZÒN / BLÒK</label><p class="loc-code" style="font-size:1.1rem;margin-top:.25rem">${p.secteur}-${p.zone} · Blòk ${p.bloc}</p></div>
      <div><label style="font-size:.72rem;color:var(--text2)">NOM / PRÉNOM</label><p style="font-weight:700;margin-top:.25rem">${a.nom} ${a.prenom || ''}</p></div>
      <div><label style="font-size:.72rem;color:var(--text2)">STATUT</label><p style="margin-top:.25rem"><span class="badge badge-${a.statut}">${labelStatut(a.statut)}</span></p></div>
      <div style="grid-column:1/-1"><label style="font-size:.72rem;color:var(--text2)">ADRESSE</label><p style="margin-top:.25rem">${a.adresse || '—'}</p></div>
      <div><label style="font-size:.72rem;color:var(--text2)">TELEFÒN</label><p style="margin-top:.25rem">${a.telephone || '—'}</p></div>
      <div><label style="font-size:.72rem;color:var(--text2)">VIZIT VERIFYE</label><p style="margin-top:.25rem">${verifBadge}</p></div>
      <div><label style="font-size:.72rem;color:var(--text2)">KATEGORI</label><p style="margin-top:.25rem;font-weight:600">${a.categorie || '—'} <span style="font-size:.75rem;color:var(--text2);font-weight:400">(${a.type || '—'})</span></p></div>
      <div><label style="font-size:.72rem;color:var(--text2)">TARIF / MWA</label><p style="margin-top:.25rem;color:var(--teal);font-weight:700;font-size:1.05rem">${tarif > 0 ? tarif.toLocaleString() + ' HTG/mwa' : '—'}</p></div>
      <div><label style="font-size:.72rem;color:var(--text2)">DÈT JWIYÈ (SOLDE ANT.)</label><p style="margin-top:.25rem;color:${solde > 0 ? 'var(--red)' : 'var(--green)'};font-weight:700;font-size:1.1rem">${solde > 0 ? solde.toLocaleString() + ' HTG' : '✅ Okenn dèt'}</p></div>
      <div><label style="font-size:.72rem;color:var(--text2)">RANDEVOU / SWIVI</label><p style="margin-top:.25rem;color:var(--blue);font-weight:600">${a.randevou || 'Aucun'}</p></div>
      ${a.notes ? `<div style="grid-column:1/-1"><label style="font-size:.72rem;color:var(--text2)">REMAK</label><p style="margin-top:.25rem;color:var(--text2)">${a.notes}</p></div>` : ''}
      ${a.doleances ? `<div style="grid-column:1/-1"><label style="font-size:.72rem;color:var(--text2)">DOLÉANS</label><p style="margin-top:.25rem;color:var(--orange)">${a.doleances}</p></div>` : ''}
      ${a.swivi ? `<div style="grid-column:1/-1"><label style="font-size:.72rem;color:var(--text2)">AKSYON SWIVI</label><p style="margin-top:.25rem;color:var(--teal)">${a.swivi}</p></div>` : ''}
    </div>
    <div style="margin-top:1.25rem; padding:1rem; border:1px solid var(--border); border-radius:8px; background:rgba(0,0,0,0.02)">
      <label style="font-size:.78rem;font-weight:600;display:block;margin-bottom:.75rem">🛠️ Aksyon Kritik (Swivi & Kontwòl) :</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        <div class="form-group">
          <label style="font-size:.7rem">Mete ajou Swivi</label>
          <input type="text" id="update-swivi" value="${a.swivi || ''}" placeholder="E.g. Koupe li, Rele li...">
        </div>
        <div class="form-group">
          <label style="font-size:.7rem">Mete ajou Randevou</label>
          <input type="date" id="update-randevou" value="${a.randevou || ''}">
        </div>
      </div>
      <div style="display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="updateAbonneSwivi('${id}')">💾 Mete ajou Swivi</button>
        <button class="btn btn-danger btn-sm" onclick="changeStatut('${id}','ferme')">✂️ Koupe (Fèmen)</button>
        <button class="btn btn-success btn-sm" onclick="changeStatut('${id}','actif')">🔌 Rekonekte</button>
      </div>
    </div>
    <div style="margin-top:1.25rem">
      <label style="font-size:.78rem;font-weight:600">Changer Statut :</label>
      <div style="display:flex;gap:.5rem;margin-top:.5rem;flex-wrap:wrap">
        ${['actif','dette','convoque','ferme','nouveau'].map(s =>
          `<button class="btn ${a.statut===s?'btn-primary':'btn-outline'}" onclick="changeStatut('${id}','${s}')">${labelStatut(s)}</button>`
        ).join('')}
      </div>
    </div>
  `;
  openModal('detailModal');
}

function updateAbonneSwivi(id) {
  const a = DB.abonnes.find(x => x.id === id);
  if (!a) return;
  a.swivi = document.getElementById('update-swivi').value;
  a.randevou = document.getElementById('update-randevou').value;
  a.lastAction = new Date().toLocaleDateString('fr-FR');
  addActivity('blue', `Swivi mete ajou pou : ${a.nom}`);
  saveToStorage();
  renderAbonnes();
  toast('Swivi mete ajou ✓', 'success');
}

function changeStatut(id, newStatut) {
  const a = DB.abonnes.find(x => x.id === id);
  if (!a) return;
  a.statut = newStatut;
  a.lastAction = new Date().toLocaleDateString('fr-FR');
  addActivity('orange', `Statut modifié : ${a.nom} → ${labelStatut(newStatut)}`);
  saveToStorage();
  updateDashboard();
  renderAbonnes();
  showDetail(id);
  toast('Statut mis à jour ✓', 'success');
}

function deleteCurrentAbonne() { if (currentAbonneId) { closeModal('detailModal'); deleteAbonne(currentAbonneId); } }
function showConvForCurrent() { if (currentAbonneId) { closeModal('detailModal'); showConvForId(currentAbonneId); } }

// ─── CONVOCATIONS ────────────────────────────────────────────────────────────
function showConvocationModal() { openModal('convModal'); }

function showConvForId(id) {
  const a = DB.abonnes.find(x => x.id === id);
  if (a) {
    document.getElementById('cv-pdl').value = a.pdl || '';
    document.getElementById('cv-nom').value = `${a.nom} ${a.prenom || ''}`.trim();
    document.getElementById('cv-adresse').value = a.adresse || '';
    document.getElementById('cv-montant').value = a.solde_ant || '';
  }
  openModal('convModal');
}

function saveConvocation() {
  const conv = {
    id: 'CON-' + Date.now(),
    numero: 'CON-MILL-' + String(DB.convocations.length + 1).padStart(4, '0'),
    secteur: document.getElementById('cv-secteur').value,
    pdl: document.getElementById('cv-pdl').value,
    nom: document.getElementById('cv-nom').value,
    adresse: document.getElementById('cv-adresse').value,
    montant: document.getElementById('cv-montant').value,
    periode: document.getElementById('cv-periode').value,
    date: new Date().toLocaleDateString('fr-FR'),
    statut: 'pending'
  };
  DB.convocations.push(conv);

  // Update abonne statut
  const a = DB.abonnes.find(x => x.pdl === conv.pdl);
  if (a) { a.statut = 'convoque'; a.lastAction = conv.date; }

  addActivity('orange', `Convocation émise : ${conv.nom} (PDL ${conv.pdl})`);
  saveToStorage();
  updateDashboard();
  renderAbonnes();
  renderConvocations();
  closeModal('convModal');
  toast(`Convocation ${conv.numero} enregistrée ✓`, 'success');
  setTimeout(() => window.print(), 500);
}

function renderConvocations() {
  const statut = document.getElementById('filterConvStatut')?.value || '';
  let data = statut ? DB.convocations.filter(c => c.statut === statut) : [...DB.convocations];
  const tbody = document.getElementById('convBody');
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-row"><div class="empty-state"><span>📋</span><p>Aucune convocation.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.reverse().map(c => `
    <tr>
      <td><span class="pdl-code">${c.numero}</span></td>
      <td><span class="pdl-code">${c.pdl || '—'}</span></td>
      <td><strong>${c.nom || '—'}</strong></td>
      <td style="font-size:.8rem">${c.adresse || '—'}</td>
      <td style="color:var(--red);font-weight:600">${c.montant ? Number(c.montant).toLocaleString() + ' HTG' : '—'}</td>
      <td style="font-size:.8rem">${c.date || '—'}</td>
      <td><span class="badge badge-${c.statut}">${c.statut === 'pending' ? 'En attente' : c.statut === 'done' ? 'Régularisé' : 'Ignoré'}</span></td>
      <td>
        <div class="action-btns">
          <button class="btn-icon" onclick="markConv('${c.id}','done')" title="Marquer régularisé">✅</button>
          <button class="btn-icon danger" onclick="markConv('${c.id}','ignore')" title="Ignorer">❌</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterConvocations() { renderConvocations(); }

function markConv(id, statut) {
  const c = DB.convocations.find(x => x.id === id);
  if (!c) return;
  c.statut = statut;
  if (statut === 'done') {
    const a = DB.abonnes.find(x => x.pdl === c.pdl);
    if (a) { a.statut = 'actif'; a.lastAction = new Date().toLocaleDateString('fr-FR'); }
    addActivity('green', `Régularisé : ${c.nom} (PDL ${c.pdl})`);
    setText('kpi-recouvre', Number(c.montant || 0).toLocaleString() + ' HTG');
  }
  saveToStorage();
  updateDashboard();
  renderAbonnes();
  renderConvocations();
  toast(statut === 'done' ? 'Dossier régularisé ✓' : 'Convocation ignorée', statut === 'done' ? 'success' : 'info');
}

// ─── IMPORT CSV ───────────────────────────────────────────────────────────────
function importCSV() {
  const raw = document.getElementById('csvInput').value.trim();
  if (!raw) { toast('Collez des données CSV d\'abord.', 'error'); return; }
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  let ok = 0, err = 0;
  const header = lines[0].toLowerCase().split(/[,\t]/);
  const idx = k => header.indexOf(k);

  const start = header.includes('localisation') ? 1 : 0;
  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(/[,\t]/);
    if (cols.length < 2) { err++; continue; }
    try {
      const a = {
        id: Date.now().toString() + i,
        localisation: cols[idx('localisation') >= 0 ? idx('localisation') : 0]?.trim() || '',
        pdl: cols[idx('pdl') >= 0 ? idx('pdl') : 1]?.trim() || '',
        nom: (cols[idx('nom') >= 0 ? idx('nom') : 2]?.trim() || '').toUpperCase(),
        prenom: cols[idx('prenom') >= 0 ? idx('prenom') : 3]?.trim() || '',
        adresse: cols[idx('adresse') >= 0 ? idx('adresse') : 4]?.trim() || '',
        solde_ant: cols[idx('solde_ant') >= 0 ? idx('solde_ant') : 5]?.trim() || '0',
        statut: (cols[idx('statut') >= 0 ? idx('statut') : 6]?.trim() || 'actif').toLowerCase(),
        lastAction: new Date().toLocaleDateString('fr-FR'),
        secteur: 'MILL1'
      };
      if (!a.localisation && !a.nom) { err++; continue; }
      DB.abonnes.push(a);
      ok++;
    } catch { err++; }
  }

  saveToStorage();
  updateDashboard();
  renderAbonnes();
  addActivity('green', `Archive importée : ${ok} abonnés ajoutés`);
  document.getElementById('importStats').classList.remove('hidden');
  setText('stat-ok', ok);
  setText('stat-err', err);
  toast(`${ok} abonnés importés ✓${err ? ` · ${err} erreurs` : ''}`, ok > 0 ? 'success' : 'error');
}

function loadSampleData() {
  const sample = typeof DINEPA_ARCHIVE_2019 !== 'undefined' ? DINEPA_ARCHIVE_2019 : [
    { localisation:'504001', pdl:'53200303001', nom:'PIERRE', prenom:'Marie-Louise', adresse:'12 Rue Chavannes, Millet', solde_ant:'8500', statut:'dette' },
  ];

  sample.forEach((s, i) => {
    DB.abonnes.push({ ...s, id: 'real-' + i, lastAction: 'Archive 2019', secteur: 'MILL1' });
  });

  saveToStorage();
  updateDashboard();
  renderAbonnes();
  addActivity('green', `Données exemple chargées : ${sample.length} abonnés (Archive 2019)`);
  document.getElementById('importStats').classList.remove('hidden');
  setText('stat-ok', sample.length);
  setText('stat-err', 0);
  toast(`${sample.length} abonnés exemple chargés ✓`, 'success');
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────
function exportData() {
  const data = getFiltered();
  const header = 'PDL,Zone,Bloc,Nom,Prénom,Adresse,Téléphone,Solde Antérieur,Statut';
  const rows = data.map(a => {
    const p = parsePDL(a.pdl);
    return [a.pdl,`${p.secteur}-${p.zone}`,p.bloc,a.nom,a.prenom,`"${a.adresse||''}"`,a.telephone||'',a.solde_ant,a.statut].join(',');
  });
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DINEPA_Millet_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Export CSV téléchargé ✓', 'success');
}

// ─── MODAL HELPERS ────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────
function addActivity(type, msg) {
  DB.activity.push({ type, msg, time: new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) });
  if (DB.activity.length > 50) DB.activity.shift();
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function v(id) { return document.getElementById(id)?.value?.trim() || ''; }

// ─── RESET & RELOAD ARCHIVE ─────────────────────────────────────────────────
function resetAndLoad() {
  const sekteName = currentSecteur === 'metivier' ? 'Métivier' : 'Millet';
  if (!confirm(`Sa ap efase tout done sektè ${sekteName} yo epi rechaje l nèf. Kontinye?`)) return;
  localStorage.removeItem(getStorageKey());
  location.reload();
}

// ─── BACKUP & SYNC ──────────────────────────────────────────────────────────
function exportBackupJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
    secteur: currentSecteur,
    db: DB,
    exportDate: new Date().toISOString()
  }));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href",     dataStr);
  downloadAnchor.setAttribute("download", `dinepa_backup_${currentSecteur}_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  toast('Backup JSON kòmanse telechaje! 📥', 'success');
}

function importBackupJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed && parsed.db && Array.isArray(parsed.db.abonnes)) {
        if (confirm(`Èske w vle ranplase done sektè ${currentSecteur} yo ak backup ${parsed.secteur || ''} ki te fèt nan dat ${new Date(parsed.exportDate).toLocaleDateString()}?`)) {
          // If the backup sector is different, switch sector
          if (parsed.secteur && parsed.secteur !== currentSecteur) {
            changeSecteur(parsed.secteur);
            const selectEl = document.getElementById('sektèSelect');
            if (selectEl) selectEl.value = parsed.secteur;
          }
          DB = parsed.db;
          saveToStorage();
          updateDashboard();
          renderAbonnes();
          renderConvocations();
          toast('Done yo enpòte avèk siksè! 🔄', 'success');
        }
      } else {
        toast('Fichye backup la pa valid ❌', 'error');
      }
    } catch(err) {
      toast('Erè pandan lekti fichye a ❌', 'error');
    }
  };
  reader.readAsText(file);
}

// ─── LEAFLET MAP INTEGRATION ──────────────────────────────────────────────────
let map = null;
let markersLayer = null;

function initMap() {
  const mapDiv = document.getElementById('map');
  if (!mapDiv) return;

  if (map) {
    map.invalidateSize();
    renderMap();
    return;
  }
  
  map = L.map('map').setView([18.5150, -72.3080], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  
  markersLayer = L.layerGroup().addTo(map);
  renderMap();
}

function renderMap() {
  if (!map || !markersLayer) return;
  markersLayer.clearLayers();
  
  const withGeo = DB.abonnes.filter(c => c.lat != null && c.lng != null);
  if (withGeo.length === 0) return;
  
  const bounds = [];
  withGeo.forEach(c => {
    const done = sameMonth(c.dènyeBòdwo);
    const color = currentSecteur === 'millet' ? '#4fb8a6' : '#5b8def';
    
    const m = L.circleMarker([c.lat, c.lng], {
      radius: done ? 9 : 7,
      fillColor: done ? '#6fbf73' : color,
      color: done ? '#ffffff' : color,
      weight: done ? 2 : 1.5,
      fillOpacity: done ? 0.95 : 0.15,
      dashArray: done ? null : "3, 4"
    }).addTo(markersLayer);
    
    const popupContent = `
      <div style="font-family:sans-serif;color:#111;min-width:140px;font-size:12px;">
        <h4 style="margin:0 0 6px 0;font-size:13px;font-weight:700;">${c.non}</h4>
        <span style="font-size:10px;background:#eee;padding:2px 5px;border-radius:3px;text-transform:uppercase;">${c.sektè}</span>
        <div style="margin-top:8px;">
          <b>Kod:</b> ${c.kòd || '—'}<br>
          <b>Dèt:</b> ${Math.round(c.solde_ant).toLocaleString()} HTG<br>
          <b>Estati:</b> ${done ? '<span style="color:green;font-weight:bold;">Fèt ✓</span>' : '<span style="color:orange;">Rete</span>'}<br>
        </div>
        <button onclick="showDetail('${c.id}')" style="width:100%;margin-top:10px;background:#14b8a6;border:none;color:#fff;padding:6px;border-radius:4px;cursor:pointer;font-weight:bold;font-size:11px;">Detay & Swivi</button>
      </div>
    `;
    m.bindPopup(popupContent);
    bounds.push([c.lat, c.lng]);
  });
  
  if (bounds.length > 0) {
    map.fitBounds(bounds);
  }
}

function sameMonth(iso) {
  if (!iso) return false;
  const d = new Date(iso), n = new Date();
  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

function sameDay(iso) {
  if (!iso) return false;
  const d = new Date(iso), n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

// ─── BÒDWO TÈREN VIEW ─────────────────────────────────────────────────────────
function renderBodwo() {
  const tableBody = document.getElementById('bodwoTableBody');
  if (!tableBody) return;
  
  const zoneVal = document.getElementById('bodwoFilterZone')?.value || '';
  const statusVal = document.getElementById('bodwoFilterStatus')?.value || '';
  const searchVal = document.getElementById('bodwoSearch')?.value?.toLowerCase() || '';
  
  let data = DB.abonnes;
  
  if (zoneVal) {
    data = data.filter(a => zoneName(a.pdl) === zoneVal);
  }
  if (statusVal) {
    data = data.filter(a => {
      const done = sameMonth(a.dènyeBòdwo);
      return statusVal === 'done' ? done : !done;
    });
  }
  if (searchVal) {
    data = data.filter(a => 
      a.pdl.toLowerCase().includes(searchVal) || 
      a.non.toLowerCase().includes(searchVal) || 
      a.adresse.toLowerCase().includes(searchVal)
    );
  }
  
  const zoneSelect = document.getElementById('bodwoFilterZone');
  if (zoneSelect && zoneSelect.options.length <= 1) {
    const zones = [...new Set(DB.abonnes.map(a => zoneName(a.pdl)))].sort();
    zoneSelect.innerHTML = '<option value="">Tout Zòn</option>' + zones.map(z => `<option value="${z}">${z}</option>`).join('');
  }
  
  document.getElementById('bodwoResultCount').textContent = `${data.length} abonnés`;
  
  if (data.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" class="empty-row"><div class="empty-state"><span>🔍</span><p>Aucun abonné trouvé.</p></div></td></tr>';
    return;
  }
  
  tableBody.innerHTML = data.map(a => {
    const done = sameMonth(a.dènyeBòdwo);
    const hasGeo = a.lat != null && a.lng != null;
    return `
      <tr>
        <td><span class="badge ${a.sektè === 'Millet' ? 'badge-actif' : 'badge-convoque'}">${a.sektè}</span></td>
        <td><span class="loc-code">${a.pdl}</span></td>
        <td>
          <div style="font-weight:600">${a.non}</div>
          <div style="font-size:0.75rem;color:var(--text2)">${a.adresse}</div>
        </td>
        <td>${a.telephone || '—'}</td>
        <td style="font-weight:600">${Math.round(a.solde_ant).toLocaleString()} HTG</td>
        <td>
          ${hasGeo ? `
            <button class="btn btn-outline" style="border-color:var(--green);color:var(--green);padding:.3rem .6rem;font-size:.75rem;cursor:pointer;" onclick="showOnMap(${a.lat}, ${a.lng})">📍 Kat (OK)</button>
          ` : `
            <button class="btn btn-danger" style="padding:.3rem .6rem;font-size:.75rem;cursor:pointer;" onclick="recordGPS('${a.id}')">📡 GPS</button>
          `}
        </td>
        <td>
          ${done ? `
            <button class="btn btn-outline" style="border-color:var(--green);color:var(--green);padding:.3rem .6rem;font-size:.75rem;cursor:pointer;" onclick="undoDelivery('${a.id}')">✅ Fèt</button>
          ` : `
            <button class="btn btn-primary" style="padding:.3rem .6rem;font-size:.75rem;cursor:pointer;" onclick="confirmDelivery('${a.id}')">✉️ Livre</button>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

function showOnMap(lat, lng) {
  showView('map', document.querySelector('.nav-item[onclick*="map"]'));
  setTimeout(() => {
    if (map) {
      map.setView([lat, lng], 18);
    }
  }, 200);
}

function recordGPS(id) {
  if (!navigator.geolocation) {
    toast("Geolocation pa sipòte nan navigatè sa a ❌", "error");
    return;
  }
  toast("📡 Ap chèche koodone GPS...", "info");
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      const ab = DB.abonnes.find(x => x.id === id);
      if (ab) {
        ab.lat = latitude;
        ab.lng = longitude;
        await saveToStorage();
        renderBodwo();
        toast("Koodone GPS anrejistre avèk siksè! 📍", "success");
      }
    },
    (err) => {
      toast("Pa kapab jwenn GPS. Asire w sèvis lokalizasyon an aktive ❌", "error");
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

async function confirmDelivery(id) {
  const ab = DB.abonnes.find(x => x.id === id);
  if (ab) {
    ab.dènyeBòdwo = new Date().toISOString();
    ab.statut = 'convoque';
    await saveToStorage();
    renderBodwo();
    toast(`Bòdwo livre pou ${ab.non} ✓`, "success");
  }
}

async function undoDelivery(id) {
  const ab = DB.abonnes.find(x => x.id === id);
  if (ab) {
    ab.dènyeBòdwo = null;
    await saveToStorage();
    renderBodwo();
    toast(`Livrezon bòdwo anile pou ${ab.non} ✓`, "info");
  }
}

// ─── RAPÒ SWIVI VIEW ──────────────────────────────────────────────────────────
function renderRapo() {
  const a = DB.abonnes;
  const total = a.length;
  const livre = a.filter(x => sameMonth(x.dènyeBòdwo)).length;
  const rete = total - livre;
  
  const livrePct = total > 0 ? Math.round((livre / total) * 100) : 0;
  const retePct = total > 0 ? 100 - livrePct : 0;
  
  const barLivre = document.getElementById('bar-livre-pct');
  const valLivre = document.getElementById('val-livre-pct');
  if (barLivre) barLivre.style.width = `${livrePct}%`;
  if (valLivre) valLivre.textContent = `${livrePct}%`;
  
  const barRete = document.getElementById('bar-rete-pct');
  const valRete = document.getElementById('val-rete-pct');
  if (barRete) barRete.style.width = `${retePct}%`;
  if (valRete) valRete.textContent = `${retePct}%`;
  
  const activityList = document.getElementById('rapoActivityList');
  if (activityList) {
    const complaints = a.filter(x => x.doleances || x.swivi || sameDay(x.dènyeBòdwo));
    if (complaints.length === 0) {
      activityList.innerHTML = '<div class="empty" style="padding:16px;text-align:center;color:var(--text2)">Pa gen okenn doleyans oswa swivi pou jodi a.</div>';
      return;
    }
    
    activityList.innerHTML = complaints.map(c => `
      <div class="activity-item" style="margin-bottom:.5rem;padding:.5rem;background:var(--bg3);border-radius:8px;display:flex;align-items:center;gap:.75rem;">
        <span class="activity-dot ${c.doleances ? 'red' : 'green'}" style="width:8px;height:8px;border-radius:50%;background:${c.doleances ? 'var(--red)' : 'var(--green)'}"></span>
        <div style="flex:1">
          <strong>${c.non}</strong> (${c.pdl})
          <div style="font-size:0.75rem;color:var(--text2)">
            ${c.doleances ? `⚠️ Doleyans: ${c.doleances}` : ''}
            ${c.swivi ? ` | 📝 Swivi: ${c.swivi}` : ''}
            ${sameDay(c.dènyeBòdwo) ? ` | ✅ Bòdwo bay jodi a` : ''}
          </div>
        </div>
      </div>
    `).join('');
  }
}

function copyDailyReport() {
  const a = DB.abonnes;
  const todayLivre = a.filter(x => sameDay(x.dènyeBòdwo));
  const complaints = a.filter(x => x.doleances && sameDay(x.dènyeBòdwo));
  
  let reportText = `📊 *RAPÒ REKOUVREMAN JOUNEN AN (${new Date().toLocaleDateString('fr-FR')})*\n`;
  reportText += `Sektè: ${currentSecteur === 'metivier' ? 'Métivier' : 'Millet'}\n`;
  reportText += `--------------------------------------------------\n`;
  reportText += `✉️ Bòdwo Livre: ${todayLivre.length}\n`;
  reportText += `⚠️ Doleyans: ${complaints.length}\n\n`;
  
  if (todayLivre.length > 0) {
    reportText += `✅ *LIVREZON YO :*\n`;
    todayLivre.forEach((x, i) => {
      reportText += `${i+1}. ${x.non} (${x.pdl}) - Solde: ${Math.round(x.solde_ant)} HTG\n`;
    });
    reportText += `\n`;
  }
  
  if (complaints.length > 0) {
    reportText += `⚠️ *DOLEYANS ANREJISTRE :*\n`;
    complaints.forEach((x, i) => {
      reportText += `${i+1}. ${x.non} (${x.pdl}): ${x.doleances}\n`;
    });
  }
  
  navigator.clipboard.writeText(reportText).then(() => {
    toast("Rapò jounen an kopye nan Clipboard! 📋", "success");
  }).catch(() => {
    toast("Echèk kopye rapò ❌", "error");
  });
}

// ─── MIGRATION TOOLBAR (Export + Import localStorage → IndexedDB) ────────────
//
// Objektif: PWA ansyen vèsyon an sou iPhone gen done localStorage ki enpòtan.
// Zouti sa a pèmèt:
//   1) Ekspòte tout localStorage kòm JSON pou w ka kopye l
//   2) Voye JSON sa a nan IndexedDB nan nouvo vèsyon an
// Konsa done w yo ap sove san w pa bezwen efase PWA a.

function ensureMigrationToolbar() {
  if (document.getElementById('migrationToolbar')) return;

  const toolbar = document.createElement('div');
  toolbar.id = 'migrationToolbar';
  toolbar.style.cssText = `
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 99999;
    background: #fff3cd; color: #000; border-top: 2px solid #856404;
    padding: 12px; font-family: monospace; font-size: 12px;
    box-shadow: 0 -2px 8px rgba(0,0,0,0.15);
  `;
  toolbar.innerHTML = `
    <details>
      <summary style="cursor:pointer;font-weight:bold;padding:4px;">
        🛠️ Migrasyon done (Export / Import) — Klike pou ouvri
      </summary>
      <div style="margin-top:8px;">
        <div style="margin-bottom:8px;">
          <strong>1️⃣ Ekspòte done ki nan localStorage:</strong><br>
          <button id="btnExportLS" style="padding:6px 10px;margin:4px 0;background:#0d6efd;color:white;border:none;border-radius:4px;cursor:pointer;">
            📋 Ekspòte localStorage → JSON
          </button>
          <textarea id="exportResult" style="width:100%;height:120px;display:none;margin-top:4px;font-size:11px;" readonly></textarea>
        </div>
        <hr style="margin:10px 0;">
        <div>
          <strong>2️⃣ Voye (Import) done nan IndexedDB:</strong><br>
          <textarea id="importInput" placeholder="Kole JSON localStorage isit la..." style="width:100%;height:80px;margin-top:4px;font-size:11px;"></textarea>
          <button id="btnImportLS" style="padding:6px 10px;margin:4px 0;background:#198754;color:white;border:none;border-radius:4px;cursor:pointer;">
            📥 Voye done sa a nan IndexedDB
          </button>
          <div id="importStatus" style="margin-top:4px;"></div>
        </div>
        <button id="btnCloseToolbar" style="padding:4px 8px;margin-top:6px;background:#dc3545;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;">
          ✕ Fèmen zouti sa a
        </button>
      </div>
    </details>
  `;
  document.body.appendChild(toolbar);

  document.getElementById('btnExportLS').onclick = () => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      data[k] = localStorage.getItem(k);
    }
    const json = JSON.stringify(data, null, 2);
    const ta = document.getElementById('exportResult');
    ta.style.display = 'block';
    ta.value = json;
    ta.select();
    try {
      navigator.clipboard.writeText(json);
      toast("Done kopye nan clipboard! 📋", "success");
    } catch (e) {
      toast("Seleksyone tèks la epi kopye manyèlman (Ctrl/Cmd+C)", "info");
    }
  };

  document.getElementById('btnImportLS').onclick = async () => {
    const raw = document.getElementById('importInput').value.trim();
    const status = document.getElementById('importStatus');
    if (!raw) {
      status.innerHTML = '<span style="color:#dc3545;">❌ Vid. Kole JSON an nan bwat ki anlè a dabò.</span>';
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      await initDb();
      let imported = 0;
      for (const [key, val] of Object.entries(parsed)) {
        if (typeof val !== 'string') continue;
        if (val.startsWith('[') || val.startsWith('{')) {
          try {
            const arr = JSON.parse(val);
            if (Array.isArray(arr)) {
              for (const item of arr) {
                if (item && typeof item === 'object' && item.id) {
                  const tx = db.transaction("clients", "readwrite");
                  tx.objectStore("clients").put(item);
                  await new Promise(r => tx.oncomplete = r);
                  imported++;
                }
              }
            }
          } catch (e) { /* skip non-JSON values */ }
        }
      }
      status.innerHTML = `<span style="color:#198754;">✅ ${imported} kliyan voye nan IndexedDB. Louvri app a ankò pou w wè yo.</span>`;
      toast(`${imported} kliyan sove! ✅`, "success");
    } catch (e) {
      status.innerHTML = `<span style="color:#dc3545;">❌ JSON pa valab: ${e.message}</span>`;
    }
  };

  document.getElementById('btnCloseToolbar').onclick = () => {
    toolbar.remove();
    localStorage.setItem('_migrationToolbarDismissed', '1');
  };

  if (localStorage.getItem('_migrationToolbarDismissed') === '1') {
    toolbar.style.display = 'none';
  }
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureMigrationToolbar);
  } else {
    setTimeout(ensureMigrationToolbar, 500);
  }
}

