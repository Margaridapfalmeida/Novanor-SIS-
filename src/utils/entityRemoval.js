export function loadRemovedIds(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveRemovedIds(key, ids) {
  localStorage.setItem(key, JSON.stringify([...(new Set((ids || []).filter(Boolean)))]));
}

export function markRemovedId(key, id) {
  if (!id) return;
  const current = new Set(loadRemovedIds(key));
  current.add(id);
  saveRemovedIds(key, [...current]);
}

export function unmarkRemovedId(key, id) {
  if (!id) return;
  saveRemovedIds(key, loadRemovedIds(key).filter((item) => item !== id));
}

export function isRemovedId(key, id) {
  return loadRemovedIds(key).includes(id);
}

export function filterRemovedById(list, key, getId = (item) => item?.id) {
  const removed = new Set(loadRemovedIds(key));
  return (list || []).filter((item) => !removed.has(getId(item)));
}
