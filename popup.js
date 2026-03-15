/*!
 * Tivra SecureAuth — Microsoft Edge Extension
 * Copyright (c) 2026 Deepak Kalyani. All rights reserved.
 * Author: Deepak Kalyani | Version: 1.0.0 | License: Proprietary
 * TOTP: RFC 6238 / HOTP: RFC 4226 | No third-party dependencies.
 */
'use strict';

// ── TOTP ──────────────────────────────────────────────────────────────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input) {
  const str = input.toUpperCase().replace(/[\s=]/g, '');
  const out = []; let bits = 0, val = 0;
  for (const ch of str) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error('Invalid base32 char: ' + ch);
    val = (val << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(out);
}

function base32Encode(bytes) {
  let result = '', bits = 0, val = 0;
  for (const b of bytes) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { result += B32[(val >>> (bits - 5)) & 0x1f]; bits -= 5; }
  }
  if (bits > 0) result += B32[(val << (5 - bits)) & 0x1f];
  return result;
}

async function generateTOTP(secret) {
  const keyBytes = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = new Uint8Array(8); let c = counter;
  for (let i = 7; i >= 0; i--) { buf[i] = c & 0xff; c = Math.floor(c / 256); }
  const ck = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', ck, buf);
  const h = new Uint8Array(sig);
  const off = h[h.length - 1] & 0x0f;
  const code = (((h[off] & 0x7f) << 24) | (h[off+1] << 16) | (h[off+2] << 8) | h[off+3]) % 1000000;
  return code.toString().padStart(6, '0');
}

// ── Google Authenticator Migration protobuf decoder ───────────────────────────
function readVarint(b, off) {
  let result = 0, shift = 0;
  while (off < b.length) {
    const byte = b[off++]; result |= (byte & 0x7f) << shift; shift += 7;
    if (!(byte & 0x80)) break;
  }
  return { value: result, offset: off };
}

function decodeOtpEntry(bytes) {
  let secret = null, name = '', issuer = '';
  let off = 0; const dec = new TextDecoder();
  while (off < bytes.length) {
    const tag = bytes[off++]; const field = tag >> 3; const wire = tag & 0x7;
    if (wire === 2) {
      const r = readVarint(bytes, off); off = r.offset;
      const chunk = bytes.slice(off, off + r.value); off += r.value;
      if (field === 1) secret = chunk;
      else if (field === 2) name = dec.decode(chunk);
      else if (field === 3) issuer = dec.decode(chunk);
    } else if (wire === 0) { const r = readVarint(bytes, off); off = r.offset; }
    else if (wire === 5) { off += 4; } else if (wire === 1) { off += 8; } else break;
  }
  return { secret, name, issuer };
}

function decodeMigrationPayload(bytes) {
  const entries = []; let off = 0;
  while (off < bytes.length) {
    const tag = bytes[off++]; const field = tag >> 3; const wire = tag & 0x7;
    if (field === 1 && wire === 2) {
      const r = readVarint(bytes, off); off = r.offset;
      const msg = bytes.slice(off, off + r.value); off += r.value;
      const entry = decodeOtpEntry(msg);
      if (entry.secret) entries.push(entry);
    } else if (wire === 0) { const r = readVarint(bytes, off); off = r.offset; }
    else if (wire === 2) { const r = readVarint(bytes, off); off = r.offset; off += r.value; }
    else if (wire === 5) { off += 4; } else if (wire === 1) { off += 8; } else break;
  }
  return entries;
}

function base64ToBytes(b64) {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = s + '==='.slice((s.length + 3) % 4);
  const binary = atob(padded);
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
}

function parseQRContent(raw) {
  const str = raw.trim();
  if (str.startsWith('otpauth-migration://')) {
    const url = new URL(str);
    const data = url.searchParams.get('data');
    if (!data) throw new Error('No data parameter found in the migration URL.');
    const bytes = base64ToBytes(data);
    const entries = decodeMigrationPayload(bytes);
    if (!entries.length) throw new Error('No accounts found in the QR data.');
    return entries.map(e => ({
      name: e.name || 'Imported account',
      issuer: e.issuer || '',
      secret: base32Encode(e.secret)
    }));
  }
  if (str.startsWith('otpauth://totp/')) {
    const url = new URL(str);
    const secret = url.searchParams.get('secret');
    if (!secret) throw new Error('No secret found in the QR code URL.');
    const issuer = url.searchParams.get('issuer') || '';
    const label = decodeURIComponent(url.pathname.replace(/^\/\/totp\//, ''));
    return [{ name: label || issuer || 'Imported account', issuer, secret }];
  }
  // Check if it contains an otpauth URL embedded somewhere
  const migMatch = str.match(/otpauth-migration:\/\/[^\s]+/);
  if (migMatch) return parseQRContent(migMatch[0]);
  const authMatch = str.match(/otpauth:\/\/totp\/[^\s]+/);
  if (authMatch) return parseQRContent(authMatch[0]);

  throw new Error(
    'Could not read this as an authenticator QR.\n' +
    'Make sure you copy the full decoded text starting with "otpauth-migration://" or "otpauth://totp/".'
  );
}

// ── QR scanning via BarcodeDetector (with graceful fallback) ──────────────────
async function tryBarcodeDetector(imageSource) {
  if (!('BarcodeDetector' in window)) return null;
  try {
    // Try to get supported formats — not all Edge versions support qr_code
    const supported = await BarcodeDetector.getSupportedFormats().catch(() => ['qr_code']);
    const formats = supported.includes('qr_code') ? ['qr_code'] : supported;
    if (!formats.length) return null;
    const detector = new BarcodeDetector({ formats });
    const barcodes = await detector.detect(imageSource);
    return barcodes.length ? barcodes[0].rawValue : null;
  } catch { return null; }
}

async function scanImageFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      URL.revokeObjectURL(url);
      const result = await tryBarcodeDetector(img);
      if (result) { resolve(result); return; }
      // BarcodeDetector failed — inform user to use paste method
      reject(new Error(
        'Automatic QR scanning is not available in your Edge configuration.\n' +
        'Please use the "Paste the export URL" method above — it always works.'
      ));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load the image file.')); };
    img.src = url;
  });
}

// ── Storage ───────────────────────────────────────────────────────────────────
function loadAccounts() { return new Promise(r => chrome.storage.local.get('totp_accounts', d => r(d.totp_accounts || []))); }
function saveAccounts(a) { return new Promise(r => chrome.storage.local.set({ totp_accounts: a }, r)); }

// ── State ─────────────────────────────────────────────────────────────────────
let accounts = [], codes = {}, copiedId = null, copiedTimer = null;
let webcamStream = null, webcamScanInterval = null, pendingImports = [];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(n) { return n.split(/[\s·@\-_\.]+/).filter(Boolean).slice(0,2).map(w=>w[0]||'').join('').toUpperCase()||'?'; }
function formatCode(c) { return c.slice(0,3)+' '+c.slice(3); }
function getSecondsLeft() { return 30 - (Math.floor(Date.now()/1000)%30); }
function escH(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function uid() { return 'acc_'+Date.now()+'_'+Math.random().toString(36).slice(2,5); }

// ── Render ────────────────────────────────────────────────────────────────────
function renderAccounts() {
  const tl = getSecondsLeft(), urgent = tl <= 7;
  if (!accounts.length) { accountListEl.innerHTML=''; emptyStateEl.classList.remove('hidden'); return; }
  emptyStateEl.classList.add('hidden');
  accountListEl.innerHTML = accounts.map(acc => {
    const code = codes[acc.id]||'------', isCopied = copiedId===acc.id;
    const copyIcon = isCopied
      ? `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5l3 3 6-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      : `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="4" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M4 4V2.5A1.5 1.5 0 015.5 1H11A1.5 1.5 0 0112.5 2.5v6A1.5 1.5 0 0111 10H9.5" stroke="currentColor" stroke-width="1.2"/></svg>`;
    return `<div class="account-item">
      <div class="account-avatar">${escH(getInitials(acc.name))}</div>
      <div class="account-info">
        <div class="account-name" title="${escH(acc.name)}">${escH(acc.name)}</div>
        <div class="account-code${urgent?' urgent':''}">${escH(formatCode(code))}</div>
      </div>
      <div class="account-actions">
        <button class="btn-action${isCopied?' copied':''}" data-action="copy" data-id="${escH(acc.id)}" title="${isCopied?'Copied!':'Copy'}">${copyIcon}</button>
        <button class="btn-action" data-action="edit" data-id="${escH(acc.id)}" title="Rename">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8.5 2.5l2 2L4 11H2v-2L8.5 2.5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="btn-action del" data-action="delete" data-id="${escH(acc.id)}" title="Remove">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3.5h9M5 3.5V2.5h3v1M4.5 3.5l.5 7h4l.5-7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

function updateTimer() {
  const tl = getSecondsLeft(), urgent = tl<=7;
  timerBarEl.style.width = ((tl/30)*100)+'%';
  timerBarEl.classList.toggle('urgent',urgent);
  timerLabelEl.textContent = tl+'s';
  timerLabelEl.classList.toggle('urgent',urgent);
  document.querySelectorAll('.account-code').forEach(el=>el.classList.toggle('urgent',urgent));
}

async function refreshAllCodes() {
  for (const acc of accounts) {
    try { codes[acc.id] = await generateTOTP(acc.secret); } catch { codes[acc.id]='------'; }
  }
  renderAccounts();
}

// ── Views ─────────────────────────────────────────────────────────────────────
function showView(name) {
  [viewMainEl,viewImportEl,viewAddEl].forEach(v=>v.classList.add('hidden'));
  stopWebcam();
  if (name==='main')   viewMainEl.classList.remove('hidden');
  if (name==='import') { viewImportEl.classList.remove('hidden'); showImportStep(1); }
  if (name==='add')    { viewAddEl.classList.remove('hidden'); setTimeout(()=>inputNameEl.focus(),50); }
}

function showImportStep(n) {
  importStep1El.classList.toggle('hidden', n!==1);
  importStep2El.classList.toggle('hidden', n!==2);
  importErrorEl.classList.add('hidden'); importErrorEl.textContent='';
  if (n===1) urlPasteEl.value='';
}

function showImportError(msg) {
  importErrorEl.textContent = msg; importErrorEl.classList.remove('hidden');
}

function toggleMethod(id) {
  const card = document.getElementById(id);
  const body = document.getElementById(id+'-body');
  const isActive = card.classList.contains('active');
  document.querySelectorAll('.method-card').forEach(c=>c.classList.remove('active'));
  document.querySelectorAll('.method-body').forEach(b=>b.classList.add('hidden'));
  if (!isActive) { card.classList.add('active'); body.classList.remove('hidden'); }
}

// ── Import logic ──────────────────────────────────────────────────────────────
function handleParsed(parsed) {
  pendingImports = parsed;
  renderPreview();
  showImportStep(2);
}

function renderPreview() {
  const existing = new Set(accounts.map(a=>a.secret.toUpperCase()));
  previewCountEl.textContent = pendingImports.length+' account'+(pendingImports.length!==1?'s':'')+' found';
  previewListEl.innerHTML = pendingImports.map((item,idx) => {
    const already = existing.has(item.secret.toUpperCase());
    const displayName = (item.issuer && !item.name.includes(item.issuer)) ? item.issuer+' · '+item.name : item.name;
    return `<label class="preview-item${already?' already':''} selected" data-idx="${idx}">
      <input type="checkbox" ${already?'':'checked'} ${already?'disabled':''} data-idx="${idx}" />
      <div class="preview-item-info">
        <div class="preview-item-name">${escH(displayName)}</div>
        ${item.issuer?`<div class="preview-item-issuer">${escH(item.issuer)}</div>`:''}
      </div>
      ${already?'<span class="preview-already-badge">already added</span>':''}
    </label>`;
  }).join('');
  previewListEl.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', ()=>cb.closest('.preview-item').classList.toggle('selected',cb.checked));
  });
}

function getSelectedImports() {
  return [...previewListEl.querySelectorAll('input[type=checkbox]:checked:not(:disabled)')]
    .map(cb => pendingImports[parseInt(cb.dataset.idx)]);
}

// ── Webcam ────────────────────────────────────────────────────────────────────
async function startWebcam() {
  if (!('BarcodeDetector' in window)) {
    showImportError('QR scanning via webcam requires BarcodeDetector API which is not available in your Edge setup. Please use the "Paste URL" method instead.');
    return;
  }
  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    webcamVideoEl.srcObject = webcamStream;
    webcamAreaEl.classList.remove('hidden');
    const supported = await BarcodeDetector.getSupportedFormats().catch(()=>['qr_code']);
    const formats = supported.includes('qr_code') ? ['qr_code'] : supported;
    const detector = new BarcodeDetector({ formats });
    webcamScanInterval = setInterval(async () => {
      if (!webcamStream) return;
      try {
        const barcodes = await detector.detect(webcamVideoEl);
        if (barcodes.length) { stopWebcam(); try { handleParsed(parseQRContent(barcodes[0].rawValue)); } catch(e){ showImportError(e.message); } }
      } catch {}
    }, 400);
  } catch (e) { showImportError('Camera access denied. ' + e.message); }
}

function stopWebcam() {
  if (webcamScanInterval) { clearInterval(webcamScanInterval); webcamScanInterval=null; }
  if (webcamStream) { webcamStream.getTracks().forEach(t=>t.stop()); webcamStream=null; }
  if (webcamAreaEl) webcamAreaEl.classList.add('hidden');
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const viewMainEl    = document.getElementById('view-main');
const viewImportEl  = document.getElementById('view-import');
const viewAddEl     = document.getElementById('view-add');
const accountListEl = document.getElementById('account-list');
const emptyStateEl  = document.getElementById('empty-state');
const timerBarEl    = document.getElementById('timer-bar');
const timerLabelEl  = document.getElementById('timer-label');
const importStep1El = document.getElementById('import-step-1');
const importStep2El = document.getElementById('import-step-2');
const importErrorEl = document.getElementById('import-error');
const fileInputEl   = document.getElementById('file-input');
const webcamAreaEl  = document.getElementById('webcam-area');
const webcamVideoEl = document.getElementById('webcam-video');
const previewCountEl= document.getElementById('preview-count-text');
const previewListEl = document.getElementById('preview-list');
const urlPasteEl    = document.getElementById('url-paste-input');
const inputNameEl   = document.getElementById('input-name');
const inputSecretEl = document.getElementById('input-secret');
const formErrorEl   = document.getElementById('form-error');

// ── Event wiring ──────────────────────────────────────────────────────────────

// Nav
document.getElementById('btn-open-import').onclick = ()=>showView('import');
document.getElementById('btn-empty-import').onclick = ()=>showView('import');
document.getElementById('btn-open-add').onclick     = ()=>showView('add');
document.getElementById('btn-import-back').onclick  = ()=>showView('main');
document.getElementById('btn-back').onclick         = ()=>showView('main');

// URL paste import
document.getElementById('btn-parse-url').onclick = () => {
  const raw = urlPasteEl.value.trim();
  if (!raw) { showImportError('Please paste the decoded QR text first.'); return; }
  try { handleParsed(parseQRContent(raw)); }
  catch(e) { showImportError(e.message); }
};

// Open zxing link (window.open — no tabs permission needed)
document.getElementById('btn-open-zxing').onclick = (e) => {
  e.preventDefault();
  window.open('https://zxing.org/w/decode.jspx', '_blank');
};

// Paste (Ctrl+V) — text only now
document.addEventListener('paste', async e=>{
  if (viewImportEl.classList.contains('hidden')) return;
  // If focus is in the textarea, let default paste handle it
  if (document.activeElement === urlPasteEl) return;
  const items = [...e.clipboardData.items];
  const imgItem = items.find(i=>i.type.startsWith('image/'));
  if (imgItem) {
    e.preventDefault();
    const file = imgItem.getAsFile();
    try { handleParsed(parseQRContent(await scanImageFile(file))); }
    catch(err) { showImportError(err.message); }
    return;
  }
  const textItem = items.find(i=>i.type==='text/plain');
  if (textItem) {
    textItem.getAsString(str=>{
      if (str.includes('otpauth')) {
        e.preventDefault();
        try { handleParsed(parseQRContent(str)); }
        catch(err) { showImportError(err.message); }
      }
    });
  }
});

// Preview actions
document.getElementById('btn-select-all').onclick = ()=>{
  previewListEl.querySelectorAll('input[type=checkbox]:not(:disabled)').forEach(cb=>{ cb.checked=true; cb.closest('.preview-item').classList.add('selected'); });
};
document.getElementById('btn-scan-again').onclick = ()=>showImportStep(1);
document.getElementById('btn-confirm-import').onclick = async ()=>{
  const selected = getSelectedImports();
  if (!selected.length) { showImportError('Please select at least one account.'); return; }
  const existing = new Set(accounts.map(a=>a.secret.toUpperCase()));
  for (const item of selected) {
    if (existing.has(item.secret.toUpperCase())) continue;
    const displayName = (item.issuer && !item.name.includes(item.issuer)) ? item.issuer+' · '+item.name : item.name;
    const acc = { id: uid(), name: displayName, secret: item.secret, createdAt: Date.now() };
    accounts.push(acc);
    try { codes[acc.id] = await generateTOTP(item.secret); } catch { codes[acc.id]='------'; }
    await new Promise(r=>setTimeout(r,2));
  }
  await saveAccounts(accounts);
  renderAccounts();
  showView('main');
};

// Account actions
accountListEl.addEventListener('click', async e=>{
  const btn = e.target.closest('[data-action]'); if (!btn) return;
  const id = btn.dataset.id, action = btn.dataset.action;
  if (action==='copy') {
    const code = (codes[id]||'').replace(/\s/g,''); if (!code||code==='------') return;
    try { await navigator.clipboard.writeText(code); } catch {
      const ta = Object.assign(document.createElement('textarea'),{value:code});
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    copiedId=id; if (copiedTimer) clearTimeout(copiedTimer);
    copiedTimer = setTimeout(()=>{ copiedId=null; renderAccounts(); },2000);
    renderAccounts();
  } else if (action==='edit') {
    const acc = accounts.find(a=>a.id===id);
    if (!acc) return;
    const newName = prompt('Rename account:', acc.name);
    if (newName && newName.trim() && newName.trim() !== acc.name) {
      acc.name = newName.trim();
      await saveAccounts(accounts); renderAccounts();
    }
  } else if (action==='delete') {
    const acc = accounts.find(a=>a.id===id);
    if (acc && confirm(`Remove "${acc.name}"?`)) {
      accounts = accounts.filter(a=>a.id!==id); delete codes[id];
      await saveAccounts(accounts); renderAccounts();
    }
  }
});

// Manual add
document.getElementById('btn-save').onclick = async ()=>{
  const name = inputNameEl.value.trim();
  const secret = inputSecretEl.value.trim().toUpperCase().replace(/\s+/g,'');
  if (!name||!secret) { formErrorEl.textContent='Please fill in both fields.'; formErrorEl.classList.remove('hidden'); return; }
  try { await generateTOTP(secret); } catch {
    formErrorEl.textContent='Invalid secret key — must be base32 (letters A-Z and digits 2-7).';
    formErrorEl.classList.remove('hidden'); return;
  }
  formErrorEl.classList.add('hidden');
  const acc = { id: uid(), name, secret, createdAt: Date.now() };
  accounts.push(acc); codes[acc.id] = await generateTOTP(secret);
  await saveAccounts(accounts); inputNameEl.value=''; inputSecretEl.value='';
  renderAccounts(); showView('main');
};
inputSecretEl.addEventListener('keydown', e=>{ if(e.key==='Enter') document.getElementById('btn-save').click(); });

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  accounts = await loadAccounts();
  await refreshAllCodes();
  updateTimer();
  let lastPeriod = Math.floor(Date.now()/1000/30);
  setInterval(async ()=>{
    const p = Math.floor(Date.now()/1000/30);
    updateTimer();
    if (p!==lastPeriod) { lastPeriod=p; await refreshAllCodes(); }
  }, 500);
}
init();
