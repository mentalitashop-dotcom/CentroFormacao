import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ServicoAutenticacao {
  private userSubject = new BehaviorSubject<any>(this.readUserFromStorage());
  user$ = this.userSubject.asObservable();

  // Verifica se o armazenamento local está disponível.
  private hasStorage(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  // Lê o utilizador guardado localmente.
  private readUserFromStorage(): any {
    if (!this.hasStorage()) return null;

    const userStr = localStorage.getItem('user');
    if (!userStr) return null;

    try {
      return JSON.parse(userStr);
    } catch {
      localStorage.removeItem('user');
      return null;
    }
  }

  // Normaliza utilizador.
  private normalizeUser(user: any): any {
    const role = String(user?.role || '').replace(/\s+/g, '');
    const employeeRole = String(user?.employeeRole || '').trim();
    return { ...user, role, employeeRole };
  }

  // Guarda sessão.
  saveSession(token: string, user: any): void {
    if (!this.hasStorage()) return;

    const normalizedUser = this.normalizeUser(user);

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    localStorage.setItem('role', normalizedUser.role || '');
    localStorage.setItem('employeeRole', normalizedUser.employeeRole || '');
    localStorage.setItem('userId', normalizedUser?._id || normalizedUser?.id || '');
    this.userSubject.next(normalizedUser);
  }

  // Guarda token.
  saveToken(token: string): void {
    if (!this.hasStorage()) return;
    localStorage.setItem('token', token);
  }

  // Obtém token.
  getToken(): string {
    if (!this.hasStorage()) return '';
    return localStorage.getItem('token') || '';
  }

  // Obtém tipo de acesso.
  getRole(): string {
    if (!this.hasStorage()) return '';
    return String(localStorage.getItem('role') || '').replace(/\s+/g, '');
  }

  // Obtém funcionário tipo de acesso.
  getEmployeeRole(): string {
    if (!this.hasStorage()) return '';
    return String(localStorage.getItem('employeeRole') || '').trim();
  }

  // Obtém utilizador.
  getUser(): any {
    return this.userSubject.value || this.readUserFromStorage();
  }

  // Atualiza guardado utilizador.
  updateStoredUser(partial: any): void {
    if (!this.hasStorage()) return;

    const currentUser = this.getUser() || {};
    const updatedUser = this.normalizeUser({ ...currentUser, ...partial });

    localStorage.setItem('user', JSON.stringify(updatedUser));
    localStorage.setItem('role', updatedUser?.role || '');
    localStorage.setItem('employeeRole', updatedUser?.employeeRole || '');
    localStorage.setItem('userId', updatedUser?._id || updatedUser?.id || '');
    this.userSubject.next(updatedUser);
  }

  // Verifica se existe uma sessão autenticada.
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Verifica se o utilizador é funcionário.
  isFuncionario(): boolean {
    return this.getRole() === 'Funcionario';
  }

  // Verifica se o funcionário é administrador.
  isFuncionarioAdmin(): boolean {
    return this.getRole() === 'Funcionario' && this.getEmployeeRole() === 'Admin';
  }

  // Verifica se a configuracao inicial do clube ja foi concluida.
  isClubSetupComplete(): boolean {
    return this.getUser()?.clubSetupComplete !== false;
  }

  // Termina a sessão atual do utilizador.
  logout(): void {
    if (!this.hasStorage()) return;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    localStorage.removeItem('employeeRole');
    this.userSubject.next(null);
  }
}
