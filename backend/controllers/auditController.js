const AuditLog = require('../models/auditLog');
const listing = require('../utils/listing');

// Lista registos de auditoria.
exports.list = async (req, res) => {
  try {
    const entityType = String(req.query.entityType || '').trim();
    const actor = String(req.query.actor || '').trim();
    const filter = {};

    if (entityType) filter.entityType = entityType;
    if (actor) filter.actor = actor;

    let logs = await AuditLog.find(filter)
      .populate('actor', 'username email role employeeRole')
      .lean();

    const opts = listing.options(req.query, ['createdAt', 'action', 'entityType'], 'createdAt');
    logs = logs.filter((log) => listing.includesSearch([log.action, log.entityType, log.actor?.username, log.actor?.email], opts.search)).sort((a, b) => listing.compare(a, b, opts.sortBy, opts.sortDir));
    listing.respond(res, logs, opts.page, opts.limit);
  } catch (error) {
    console.error('Erro ao carregar audit:', error);
    res.status(500).json({ message: 'Erro ao carregar audit.' });
  }
};
