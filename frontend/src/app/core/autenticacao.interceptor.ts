import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ServicoAutenticacao } from './autenticacao.service';

export const intercetorAutenticacao: HttpInterceptorFn = (req, next) => {
  const auth = inject(ServicoAutenticacao);
  const router = inject(Router);
  const token = auth.getToken();
  const authenticatedRequest = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authenticatedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      const hadSession = auth.isAuthenticated();

      if (error.status === 401 && hadSession) {
        auth.logout();
        router.navigate(['/login'], {
          queryParams: { sessionExpired: 'true' }
        });
      }

      return throwError(() => error);
    })
  );
};
