const AuditLog = require('../models/auditLog');

// Função auxiliar «registerAudit».
async function registerAudit(req, action, entityType, entity, details = {}) {
  if (!req.userId || !entity) return;

  try {
    await AuditLog.create({
      actor: req.userId,
      action,
      entityType,
      entityId: String(entity._id || entity.id || ''),
      entityName: String(entity.name || entity.fullName || entity._id || ''),
      details
    });
  } catch (error) {
    console.error('Não foi possível registar auditoria:', error);
  }
}

module.exports = registerAudit;
