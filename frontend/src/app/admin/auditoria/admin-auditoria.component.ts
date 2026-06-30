import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-admin-auditoria',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-auditoria.component.html',
  styleUrl: './admin-auditoria.component.scss'
})
export class AdminAuditoriaComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private refreshSubscription = new Subscription();

  logs: any[] = [];
  search = '';
  entityType = '';
  actionFilter = '';
  sortFilter = 'dateDesc';
  page = 1;
  readonly itemsPerPage = 10;
  error = '';

  // Função auxiliar «filteredLogs».
  get filteredLogs(): any[] {
    const search = this.search.trim().toLowerCase();
    return this.logs.filter((log) => {
      const matchesType = !this.entityType || this.normalizeEntityType(log.entityType) === this.entityType;
      const matchesAction = !this.actionFilter || log.action === this.actionFilter;
      const matchesSearch = !search || [ log.actor?.username, log.actor?.email, log.action, log.entityType, log.entityName, log.entityId].some((value) => String(value || '').toLowerCase().includes(search));
      return matchesType && matchesAction && matchesSearch;
    }).sort((a, b) => this.sortLogs(a, b));
  }

  // Função auxiliar «actionOptions».
  get actionOptions(): string[] {
    return Array.from(new Set(this.logs.map((log) => String(log.action || '')).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-PT'));
  }

  // Verifica ativos filtros.
  get hasActiveFilters(): boolean {
    return !!this.search.trim() || !!this.entityType || !!this.actionFilter || this.sortFilter !== 'dateDesc';
  }

  // Calcula o número total de páginas.
  get totalPages(): number {
    return Math.max(Math.ceil(this.filteredLogs.length / this.itemsPerPage), 1);
  }

  // Cria a lista de páginas disponíveis.
  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  // Função auxiliar «paginatedLogs».
  get paginatedLogs(): any[] {
    if (this.page > this.totalPages) this.page = this.totalPages;
    const start = (this.page - 1) * this.itemsPerPage;
    return this.filteredLogs.slice(start, start + this.itemsPerPage);
  }

  // Carrega os dados iniciais do componente.
  ngOnInit(): void {
    this.loadLogs();
    this.refreshSubscription = interval(10000).subscribe(() => this.loadLogs(false));
  }

  // Liberta subscrições e recursos utilizados pelo componente.
  ngOnDestroy(): void {
    this.refreshSubscription.unsubscribe();
  }

  // Carrega logs.
  loadLogs(showError = true): void {
    if (showError) this.error = '';
    this.api.get<any[]>('/audit/load').subscribe({
      next: (logs) => this.logs = logs || [],
      error: (err) => {
        if (showError) this.error = err?.error?.message || 'Erro ao carregar auditoria.';
      }
    });
  }

  // Função auxiliar «onFilterChange».
  onFilterChange(): void {
    this.page = 1;
  }

  // Limpa filtros.
  clearFilters(): void {
    this.search = '';
    this.entityType = '';
    this.actionFilter = '';
    this.sortFilter = 'dateDesc';
    this.page = 1;
  }

  // Navega para a página selecionada.
  goToPage(page: number): void {
    this.page = Math.min(Math.max(page, 1), this.totalPages);
  }

  // Função auxiliar «describeDetails».
  describeDetails(log: any): string {
    if (this.normalizeEntityType(log.entityType) === 'Inscrição') {
      return `${log.details?.oldStatus || '-'} → ${log.details?.newStatus || '-'}`;
    }
    if (log.details?.current && log.details?.previous) {
      return 'Dados alterados';
    }
    return '';
  }

  // Mostra o tipo com a linguagem do clube.
  displayEntityType(type: string): string {
    return this.normalizeEntityType(type);
  }

  // Ordena logs.
  private sortLogs(a: any, b: any): number {
    if (this.sortFilter === 'dateAsc') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (this.sortFilter === 'userAsc' || this.sortFilter === 'userDesc') {
      const direction = this.sortFilter === 'userDesc' ? -1 : 1;
      return direction * String(a.actor?.username || '').localeCompare(String(b.actor?.username || ''), 'pt-PT');
    }
    if (this.sortFilter === 'typeAsc') return String(a.entityType || '').localeCompare(String(b.entityType || ''), 'pt-PT');
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }

  // Converte tipos antigos para a linguagem do clube.
  private normalizeEntityType(type: string): string {
    const map: Record<string, string> = {
      'Área de formação': 'Área de formação',
      Escalão: 'Escalão',
      'Plano de inscrição': 'Plano de inscrição',
      Inscrição: 'Inscrição'
    };
    return map[type] || type;
  }
}
