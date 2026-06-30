import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';
import { ApiService } from '../../../core/api.service';
import { ServicoAutenticacao } from '../../../core/autenticacao.service';
import { resolveApiAsset } from '../../../core/configuracao-api';

type PlanStatusFilter = 'todos' | 'ativos' | 'inativos';
type PlanVacancyFilter = 'todos' | 'baixo' | 'sem-vagas';
type PlanSortFilter = 'nameAsc' | 'nameDesc' | 'priceAsc' | 'priceDesc' | 'vacanciesAsc' | 'vacanciesDesc';
type PaginationItem = number | 'ellipsis';

interface PlanForm {
  code: string;
  name: string;
  description: string;
  detailsText: string;
  parentStructure: string;
  modalityStructure: string;
  feeEuros: number | null;
  vacancies: number | null;
  mainImageUrl: string;
  extraImageUrls: string[];
}

@Component({
  selector: 'app-funcionario-planos-inscricao-tabela',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './funcionario-planos-inscricao-tabela.component.html',
  styleUrl: './funcionario-planos-inscricao-tabela.component.scss'
})
export class FuncionarioPlanosInscricaoTabelaComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(ServicoAutenticacao);
  private refreshSubscription = new Subscription();

  structures: any[] = [];
  plans: any[] = [];
  editingPlanId = '';
  planModalOpen = false;
  uploadingImage = false;
  message = '';
  error = '';

  planForm: PlanForm = this.emptyPlanForm();
  planSearch = '';
  planStatusFilter: PlanStatusFilter = 'todos';
  planVacancyFilter: PlanVacancyFilter = 'todos';
  planStructureFilter = '';
  planSortFilter: PlanSortFilter = 'nameAsc';
  readonly plansPerPage = 6;
  planPage = 1;

  // Função auxiliar «activeStructures».
  get activeStructures(): any[] {
    return this.structures.filter((modalityStructure) => modalityStructure.active !== false);
  }

  // Função auxiliar «activeMainStructures».
  get activeMainStructures(): any[] {
    return this.activeStructures
      .filter((modalityStructure) => !modalityStructure.parent)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-PT'));
  }

  // Função auxiliar «activeSubstructures».
  get activeSubstructures(): any[] {
    return this.activeStructures
      .filter((modalityStructure) => !!modalityStructure.parent)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-PT'));
  }

  // Opções do dropdown: futebol seguida dos respetivos escalões.
  get orderedActiveStructures(): any[] {
    return this.activeMainStructures.flatMap((modalityStructure) => [
      modalityStructure,
      ...this.activeSubstructures.filter((submodalityStructure) =>
        String(submodalityStructure.parent?._id || submodalityStructure.parent || '') === String(modalityStructure._id)
      )
    ]);
  }

  @Input() set initialVacancyFilter(value: PlanVacancyFilter | null) {
    if (!value) return;

    this.planVacancyFilter = value;
    this.planPage = 1;
  }

  @Input() set initialStructureFilter(value: string | null) {
    if (value === null || value === undefined) return;
    this.planStructureFilter = value;
    this.planPage = 1;
  }

  // Função auxiliar «ageGroupOptions».
  get ageGroupOptions(): any[] {
    if (!this.planForm.parentStructure) {
      return [];
    }

    return this.activeSubstructures.filter((modalityStructure) =>
      String(modalityStructure.parent?._id || modalityStructure.parent || '') === String(this.planForm.parentStructure)
    );
  }

  // Verifica se a estrutura é um escalão.
  isAgeGroup(modalityStructure: any): boolean {
    return !!modalityStructure?.parent;
  }

  // Devolve os planos filtrados pela pesquisa.
  get filteredPlans(): any[] {
    const search = this.planSearch.trim().toLowerCase();

    return this.plans.filter((plan) => {
      const matchesSearch = !search || [
        plan.code,
        plan.name,
        plan.description,
        this.formatStructure(plan.modalityStructure)
      ].some((value) => String(value || '').toLowerCase().includes(search));

      const matchesStatus =
        this.planStatusFilter === 'todos' ||
        (this.planStatusFilter === 'ativos' && plan.active !== false) ||
        (this.planStatusFilter === 'inativos' && plan.active === false);

      const matchesVacancy =
        this.planVacancyFilter === 'todos' ||
        (this.planVacancyFilter === 'baixo' && Number(plan.vacancies || 0) <= 5) ||
        (this.planVacancyFilter === 'sem-vagas' && Number(plan.vacancies || 0) === 0);

      const matchesStructure = !this.planStructureFilter ||
        String(plan.modalityStructure?._id || plan.modalityStructure || '') === this.planStructureFilter ||
        String(plan.modalityStructure?.parent?._id || plan.modalityStructure?.parent || '') === this.planStructureFilter;

      return matchesSearch && matchesStatus && matchesVacancy && matchesStructure;
    }).sort((a, b) => this.sortPlans(a, b));
  }

  // Função auxiliar «totalPlanPages».
  get totalPlanPages(): number {
    return Math.max(Math.ceil(this.filteredPlans.length / this.plansPerPage), 1);
  }

  // Função auxiliar «planPageNumbers».
  get planPageNumbers(): PaginationItem[] {
    return this.buildPageNumbers(this.planPage, this.totalPlanPages);
  }

  // Função auxiliar «paginatedPlans».
  get paginatedPlans(): any[] {
    if (this.planPage > this.totalPlanPages) {
      this.planPage = this.totalPlanPages;
    }

    const start = (this.planPage - 1) * this.plansPerPage;
    return this.filteredPlans.slice(start, start + this.plansPerPage);
  }

  // Função auxiliar «planEmptyRows».
  get planEmptyRows(): undefined[] {
    if (this.filteredPlans.length === 0) return [];
    return Array.from({ length: Math.max(this.plansPerPage - this.paginatedPlans.length, 0) });
  }

  // Verifica filtros dos planos.
  get hasPlanFilters(): boolean {
    return !!this.planSearch.trim() ||
      this.planStatusFilter !== 'todos' ||
      this.planVacancyFilter !== 'todos' ||
      !!this.planStructureFilter ||
      this.planSortFilter !== 'nameAsc';
  }

  // Carrega os dados iniciais do componente.
  ngOnInit(): void {
    this.loadAll();
    this.refreshSubscription = interval(10000).subscribe(() => this.loadAll(false));
  }

  // Liberta subscrições e recursos utilizados pelo componente.
  ngOnDestroy(): void {
    this.refreshSubscription.unsubscribe();
  }

  // Carrega todas as.
  loadAll(showError = true): void {
    this.loadCategories(showError);
    this.loadPlans(showError);
  }

  // Carrega registos de futebol e escalões.
  loadCategories(showError = true): void {
    this.api.get<any[]>('/modalities/load?includeInactive=true').subscribe({
      next: (structures) => this.structures = structures || [],
      error: (err) => {
        if (showError) this.error = err?.error?.message || 'Erro ao carregar registos de futebol.';
      }
    });
  }

  // Carrega planos de inscrição.
  loadPlans(showError = true): void {
    this.api.get<any>('/enrolment-plans/load?includeInactive=true&limit=500').subscribe({
      next: (res) => this.plans = res?.plans || [],
      error: (err) => {
        if (showError) this.error = err?.error?.message || 'Erro ao carregar planos de inscrição.';
      }
    });
  }

  // Guarda plano de inscrição.
  savePlan(): void {
    this.message = '';
    this.error = '';

    const price = Number(this.planForm.feeEuros);
    const vacancies = Number(this.planForm.vacancies);
    const payload = {
      code: this.editingPlanId ? this.planForm.code.trim() : '',
      name: this.planForm.name.trim(),
      description: this.planForm.description.trim(),
      details: this.parseSpecifications(this.planForm.detailsText),
      modalityStructure: this.planForm.modalityStructure,
      feeCents: Math.round(price * 100),
      vacancies,
      mainImageUrl: this.planForm.mainImageUrl.trim(),
      extraImageUrls: this.planForm.extraImageUrls.map((url) => url.trim()).filter(Boolean)
    };

    if (!payload.name || !payload.description || !this.planForm.parentStructure || !payload.modalityStructure || !payload.mainImageUrl) {
      this.error = 'Preenche os campos obrigatórios do plano.';
      return;
    }

    if (this.editingPlanId && !/^\d{13}$/.test(payload.code)) {
      this.error = 'O Código deve ter exatamente 13 dígitos.';
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      this.error = 'A mensalidade deve ser maior do que zero.';
      return;
    }

    if (!Number.isInteger(vacancies) || vacancies < 0) {
      this.error = 'As vagas devem ser um número inteiro e não podem ser negativas.';
      return;
    }

    const request = this.editingPlanId
      ? this.api.put<any>(`/enrolment-plans/update/${this.editingPlanId}`, payload)
      : this.api.post<any>('/enrolment-plans/create', payload);

    request.subscribe({
      next: (res) => {
        this.message = res.message;
        this.cancelPlanEdit();
        this.planModalOpen = false;
        this.loadPlans();
      },
      error: (err) => this.error = err?.error?.message || 'Erro ao guardar plano.'
    });
  }

  // Função auxiliar «editPlan».
  editPlan(plan: any): void {
    const mainImage = (plan.images || []).find((image: any) => image.isMain);
    const extraImages = (plan.images || []).filter((image: any) => !image.isMain).map((image: any) => image.imageUrl);

    const selectedStructure = plan.modalityStructure || {};
    const parentStructure = selectedStructure.parent?._id || selectedStructure.parent || '';

    this.editingPlanId = plan._id;
    this.planForm = {
      code: plan.code || '',
      name: plan.name || '',
      description: plan.description || '',
      detailsText: this.formatSpecifications(plan.details),
      parentStructure: parentStructure || (selectedStructure._id || selectedStructure || ''),
      modalityStructure: parentStructure ? (selectedStructure._id || selectedStructure || '') : '',
      feeEuros: Number(plan.feeCents || 0) / 100,
      vacancies: plan.vacancies || 0,
      mainImageUrl: mainImage?.imageUrl || '',
      extraImageUrls: [extraImages[0] || '', extraImages[1] || '', extraImages[2] || '']
    };
    this.planModalOpen = true;
  }

  // Função auxiliar «cancelPlanEdit».
  cancelPlanEdit(): void {
    this.editingPlanId = '';
    this.planForm = this.emptyPlanForm();
  }

  // Abre janela para criar plano.
  openCreatePlanModal(): void {
    this.message = '';
    this.error = '';
    this.cancelPlanEdit();
    this.planModalOpen = true;
  }

  // Fecha janela do plano.
  closePlanModal(): void {
    this.planModalOpen = false;
    this.cancelPlanEdit();
  }

  // Altera disponibilidade do plano.
  changePlanAvailability(plan: any): void {
    const action = this.auth.isFuncionarioAdmin() ? 'remover definitivamente' : 'desativar';
    if (!confirm(`Queres ${action} o plano "${plan.name}"?`)) return;

    this.message = '';
    this.error = '';

    this.api.delete<any>(`/enrolment-plans/remove/${plan._id}`).subscribe({
      next: (res) => {
        this.message = res.message;
        this.loadPlans();
      },
      error: (err) => this.error = err?.error?.message || 'Erro ao atualizar o estado do plano.'
    });
  }

  // Verifica change availability.
  canChangeAvailability(plan: any): boolean {
    return this.auth.isFuncionarioAdmin() || plan.active !== false;
  }

  // Função auxiliar «availabilityAction».
  availabilityAction(): string {
    return this.auth.isFuncionarioAdmin() ? 'Remover' : 'Desativar';
  }

  // Função auxiliar «blockInvalidNumberInput».
  blockInvalidNumberInput(event: KeyboardEvent): void {
    if (['-', '+', 'e', 'E'].includes(event.key)) {
      event.preventDefault();
    }
  }

  // Função auxiliar «clampPlanNumbers».
  clampPlanNumbers(): void {
    const price = Number(this.planForm.feeEuros);
    const vacancies = Number(this.planForm.vacancies);

    if (this.planForm.feeEuros !== null && Number.isFinite(price) && price < 0) {
      this.planForm.feeEuros = 0.01;
    }

    if (this.planForm.vacancies !== null && Number.isFinite(vacancies) && vacancies < 0) {
      this.planForm.vacancies = 0;
    }
  }

  // Função auxiliar «uploadPlanImage».
  uploadPlanImage(event: Event, index: number | null): void {
    this.uploadImage(event, (imageUrl) => {
      if (index === null) {
        this.planForm.mainImageUrl = imageUrl;
      } else {
        this.planForm.extraImageUrls[index] = imageUrl;
      }

      this.persistPlanImages();
    });
  }

  // Remove a imagem do plano.
  removePlanImage(index: number | null): void {
    if (index === null) {
      if (!this.planForm.extraImageUrls.some(Boolean)) {
        this.error = 'O plano tem de manter uma imagem principal.';
        return;
      }
      const nextMain = this.planForm.extraImageUrls.find(Boolean) || '';
      this.planForm.mainImageUrl = nextMain;
      this.planForm.extraImageUrls = this.planForm.extraImageUrls.filter((url) => url !== nextMain);
      while (this.planForm.extraImageUrls.length < 3) this.planForm.extraImageUrls.push('');
    } else {
      this.planForm.extraImageUrls[index] = '';
    }
    this.persistPlanImages();
  }

  // Função auxiliar «uploadImage».
  uploadImage(event: Event, onDone: (imageUrl: string) => void): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.error = 'Seleciona um ficheiro de imagem.';
      input.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('image', file);
    this.uploadingImage = true;
    this.error = '';

    this.api.post<any>('/images/create', formData).subscribe({
      next: (res) => {
        onDone(res.imageUrl);
        this.uploadingImage = false;
        input.value = '';
      },
      error: (err) => {
        this.uploadingImage = false;
        this.error = err?.error?.message || 'Erro ao enviar imagem.';
        input.value = '';
      }
    });
  }

  // Função auxiliar «persistPlanImages».
  private persistPlanImages(): void {
    if (!this.editingPlanId) {
      this.message = 'Fotografia carregada. Cria o plano para a publicar.';
      return;
    }
    if (!this.planForm.mainImageUrl.trim()) return;

    this.api.put<any>(`/enrolment-plans/update-images/${this.editingPlanId}`, {
      mainImageUrl: this.planForm.mainImageUrl.trim(),
      extraImageUrls: this.planForm.extraImageUrls.map((url) => url.trim()).filter(Boolean)
    }).subscribe({
      next: (res) => {
        this.message = res.message;
        this.loadPlans(false);
      },
      error: (err) => this.error = err?.error?.message || 'Erro ao guardar fotografias do plano.'
    });
  }

  // Função auxiliar «onPlanFilterChange».
  onPlanFilterChange(): void {
    this.planPage = 1;
  }

  // Limpa filtros dos planos.
  clearPlanFilters(): void {
    this.planSearch = '';
    this.planStatusFilter = 'todos';
    this.planVacancyFilter = 'todos';
    this.planStructureFilter = '';
    this.planSortFilter = 'nameAsc';
    this.planPage = 1;
  }

  // Função auxiliar «onParentStructureChange».
  onParentStructureChange(): void {
    this.planForm.modalityStructure = '';
  }

  // Navega para a página do plano.
  goToPlanPage(page: PaginationItem): void {
    if (page === 'ellipsis') return;
    this.planPage = Math.min(Math.max(page, 1), this.totalPlanPages);
  }

  // Função auxiliar «resolveImageUrl».
  resolveImageUrl(url: string): string {
    if (!url) return '';
    return resolveApiAsset(url);
  }

  // Abre plano.
  openPlan(plan: any): void {
    this.editPlan(plan);
  }

  // Filtra por futebol ou escalão.
  filterByStructure(modalityStructure: any): void {
    this.planStructureFilter = String(modalityStructure?._id || modalityStructure || '');
    this.planPage = 1;
  }

  // Formata mensalidade.
  formatPrice(feeCents: number): string {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format((feeCents || 0) / 100);
  }

  // Formata futebol ou escalão.
  formatStructure(modalityStructure: any): string {
    if (!modalityStructure) {
      return 'Sem área';
    }

    return modalityStructure.parent?.name ? `${modalityStructure.parent.name} / ${modalityStructure.name}` : modalityStructure.name;
  }

  // Função auxiliar «emptyPlanForm».
  private emptyPlanForm(): PlanForm {
    return {
      code: '',
      name: '',
      description: '',
      detailsText: '',
      parentStructure: '',
      modalityStructure: '',
      feeEuros: null,
      vacancies: 0,
      mainImageUrl: '',
      extraImageUrls: ['', '', '']
    };
  }

  // Ordena planos.
  private sortPlans(a: any, b: any): number {
    if (this.planSortFilter === 'priceAsc') {
      return this.withPlanTieBreakers(Number(a.feeCents || 0) - Number(b.feeCents || 0), a, b);
    }

    if (this.planSortFilter === 'priceDesc') {
      return this.withPlanTieBreakers(Number(b.feeCents || 0) - Number(a.feeCents || 0), a, b);
    }

    if (this.planSortFilter === 'vacanciesAsc') {
      return this.withPlanTieBreakers(Number(a.vacancies || 0) - Number(b.vacancies || 0), a, b);
    }

    if (this.planSortFilter === 'vacanciesDesc') {
      return this.withPlanTieBreakers(Number(b.vacancies || 0) - Number(a.vacancies || 0), a, b);
    }

    const direction = this.planSortFilter === 'nameDesc' ? -1 : 1;
    return this.withPlanTieBreakers(
      String(a.name || '').localeCompare(String(b.name || ''), 'pt-PT') * direction,
      a,
      b
    );
  }

  // Função auxiliar «parseSpecifications».
  private parseSpecifications(value: string): Record<string, string> {
    return String(value || '').split(/\r?\n/).reduce<Record<string, string>>((result, line) => {
      const separator = line.indexOf(':');
      if (separator > 0) {
        const key = line.slice(0, separator).trim();
        const itemValue = line.slice(separator + 1).trim();
        if (key && itemValue) result[key] = itemValue;
      }
      return result;
    }, {});
  }

  // Formata details.
  private formatSpecifications(value: any): string {
    if (!value) return '';
    return Object.entries(value).map(([key, itemValue]) => `${key}: ${itemValue}`).join('\n');
  }

  // Função auxiliar «withPlanTieBreakers».
  private withPlanTieBreakers(primary: number, a: any, b: any): number {
    if (primary !== 0) return primary;

    const activeCompare = Number(b.active !== false) - Number(a.active !== false);
    if (activeCompare !== 0) return activeCompare;

    const modalityStructureCompare = this.formatStructure(a.modalityStructure).localeCompare(this.formatStructure(b.modalityStructure), 'pt-PT');
    if (modalityStructureCompare !== 0) return modalityStructureCompare;

    return String(a.code || '').localeCompare(String(b.code || ''), 'pt-PT');
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
