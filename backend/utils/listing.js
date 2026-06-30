// Função auxiliar «text».
function text(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-PT');
}

// Função auxiliar «includesSearch».
function includesSearch(values, search) {
  const term = text(search).trim();
  return !term || values.some((value) => text(value).includes(term));
}

// Função auxiliar «numberParam».
function numberParam(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

// Obtém as opções de paginação, pesquisa e ordenação.
function options(query = {}, allowedSorts = [], defaultSort = 'createdAt', defaultSortDir = 'desc') {
  const sortBy = allowedSorts.includes(query.sortBy) ? query.sortBy : defaultSort;
  return { search: String(query.search || '').trim(), sortBy, sortDir: query.sortDir ? (query.sortDir === 'asc' ? 1 : -1) : (defaultSortDir === 'asc' ? 1 : -1), page: numberParam(query.page, 1, 1, 100000), limit: numberParam(query.limit, 500, 1, 500)};
}

// Função auxiliar «compare».
function compare(a, b, sortBy, sortDir) {
  const left = a?.[sortBy];
  const right = b?.[sortBy];
  const leftNumber = left instanceof Date ? left.getTime() : typeof left === 'number' ? left : null;
  const rightNumber = right instanceof Date ? right.getTime() : typeof right === 'number' ? right : null;
  if (leftNumber !== null && rightNumber !== null) return (leftNumber - rightNumber) * sortDir;
  return String(left ?? '').localeCompare(String(right ?? ''), 'pt-PT', { sensitivity: 'base' }) * sortDir;
}

// Função auxiliar «respond».
function respond(res, items, page, limit) {
  const total = items.length;
  const start = (page - 1) * limit;
  res.set({'X-Total-Count': String(total),'X-Page': String(page),'X-Limit': String(limit),'X-Total-Pages': String(Math.max(Math.ceil(total / limit), 1))});
  res.json(items.slice(start, start + limit));
}

module.exports = { includesSearch, options, compare, respond };
