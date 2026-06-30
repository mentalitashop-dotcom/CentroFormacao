import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';
import { ApiService } from '../../../core/api.service';

type EnrolmentStatus = 'pendente' | 'validada' | 'em_acompanhamento' | 'concluida' | 'cancelada';
type EnrolmentStatusFilter = 'todos' | 'abertas' | EnrolmentStatus;
type EnrolmentSortFilter = 'clientAsc' | 'clientDesc' | 'createdDesc' | 'createdAsc' | 'totalDesc' | 'totalAsc';
type PaginationItem = number | 'ellipsis';

@Component({
  selector: 'app-funcionario-inscricoes-tabela',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './funcionario-inscricoes-tabela.component.html',
  styleUrl: './funcionario-inscricoes-tabela.component.scss'
})
export class FuncionarioInscricoesTabelaComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private refreshSubscription = new Subscription();
  private readonly openEnrolmentStatuses: EnrolmentStatus[] = ['pendente', 'validada', 'em_acompanhamento'];

  enrolments: any[] = [];
  readonly enrolmentsPerPage = 6;
  enrolmentPage = 1;
  searchTerm = '';
  statusFilter: EnrolmentStatusFilter = 'todos';
  sortFilter: EnrolmentSortFilter = 'clientAsc';
  message = '';
  error = '';
  modalError = '';
  selectedEnrolment: any = null;
  enrolmentModalOpen = false;
  athletesFound: any[] = [];
  plans: any[] = [];
  enrolmentForm = { athleteSearch: '', athleteId: '', planId: '' };

  readonly enrolmentStatuses: { value: EnrolmentStatus; label: string }[] = [
    { value: 'pendente', label: 'Pendente' },
    { value: 'validada', label: 'Validada' },
    { value: 'em_acompanhamento', label: 'Em acompanhamento' },
    { value: 'concluida', label: 'Concluída' },
    { value: 'cancelada', label: 'Cancelada' }
  ];

  @Input() set initialStatusFilter(value: EnrolmentStatusFilter | null) {
    if (!value) return;

    this.statusFilter = value;
    this.enrolmentPage = 1;
  }

  // Verifica ativos filtros.
  get hasActiveFilters(): boolean {
    return !!this.searchTerm.trim() ||
      this.statusFilter !== 'todos' ||
      this.sortFilter !== 'clientAsc';
  }

  // Função auxiliar «filteredEnrolments».
  get filteredEnrolments(): any[] {
    const search = this.searchTerm.trim().toLowerCase();

    return this.enrolments.filter((enrolment) => {
      const matchesStatus =
        this.statusFilter === 'todos' ||
        (this.statusFilter === 'abertas' && this.openEnrolmentStatuses.includes(enrolment.status)) ||
        enrolment.status === this.statusFilter;
      const matchesSearch = !search || [
        enrolment._id,
        enrolment.user?.username,
        enrolment.user?.email,
        enrolment.status,
        ...(enrolment.items || []).map((item: any) => item.planName)
      ].some((value) => String(value || '').toLowerCase().includes(search));

      return matchesStatus && matchesSearch;
    }).sort((a, b) => this.sortEnrolments(a, b));
  }

  // Função auxiliar «canceledCount».
  get canceledCount(): number {
    return this.enrolments.filter((enrolment) => enrolment.status === 'cancelada').length;
  }

  // Função auxiliar «totalEnrolmentPages».
  get totalEnrolmentPages(): number {
    return Math.max(Math.ceil(this.filteredEnrolments.length / this.enrolmentsPerPage), 1);
  }

  // Cria a lista de páginas disponíveis.
  get pageNumbers(): PaginationItem[] {
    return this.buildPageNumbers(this.enrolmentPage, this.totalEnrolmentPages);
  }

  // Função auxiliar «paginatedEnrolments».
  get paginatedEnrolments(): any[] {
    if (this.enrolmentPage > this.totalEnrolmentPages) {
      this.enrolmentPage = this.totalEnrolmentPages;
    }

    const start = (this.enrolmentPage - 1) * this.enrolmentsPerPage;
    return this.filteredEnrolments.slice(start, start + this.enrolmentsPerPage);
  }

  // Função auxiliar «enrolmentEmptyRows».
  get enrolmentEmptyRows(): undefined[] {
    if (this.filteredEnrolments.length === 0) return [];
    return Array.from({ length: Math.max(this.enrolmentsPerPage - this.paginatedEnrolments.length, 0) });
  }

  // Carrega os dados iniciais do componente.
  ngOnInit(): void {
    this.loadEnrolments();
    this.loadPlans();
    this.refreshSubscription = interval(10000).subscribe(() => this.loadEnrolments(false));
  }

  // Liberta subscrições e recursos utilizados pelo componente.
  ngOnDestroy(): void {
    this.refreshSubscription.unsubscribe();
  }

  // Carrega inscrições.
  loadEnrolments(showError = true): void {
    if (showError) this.error = '';

    this.api.get<any[]>('/enrolments/load').subscribe({
      next: (enrolments) => this.enrolments = enrolments || [],
      error: (err) => {
        if (showError) this.error = err?.error?.message || 'Erro ao carregar inscrições.';
      }
    });
  }


  // Carrega planos disponíveis para inscrição.
  loadPlans(): void {
    this.api.get<any>('/enrolment-plans/load?includeInactive=false&limit=500').subscribe({
      next: (res) => this.plans = res?.plans || [],
      error: () => this.plans = []
    });
  }

  // Abre formulário de inscrição.
  openCreateEnrolmentModal(): void {
    this.error = '';
    this.modalError = '';
    this.message = '';
    this.enrolmentForm = { athleteSearch: '', athleteId: '', planId: '' };
    this.athletesFound = [];
    this.enrolmentModalOpen = true;
    this.loadPlans();
    this.loadAthletesForEnrolment();
  }

  // Fecha formulário de inscrição.
  closeCreateEnrolmentModal(): void {
    this.enrolmentModalOpen = false;
    this.modalError = '';
  }

  // Carrega atletas para a inscrição.
  loadAthletesForEnrolment(search = ''): void {
    const query = search ? `&search=${encodeURIComponent(search)}` : '';
    this.api.get<any[]>(`/users/load?role=Atleta${query}`).subscribe({
      next: (data) => {
        this.athletesFound = data || [];
        this.enrolmentForm.athleteId = this.athletesFound[0]?._id || '';
        if (search && !this.athletesFound.length) this.modalError = 'Nenhum atleta encontrado com essa pesquisa.';
      },
      error: (err) => this.modalError = err?.error?.message || 'Erro ao carregar atletas.'
    });
  }

  // Pesquisa atleta para inscrição.
  searchAthleteForEnrolment(): void {
    const search = this.enrolmentForm.athleteSearch.trim();
    this.modalError = '';
    if (search && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(search) && !/^\d{9}$/.test(search)) {
      this.modalError = 'Pesquisa por email ou 9 dígitos de telefone/NIF.';
      return;
    }
    this.loadAthletesForEnrolment(search);
  }

  // Cria inscrição.
  createEnrolment(): void {
    this.message = '';
    this.error = '';
    this.modalError = '';
    if (!this.enrolmentForm.athleteId || !this.enrolmentForm.planId) {
      this.modalError = 'Seleciona o atleta e o escalão.';
      return;
    }

    this.api.post<any>('/enrolments/create', {
      athleteId: this.enrolmentForm.athleteId,
      planId: this.enrolmentForm.planId
    }).subscribe({
      next: (res) => {
        this.message = res.message;
        this.enrolmentModalOpen = false;
        this.loadEnrolments();
        this.loadPlans();
      },
      error: (err) => this.modalError = err?.error?.message || 'Erro ao criar inscrição.'
    });
  }
  // Atualiza estado da inscrição.
  updateEnrolmentStatus(enrolment: any, status: EnrolmentStatus): void {
    if (!enrolment || enrolment.status === status) return;

    this.message = '';
    this.error = '';

    this.api.patch<any>(`/enrolments/update-status/${enrolment._id}`, { status }).subscribe({
      next: (res) => {
        this.message = res.message;
        this.loadEnrolments();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erro ao atualizar inscrição.';
      }
    });
  }

  // Função auxiliar «availableStatuses».
  availableStatuses(enrolment: any): { value: EnrolmentStatus; label: string }[] {
    const transitions: Record<EnrolmentStatus, EnrolmentStatus[]> = {
      pendente: ['validada', 'cancelada'],
      validada: ['em_acompanhamento', 'cancelada'],
      em_acompanhamento: ['concluida', 'cancelada'],
      concluida: [],
      cancelada: []
    };
    return this.enrolmentStatuses.filter((item) => item.value === enrolment.status || transitions[enrolment.status as EnrolmentStatus]?.includes(item.value));
  }

  // Função auxiliar «showEnrolmentDetails».
  showEnrolmentDetails(enrolment: any): void {
    this.selectedEnrolment = enrolment;
  }

  // Fecha detalhes da inscrição.
  closeEnrolmentDetails(): void {
    this.selectedEnrolment = null;
  }

  // Função auxiliar «onFilterChange».
  onFilterChange(): void {
    this.enrolmentPage = 1;
  }

  // Limpa filtros.
  clearFilters(): void {
    this.searchTerm = '';
    this.statusFilter = 'todos';
    this.sortFilter = 'clientAsc';
    this.enrolmentPage = 1;
  }

  // Navega para a página selecionada.
  goToPage(page: PaginationItem): void {
    if (page === 'ellipsis') return;
    this.enrolmentPage = Math.min(Math.max(page, 1), this.totalEnrolmentPages);
  }

  // Formata preço.
  formatPrice(priceCents: number): string {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format((priceCents || 0) / 100);
  }

  // Obtém estado label.
  getStatusLabel(status: string): string {
    return this.enrolmentStatuses.find((item) => item.value === status)?.label || status;
  }

  // Obtém código da inscrição.
  getEnrolmentCode(enrolment: any): string {
    return String(enrolment?._id || '').slice(-8).toUpperCase();
  }

  // Ordena inscrições.
  private sortEnrolments(a: any, b: any): number {
    if (this.sortFilter === 'clientDesc') {
      return this.withEnrolmentTieBreakers(this.getEnrolmentClientName(b).localeCompare(this.getEnrolmentClientName(a), 'pt-PT'), a, b);
    }

    if (this.sortFilter === 'createdAsc') {
      return this.withEnrolmentTieBreakers(new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(), a, b);
    }

    if (this.sortFilter === 'createdDesc') {
      return this.withEnrolmentTieBreakers(new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(), a, b);
    }

    if (this.sortFilter === 'totalDesc') {
      return this.withEnrolmentTieBreakers(Number(b.totalCents || 0) - Number(a.totalCents || 0), a, b);
    }

    if (this.sortFilter === 'totalAsc') {
      return this.withEnrolmentTieBreakers(Number(a.totalCents || 0) - Number(b.totalCents || 0), a, b);
    }

    return this.withEnrolmentTieBreakers(this.getEnrolmentClientName(a).localeCompare(this.getEnrolmentClientName(b), 'pt-PT'), a, b);
  }

  // Obtém nome do atleta.
  private getEnrolmentClientName(enrolment: any): string {
    return enrolment?.user?.userData?.name || enrolment?.user?.username || enrolment?.user?.email || 'Atleta';
  }

  // Função auxiliar «withEnrolmentTieBreakers».
  private withEnrolmentTieBreakers(primary: number, a: any, b: any): number {
    if (primary !== 0) return primary;

    const statusCompare = String(a.status || '').localeCompare(String(b.status || ''), 'pt-PT');
    if (statusCompare !== 0) return statusCompare;

    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  }

  // Constrói os números das páginas.
  private buildPageNumbers(currentPage: number, totalPages: number): PaginationItem[] {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const visiblePages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
    if (currentPage <= 3) {
      visiblePages.add(2);
      visiblePages.add(3);
    }
    if (currentPage >= totalPages - 2) {
      visiblePages.add(totalPages - 1);
      visiblePages.add(totalPages - 2);
    }

    const pages = Array.from(visiblePages)
      .filter((page) => page >= 1 && page <= totalPages)
      .sort((a, b) => a - b);

    return pages.reduce<PaginationItem[]>((items, page, index) => {
      if (index > 0 && page - pages[index - 1] > 1) {
        items.push('ellipsis');
      }
      items.push(page);
      return items;
    }, []);
  }
}
