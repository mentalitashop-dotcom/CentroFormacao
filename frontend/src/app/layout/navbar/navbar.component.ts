import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ServicoAutenticacao } from '../../core/autenticacao.service';
import { ApiService } from '../../core/api.service';
import { resolveApiAsset } from '../../core/configuracao-api';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit, OnDestroy {
  private auth = inject(ServicoAutenticacao);
  private router = inject(Router);
  private api = inject(ApiService);

  menuOpen = false;
  user$ = this.auth.user$;
  clubSettings: any = { name: '', logoUrl: '' };
  // Função auxiliar «clubSettingsUpdated».
  private readonly clubSettingsUpdated = (event: Event) => {
    const settings = (event as CustomEvent).detail;
    if (settings) this.applyClubSettings(settings);
  };

  // Carrega os dados iniciais do componente.
  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('club-settings-updated', this.clubSettingsUpdated);
      const cachedSettings = localStorage.getItem('clubSettings');
      if (cachedSettings) {
        try { this.applyClubSettings(JSON.parse(cachedSettings)); } catch { localStorage.removeItem('clubSettings'); }
      }
    }
    this.api.get<any>('/club-settings/load').subscribe({
      next: (settings) => this.applyClubSettings(settings)
    });
  }

  // Liberta subscrições e recursos utilizados pelo componente.
  ngOnDestroy(): void {
    if (typeof window !== 'undefined') window.removeEventListener('club-settings-updated', this.clubSettingsUpdated);
  }

  // Aplica configurações do clube.
  private applyClubSettings(settings: any): void {
    this.clubSettings = {
      name: String(settings?.name || '').trim(),
      logoUrl: String(settings?.logoUrl || '').trim()
    };
    if (typeof localStorage !== 'undefined') localStorage.setItem('clubSettings', JSON.stringify(this.clubSettings));
  }

  // Alterna menu.
  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  // Fecha menu.
  closeMenu(): void {
    this.menuOpen = false;
  }

  // Verifica a rota atual.
  isCurrentRoute(path: string): boolean {
    return this.router.url.split('?')[0].split('#')[0] === path;
  }

  // Termina a sessão atual do utilizador.
  logout(): void {
    this.auth.logout();
    this.menuOpen = false;
    this.router.navigate(['/login']);
  }

  // Função auxiliar «resolveImageUrl».
  resolveImageUrl(url: string): string {
    if (!url) return '';
    return resolveApiAsset(url);
  }

}
