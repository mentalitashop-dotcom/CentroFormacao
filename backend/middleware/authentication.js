const jwt = require('jsonwebtoken');
const config = require('../jwtsecret/config');
const User = require('../models/user');

// Valida o token JWT e identifica o utilizador autenticado.
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: 'É necessário iniciar sessão.' });
  }

  try {
    const decoded = jwt.verify(token, config.secret);
    const user = await User.findById(decoded.id || decoded._id).select('role employeeRole ativo');
    if (!user || user.ativo === false) {
      return res.status(401).json({ message: 'O utilizador está inativo ou não existe.' });
    }

    req.user = decoded;
    req.userId = user._id;
    req.userRole = user.role;
    req.userEmployeeRole = user.employeeRole;
    next();
  } catch {
    return res.status(401).json({ message: 'A sessão é inválida ou expirou.' });
  }
}

// Cria uma proteção de rota limitada aos tipos de utilizador indicados.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ message: 'Não tens permissão para aceder a este recurso.' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
