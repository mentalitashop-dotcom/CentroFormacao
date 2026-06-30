import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';
import { ApiService } from '../../../core/api.service';
import { ServicoAutenticacao } from '../../../core/autenticacao.service';

interface StructureForm {
  name: string;
  description: string;
  isAgeGroup: boolean;
  parent: string;
  active: boolean;
  imageUrl: string;
}

type StructureStatusFilter = 'todos' | 'ativas' | 'inativas';
type MainStructureSort = 'nameAsc' | 'nameDesc' | 'substructuresDesc' | 'substructuresAsc';
type AgeGroupSort = 'nameAsc' | 'nameDesc' | 'parentAsc' | 'plansDesc' | 'plansAsc';
type PaginationItem = number | 'ellipsis';

@Component({
  selector: 'app-funcionario-formacao-tabela',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './funcionario-formacao-tabela.component.html',
  styleUrl: './funcionario-formacao-tabela.component.scss'
})
export class FuncionarioFormacaoTabelaComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(ServicoAutenticacao);
  private refreshSubscription = new Subscription();

  structures: any[] = [];
  plans: any[] = [];
  editingStructureId = '';
  structureModalOpen = false;
  message = '';
  error = '';
  mainSearch = '';
  mainStatusFilter: StructureStatusFilter = 'todos';
  mainSort: MainStructureSort = 'nameAsc';
  mainPage = 1;
  subSearch = '';
  subParentFilter = '';
  subStatusFilter: StructureStatusFilter = 'todos';
  subSort: AgeGroupSort = 'nameAsc';
  subPage = 1;
  readonly itemsPerPage = 6;
  @Output() structureSelected = new EventEmitter<string>();

  structureForm: StructureForm = this.emptyStructureForm();

  // Devolve as áreas principais de formação.
  get mainStructures(): any[] {
    return this.structures.filter((structure) => !structure.parent);
  }

  // Devolve os escalões da área selecionada.
  get substructures(): any[] {
    return this.structures.filter((structure) => !!structure.parent);
  }

  // Função auxiliar «parentOptions».
  get parentOptions(): any[] {
    return this.mainStructures.filter((structure) => String(structure._id) !== String(this.editingStructureId));
  }

  // Função auxiliar «filteredMainStructures».
  get filteredMainStructures(): any[] {
    const search = this.mainSearch.trim().toLowerCase();

    return this.mainStructures
      .filter((structure) => {
        const matchesSearch = !search || [
          structure.name,
          structure.description
        ].some((value) => String(value || '').toLowerCase().includes(search));

        const matchesStatus =
          this.mainStatusFilter === 'todos' ||
          (this.mainStatusFilter === 'ativas' && structure.active !== false) ||
          (this.mainStatusFilter === 'inativas' && structure.active === false);

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => this.sortMainStructures(a, b));
  }

  // Função auxiliar «filteredSubstructures».
  get filteredSubstructures(): any[] {
    const search = this.subSearch.trim().toLowerCase();

    return this.substructures
      .filter((structure) => {
        const matchesSearch = !search || [
          structure.name,
          structure.description,
          structure.parent?.name
        ].some((value) => String(value || '').toLowerCase().includes(search));

        const matchesParent = !this.subParentFilter ||
          String(structure.parent?._id || structure.parent || '') === String(this.subParentFilter);

        const matchesStatus =
          this.subStatusFilter === 'todos' ||
          (this.subStatusFilter === 'ativas' && structure.active !== false) ||
          (this.subStatusFilter === 'inativas' && structure.active === false);

        return matchesSearch && matchesParent && matchesStatus;
      })
      .sort((a, b) => this.sortSubstructures(a, b));
  }

  // Função auxiliar «totalMainPages».
  get totalMainPages(): number {
    return Math.max(Math.ceil(this.filteredMainStructures.length / this.itemsPerPage), 1);
  }

  // Função auxiliar «totalSubPages».
  get totalSubPages(): number {
    return Math.max(Math.ceil(this.filteredSubstructures.length / this.itemsPerPage), 1);
  }

  // Função auxiliar «mainPageNumbers».
  get mainPageNumbers(): PaginationItem[] {
    return this.buildPageNumbers(this.mainPage, this.totalMainPages);
  }

  // Função auxiliar «subPageNumbers».
  get subPageNumbers(): PaginationItem[] {
    return this.buildPageNumbers(this.subPage, this.totalSubPages);
  }

  // Função auxiliar «paginatedMainStructures».
  get paginatedMainStructures(): any[] {
    if (this.mainPage > this.totalMainPages) {
      this.mainPage = this.totalMainPages;
    }

    const start = (this.mainPage - 1) * this.itemsPerPage;
    return this.filteredMainStructures.slice(start, start + this.itemsPerPage);
  }

  // Função auxiliar «mainEmptyRows».
  get mainEmptyRows(): undefined[] {
    if (this.filteredMainStructures.length === 0) return [];
    return Array.from({ length: Math.max(this.itemsPerPage - this.paginatedMainStructures.length, 0) });
  }

  // Função auxiliar «paginatedSubstructures».
  get paginatedSubstructures(): any[] {
    if (this.subPage > this.totalSubPages) {
      this.subPage = this.totalSubPages;
    }

    const start = (this.subPage - 1) * this.itemsPerPage;
    return this.filteredSubstructures.slice(start, start + this.itemsPerPage);
  }

  // Função auxiliar «subEmptyRows».
  get subEmptyRows(): undefined[] {
    if (this.filteredSubstructures.length === 0) return [];
    return Array.from({ length: Math.max(this.itemsPerPage - this.paginatedSubstructures.length, 0) });
  }

  // Verifica os filtros principais.
  get hasMainFilters(): boolean {
    return !!this.mainSearch.trim() ||
      this.mainStatusFilter !== 'todos' ||
      this.mainSort !== 'nameAsc';
  }

  // Verifica sub filtros.
  get hasSubFilters(): boolean {
    return !!this.subSearch.trim() ||
      !!this.subParentFilter ||
      this.subStatusFilter !== 'todos' ||
      this.subSort !== 'nameAsc';
  }

  // Carrega os dados iniciais do componente.
  ngOnInit(): void {
    this.loadData();
    this.refreshSubscription = interval(10000).subscribe(() => this.loadData(false));
  }

  // Liberta subscrições e recursos utilizados pelo componente.
  ngOnDestroy(): void {
    this.refreshSubscription.unsubscribe();
  }

  // Carrega registos de futebol e escalões.
  loadStructures(showError = true): void {
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

  // Carrega dados.
  loadData(showError = true): void {
    this.loadStructures(showError);
    this.loadPlans(showError);
  }

  // Guarda futebol ou escalão.
  saveStructure(): void {
    this.message = '';
    this.error = '';

    const payload = {
      name: this.structureForm.name.trim(),
      description: this.structureForm.description.trim(),
      parent: this.structureForm.isAgeGroup ? this.structureForm.parent : null,
      imageUrl: this.structureForm.imageUrl.trim()
    };

    if (!payload.name) {
      this.error = 'O nome da futebol ou escalão é obrigatório.';
      return;
    }

    if (this.structureForm.isAgeGroup && !payload.parent) {
      this.error = 'Seleciona a área principal do escalão.';
      return;
    }

    if (payload.parent && payload.parent === this.editingStructureId) {
      this.error = 'A área principal não pode ser o próprio escalão.';
      return;
    }

    const request = this.editingStructureId
      ? this.api.put<any>(`/modalities/update/${this.editingStructureId}`, payload)
      : this.api.post<any>('/modalities/create', payload);

    request.subscribe({
      next: (res) => {
        this.message = res.message;
        this.cancelStructureEdit();
        this.structureModalOpen = false;
        this.loadData();
      },
      error: (err) => this.error = err?.error?.message || 'Erro ao guardar futebol ou escalão.'
    });
  }

  // Função auxiliar «editStructure».
  editStructure(structure: any): void {
    const parentId = structure.parent?._id || structure.parent || '';

    this.editingStructureId = structure._id;
    this.structureForm = {
      name: structure.name || '',
      description: structure.description || '',
      isAgeGroup: !!parentId,
      parent: parentId,
      active: structure.active !== false
      , imageUrl: structure.imageUrl || ''
    };
    this.structureModalOpen = true;
  }

  // Função auxiliar «cancelStructureEdit».
  cancelStructureEdit(): void {
    this.editingStructureId = '';
    this.structureForm = this.emptyStructureForm();
  }

  // Abre janela para criar futebol ou escalão.
  openCreateStructureModal(): void {
    this.message = '';
    this.error = '';
    this.cancelStructureEdit();
    this.structureModalOpen = true;
  }

  // Fecha janela de futebol ou escalão.
  closeStructureModal(): void {
    this.structureModalOpen = false;
    this.cancelStructureEdit();
  }

  // Remove futebol ou escalão.
  removeStructure(structure: any): void {
    const substructures = structure.parent ? 0 : this.getSubstructureCount(structure);
    const structureIds = structure.parent
      ? [String(structure._id)]
      : [String(structure._id), ...this.substructures.filter((item) => String(item.parent?._id || item.parent) === String(structure._id)).map((item) => String(item._id))];
    const plans = this.plans.filter((item) => structureIds.includes(String(item.modalityStructure?._id || item.modalityStructure))).length;
    const action = this.auth.isFuncionarioAdmin() ? 'remover definitivamente' : 'desativar';
    if (!confirm(`Queres ${action} "${structure.name}"? Esta ação também afeta ${substructures} escalões e ${plans} planos de inscrição associados.`)) return;

    this.message = '';
    this.error = '';

    this.api.delete<any>(`/modalities/remove/${structure._id}`).subscribe({
      next: (res) => {
        this.message = res.message;
        this.loadData();
      },
      error: (err) => this.error = err?.error?.message || 'Erro ao remover futebol ou escalão.'
    });
  }

  // Função auxiliar «structureActionLabel».
  structureActionLabel(): string {
    return this.auth.isFuncionarioAdmin() ? 'Remover' : 'Desativar';
  }

  // Função auxiliar «setStructureType».
  setStructureType(isAgeGroup: boolean): void {
    this.structureForm.isAgeGroup = isAgeGroup;

    if (!isAgeGroup) {
      this.structureForm.parent = '';
    }
  }

  // Função auxiliar «onMainFilterChange».
  onMainFilterChange(): void {
    this.mainPage = 1;
  }

  // Função auxiliar «onSubFilterChange».
  onSubFilterChange(): void {
    this.subPage = 1;
  }

  // Limpa os filtros principais.
  clearMainFilters(): void {
    this.mainSearch = '';
    this.mainStatusFilter = 'todos';
    this.mainSort = 'nameAsc';
    this.mainPage = 1;
  }

  // Limpa sub filtros.
  clearSubFilters(): void {
    this.subSearch = '';
    this.subParentFilter = '';
    this.subStatusFilter = 'todos';
    this.subSort = 'nameAsc';
    this.subPage = 1;
  }

  // Navega para a página principal.
  goToMainPage(page: PaginationItem): void {
    if (page === 'ellipsis') return;
    this.mainPage = Math.min(Math.max(page, 1), this.totalMainPages);
  }

  // Navega para a página secundária.
  goToSubPage(page: PaginationItem): void {
    if (page === 'ellipsis') return;
    this.subPage = Math.min(Math.max(page, 1), this.totalSubPages);
  }

  // Obtém o tipo da estrutura.
  getStructureTypeLabel(structure: any): string {
    return structure?.parent ? 'Escalão' : 'Futebol';
  }

  // Obtém o número de escalões.
  getSubstructureCount(structure: any): number {
    return this.substructures.filter((item) => String(item.parent?._id || item.parent || '') === String(structure._id)).length;
  }

  // Obtém o número de planos.
  getPlanCount(structure: any): number {
    return this.plans.filter((plan) => String(plan.modalityStructure?._id || plan.modalityStructure || '') === String(structure._id)).length;
  }

  // Abre planos.
  openPlans(structure: any): void {
    this.structureSelected.emit(String(structure?._id || ''));
  }

  // Função auxiliar «uploadStructureImage».
  uploadStructureImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const data = new FormData();
    data.append('image', file);
    this.api.post<any>('/images/create', data).subscribe({
      next: (res) => this.structureForm.imageUrl = res.imageUrl,
      error: (err) => this.error = err?.error?.message || 'Erro ao enviar imagem.'
    });
  }

  // Função auxiliar «emptyStructureForm».
  private emptyStructureForm(): StructureForm {
    return {
      name: '',
      description: '',
      isAgeGroup: false,
      parent: '',
      active: true
      , imageUrl: ''
    };
  }

  // Ordena as áreas principais.
  private sortMainStructures(a: any, b: any): number {
    if (this.mainSort === 'substructuresDesc') {
      return this.withMainStructureTieBreakers(this.getSubstructureCount(b) - this.getSubstructureCount(a), a, b);
    }

    if (this.mainSort === 'substructuresAsc') {
      return this.withMainStructureTieBreakers(this.getSubstructureCount(a) - this.getSubstructureCount(b), a, b);
    }

    const direction = this.mainSort === 'nameDesc' ? -1 : 1;
    return this.withMainStructureTieBreakers(
      String(a.name || '').localeCompare(String(b.name || ''), 'pt-PT') * direction,
      a,
      b
    );
  }

  // Ordena escalões.
  private sortSubstructures(a: any, b: any): number {
    if (this.subSort === 'plansDesc') {
      return this.withSubstructureTieBreakers(this.getPlanCount(b) - this.getPlanCount(a), a, b);
    }

    if (this.subSort === 'plansAsc') {
      return this.withSubstructureTieBreakers(this.getPlanCount(a) - this.getPlanCount(b), a, b);
    }

    if (this.subSort === 'parentAsc') {
      const parentCompare = String(a.parent?.name || '').localeCompare(String(b.parent?.name || ''), 'pt-PT');
      if (parentCompare !== 0) return parentCompare;
    }

    const direction = this.subSort === 'nameDesc' ? -1 : 1;
    return this.withSubstructureTieBreakers(
      String(a.name || '').localeCompare(String(b.name || ''), 'pt-PT') * direction,
      a,
      b
    );
  }

  // Função auxiliar «withMainStructureTieBreakers».
  private withMainStructureTieBreakers(primary: number, a: any, b: any): number {
    if (primary !== 0) return primary;

    const activeCompare = Number(b.active !== false) - Number(a.active !== false);
    if (activeCompare !== 0) return activeCompare;

    const countCompare = this.getSubstructureCount(b) - this.getSubstructureCount(a);
    if (countCompare !== 0) return countCompare;

    return String(a.name || '').localeCompare(String(b.name || ''), 'pt-PT');
  }

  // Função auxiliar «withSubstructureTieBreakers».
  private withSubstructureTieBreakers(primary: number, a: any, b: any): number {
    if (primary !== 0) return primary;

    const activeCompare = Number(b.active !== false) - Number(a.active !== false);
    if (activeCompare !== 0) return activeCompare;

    const countCompare = this.getPlanCount(b) - this.getPlanCount(a);
    if (countCompare !== 0) return countCompare;

    return String(a.parent?.name || '').localeCompare(String(b.parent?.name || ''), 'pt-PT');
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
