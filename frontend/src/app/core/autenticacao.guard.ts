import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ServicoAutenticacao } from './autenticacao.service';

export const protecaoPrivada: CanActivateFn = (_route, state) => {
  const auth = inject(ServicoAutenticacao);
  const router = inject(Router);

  if (auth.isAuthenticated() && auth.isFuncionario()) return true;
  if (auth.isAuthenticated() && !auth.isFuncionario()) auth.logout();

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url }
  });
};

export const protecaoPublica: CanActivateFn = () => {
  const auth = inject(ServicoAutenticacao);
  const router = inject(Router);

  if (!auth.isAuthenticated()) return true;
  if (auth.isFuncionarioAdmin() && !auth.isClubSetupComplete()) return router.createUrlTree(['/configurar-clube']);
  if (auth.isFuncionario()) return router.createUrlTree(['/dashboard']);

  auth.logout();
  return true;
};

export const protecaoFuncionario: CanActivateFn = (_route, state) => {
  const auth = inject(ServicoAutenticacao);
  const router = inject(Router);

  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  if (auth.isFuncionario()) {
    if (auth.isFuncionarioAdmin() && !auth.isClubSetupComplete() && state.url !== '/configurar-clube') {
      return router.createUrlTree(['/configurar-clube']);
    }
    return true;
  }

  auth.logout();
  return router.createUrlTree(['/login']);
};
