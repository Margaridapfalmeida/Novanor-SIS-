const RH_DOCS_VENC_KEY = 'sis_rh_docs_vencimento';
const RH_DOCS_VENC_PING_KEY = 'sis_rh_docs_vencimento_ping';
const RH_DOCS_VENC_DB_NAME = 'novanor_sis_rh_docs_db';
const RH_DOCS_VENC_STORE = 'docs_vencimento';

function notifyDocsVencimentoUpdated() {
  try {
    localStorage.setItem(RH_DOCS_VENC_PING_KEY, String(Date.now()));
  } catch {}
  window.dispatchEvent(new Event('sis_rh_docs_vencimento_updated'));
}

function openDocsVencimentoDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('O browser não suporta armazenamento local avançado para documentos.'));
      return;
    }
    const request = window.indexedDB.open(RH_DOCS_VENC_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RH_DOCS_VENC_STORE)) {
        db.createObjectStore(RH_DOCS_VENC_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Não foi possível abrir a base local de RH.'));
  });
}

function normalizeDocVencimento(doc = {}) {
  return {
    id: doc.id || `docv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    colaboradorId: String(doc.colaboradorId || '').trim(),
    competencia: String(doc.competencia || '').slice(0, 7),
    titulo: String(doc.titulo || doc.nome || 'Documento de vencimento').trim(),
    nome: String(doc.nome || 'documento.pdf').trim(),
    mimeType: String(doc.mimeType || 'application/octet-stream'),
    base64: doc.base64 || '',
    dataUpload: doc.dataUpload || new Date().toISOString(),
  };
}

async function migrateLegacyDocsIfNeeded() {
  const legacyRaw = localStorage.getItem(RH_DOCS_VENC_KEY);
  if (!legacyRaw) return;
  try {
    const parsed = JSON.parse(legacyRaw || '{}');
    const legacyDocs = Object.entries(parsed || {}).flatMap(([colaboradorId, docs]) =>
      (Array.isArray(docs) ? docs : []).map(doc => normalizeDocVencimento({ ...doc, colaboradorId })),
    );
    if (legacyDocs.length > 0) {
      const db = await openDocsVencimentoDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(RH_DOCS_VENC_STORE, 'readwrite');
        const store = tx.objectStore(RH_DOCS_VENC_STORE);
        legacyDocs.forEach(doc => store.put(doc));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('Falha ao migrar documentos antigos.'));
        tx.onabort = () => reject(tx.error || new Error('Migração de documentos cancelada.'));
      });
      db.close();
    }
    localStorage.removeItem(RH_DOCS_VENC_KEY);
  } catch {}
}

export async function loadDocsVencimento() {
  try {
    await migrateLegacyDocsIfNeeded();
    const db = await openDocsVencimentoDb();
    const items = await new Promise((resolve, reject) => {
      const tx = db.transaction(RH_DOCS_VENC_STORE, 'readonly');
      const store = tx.objectStore(RH_DOCS_VENC_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error('Falha ao ler documentos de vencimento.'));
    });
    db.close();
    return Array.isArray(items)
      ? items
          .map(normalizeDocVencimento)
          .filter(doc => doc.colaboradorId && doc.competencia)
          .sort((a, b) => `${b.competencia}${b.dataUpload}`.localeCompare(`${a.competencia}${a.dataUpload}`))
      : [];
  } catch {
    return [];
  }
}

export async function addDocVencimento(doc) {
  const normalized = normalizeDocVencimento(doc);
  const db = await openDocsVencimentoDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(RH_DOCS_VENC_STORE, 'readwrite');
    const store = tx.objectStore(RH_DOCS_VENC_STORE);
    store.put(normalized);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Falha ao guardar documento.'));
    tx.onabort = () => reject(tx.error || new Error('Operação cancelada ao guardar documento.'));
  });
  db.close();
  notifyDocsVencimentoUpdated();
  return normalized;
}

export async function removeDocVencimento(docId) {
  const db = await openDocsVencimentoDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(RH_DOCS_VENC_STORE, 'readwrite');
    const store = tx.objectStore(RH_DOCS_VENC_STORE);
    store.delete(docId);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Falha ao remover documento.'));
    tx.onabort = () => reject(tx.error || new Error('Operação cancelada ao remover documento.'));
  });
  db.close();
  notifyDocsVencimentoUpdated();
}

export function canAccessVencDocs(user, colaboradorId) {
  if (!user) return false;
  const perfis = loadPerfis();
  const colaborador = perfis.find(p => p.id === colaboradorId);
  if (!colaborador) return false;
  return canAccessCollaboratorProfile(user, colaborador, perfis);
}

export function formatCompetencia(competencia) {
  if (!competencia) return '—';
  const [ano, mes] = String(competencia).split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const idx = Number(mes) - 1;
  return idx >= 0 && idx < 12 ? `${meses[idx]} ${ano}` : competencia;
}

export function downloadStoredFile(doc) {
  if (!doc?.base64) return;
  const a = document.createElement('a');
  a.href = doc.base64;
  a.download = doc.nome || 'documento.pdf';
  a.click();
}

export { RH_DOCS_VENC_PING_KEY };
import { canAccessCollaboratorProfile, loadPerfis } from '../context/PermissionsConfig';
