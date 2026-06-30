// Função auxiliar «adminOnly».
﻿module.exports = (req, res, next) => {
  if (req.userRole === 'Funcionario' && req.userEmployeeRole === 'Admin') {
    return next();
  }

  return res.status(403).json({ message: 'Acesso restrito a administradores.' });
};
