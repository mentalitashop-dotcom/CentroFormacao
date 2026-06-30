import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, forkJoin, interval, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ApiService } from '../../../core/api.service';
import { ServicoAutenticacao } from '../../../core/autenticacao.service';
import { resolveApiAsset } from '../../../core/configuracao-api';

type ClientStatusFilter = 'todos' | 'ativos' | 'inativos';
type ClientProfileFilter = 'todos' | 'com-dados' | 'sem-dados';
type ClientSortFilter = 'nameAsc' | 'nameDesc' | 'createdDesc' | 'createdAsc';
type PaginationItem = number | 'ellipsis';

@Component({
  selector: 'app-funcionario-alunos-tabela',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './funcionario-alunos-tabela.component.html',
  styleUrl: './funcionario-alunos-tabela.component.scss'
})
export class FuncionarioAlunosTabelaComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(ServicoAutenticacao);
  private refreshSubscription = new Subscription();

  clients: any[] = [];
  readonly clientsPerPage = 6;
  clientPage = 1;
  searchTerm = '';
  statusFilter: ClientStatusFilter = 'todos';
  profileFilter: ClientProfileFilter = 'todos';
  sortFilter: ClientSortFilter = 'nameAsc';
  message = '';
  error = '';
  hasSearched = false;
  uploadingFileFor = '';
  athleteModalOpen = false;
  modalError = '';
  creatingAthlete = false;
  plans: any[] = [];
  athleteForm = this.emptyAthleteForm();

  // Verifica admin.
  get isAdmin(): boolean {
    return this.auth.isFuncionarioAdmin();
  }

  // Verifica ativos filtros.
  get hasActiveFilters(): boolean {
    return !!this.searchTerm.trim() ||
      this.statusFilter !== 'todos' ||
      this.profileFilter !== 'todos' ||
      this.sortFilter !== 'nameAsc';
  }

  // Função auxiliar «filteredClients».
  get filteredClients(): any[] {
    const search = this.searchTerm.trim().toLowerCase();

    return this.clients.filter((client) => {
      const userData = client.userData || {};
      const matchesSearch = !search || [
        client.email,
        userData.phone,
        userData.taxpayerNumber
      ].some((value) => String(value || '').toLowerCase().includes(search));

      const matchesStatus =
        this.statusFilter === 'todos' ||
        (this.statusFilter === 'ativos' && client.ativo) ||
        (this.statusFilter === 'inativos' && !client.ativo);

      const hasUserData = !!(userData.name || userData.phone || userData.address);
      const matchesProfile =
        this.profileFilter === 'todos' ||
        (this.profileFilter === 'com-dados' && hasUserData) ||
        (this.profileFilter === 'sem-dados' && !hasUserData);

      return matchesSearch && matchesStatus && matchesProfile;
    }).sort((a, b) => this.sortClients(a, b));
  }

  // Função auxiliar «totalClientPages».
  get totalClientPages(): number {
    return Math.max(Math.ceil(this.filteredClients.length / this.clientsPerPage), 1);
  }

  // Cria a lista de páginas disponíveis.
  get pageNumbers(): PaginationItem[] {
    return this.buildPageNumbers(this.clientPage, this.totalClientPages);
  }

  // Função auxiliar «paginatedClients».
  get paginatedClients(): any[] {
    if (this.clientPage > this.totalClientPages) {
      this.clientPage = this.totalClientPages;
    }

    const start = (this.clientPage - 1) * this.clientsPerPage;
    return this.filteredClients.slice(start, start + this.clientsPerPage);
  }

  // Função auxiliar «clientEmptyRows».
  get clientEmptyRows(): undefined[] {
    if (this.filteredClients.length === 0) return [];
    return Array.from({ length: Math.max(this.clientsPerPage - this.paginatedClients.length, 0) });
  }

  // Carrega os dados iniciais do componente.
  ngOnInit(): void {
    this.loadClients(false);
    this.loadPlans();
    this.refreshSubscription = interval(10000).subscribe(() => this.loadClients(false));
  }

  // Liberta subscrições e recursos utilizados pelo componente.
  ngOnDestroy(): void {
    this.refreshSubscription.unsubscribe();
  }

  // Carrega atletas.
  loadClients(showError = true): void {
    const search = this.searchTerm.trim();
    if (search && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(search) && !/^\d{9}$/.test(search)) {
      this.clients = [];
      this.hasSearched = true;
      this.error = 'Introduz um email válido ou 9 dígitos de telefone/NIF.';
      return;
    }
    if (showError) this.error = '';

    const query = search ? `&search=${encodeURIComponent(search)}` : '';
    this.api.get<any[]>(`/users/load?role=Atleta${query}`).subscribe({
      next: (data) => {
        this.hasSearched = true;
        this.clients = (data || [])
          .filter((item) => item.role === 'Atleta')
          .sort((a, b) => String(this.getUserName(a)).localeCompare(String(this.getUserName(b)), 'pt-PT'));
      },
      error: (err) => {
        if (showError) this.error = err?.error?.message || 'Erro ao carregar atletas.';
      }
    });
  }

  // Alterna utilizador ativos.
  toggleUserActive(client: any): void {
    this.message = '';
    this.error = '';

    this.api.patch<any>(`/users/update-status/${client._id}`, {}).subscribe({
      next: (res) => {
        this.message = res.message;
        this.loadClients();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erro ao alterar estado do atleta.';
      }
    });
  }

  // Remove utilizador.
  removeUser(client: any): void {
    if (client.ativo) {
      this.error = 'Só podes remover atletas inativos.';
      return;
    }

    const confirmed = confirm(`Queres remover definitivamente o atleta "${this.getUserName(client)}"?`);
    if (!confirmed) return;

    this.message = '';
    this.error = '';

    this.api.delete<any>(`/users/remove/${client._id}`).subscribe({
      next: (res) => {
        this.message = res.message;
        this.loadClients();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erro ao remover atleta.';
      }
    });
  }

  // Função auxiliar «onFilterChange».
  onFilterChange(): void {
    this.clientPage = 1;
  }

  // Função auxiliar «searchClients».
  searchClients(): void {
    this.clientPage = 1;
    this.loadClients();
  }

  // Limpa filtros.
  clearFilters(): void {
    this.searchTerm = '';
    this.statusFilter = 'todos';
    this.profileFilter = 'todos';
    this.sortFilter = 'nameAsc';
    this.clientPage = 1;
    this.loadClients(false);
  }

  // Navega para a página selecionada.
  goToPage(page: PaginationItem): void {
    if (page === 'ellipsis') return;
    this.clientPage = Math.min(Math.max(page, 1), this.totalClientPages);
  }

  // Obtém utilizador name.
  getUserName(user: any): string {
    return user?.userData?.name || user?.username || 'Utilizador';
  }

  // Obtém utilizador initials.
  getUserInitials(user: any): string {
    const name = this.getUserName(user).trim();
    const parts = name.split(/\s+/).filter(Boolean);

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  // Ordena atletas.
  private sortClients(a: any, b: any): number {
    if (this.sortFilter === 'createdDesc') {
      return this.withClientTieBreakers(new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(), a, b);
    }

    if (this.sortFilter === 'createdAsc') {
      return this.withClientTieBreakers(new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(), a, b);
    }

    const direction = this.sortFilter === 'nameDesc' ? -1 : 1;
    return this.withClientTieBreakers(
      String(this.getUserName(a)).localeCompare(String(this.getUserName(b)), 'pt-PT') * direction,
      a,
      b
    );
  }

  // Função auxiliar «withClientTieBreakers».
  private withClientTieBreakers(primary: number, a: any, b: any): number {
    if (primary !== 0) return primary;

    const activeCompare = Number(b.ativo) - Number(a.ativo);
    if (activeCompare !== 0) return activeCompare;

    return String(a.email || '').localeCompare(String(b.email || ''), 'pt-PT');
  }



  // Abre formulário de novo atleta.
  openCreateAthleteModal(): void {
    this.message = '';
    this.error = '';
    this.modalError = '';
    this.athleteForm = this.emptyAthleteForm();
    this.athleteModalOpen = true;
    this.loadPlans();
  }

  // Fecha formulário de novo atleta.
  closeCreateAthleteModal(): void {
    this.athleteModalOpen = false;
    this.modalError = '';
    this.creatingAthlete = false;
    this.athleteForm = this.emptyAthleteForm();
  }

  // Cria atleta/aluno e associa logo a um escalão.
  createAthlete(): void {
    this.message = '';
    this.error = '';
    this.modalError = '';

    const selectedPlanId = String(this.athleteForm.planId || '').trim();
    const payload = {
      name: this.athleteForm.name.trim(),
      email: this.athleteForm.email.trim(),
      phone: this.athleteForm.phone.trim(),
      taxpayerNumber: this.athleteForm.taxpayerNumber.trim(),
      birthDate: this.athleteForm.birthDate,
      street: this.athleteForm.street.trim(),
      doorNumber: this.athleteForm.doorNumber.trim(),
      postalCode: this.athleteForm.postalCode.trim(),
      city: this.athleteForm.city.trim(),
      emergencyContactName: this.athleteForm.emergencyContactName.trim(),
      emergencyContactPhone: this.athleteForm.emergencyContactPhone.trim(),
      planId: selectedPlanId
    };

    if (!payload.name || !payload.email || !payload.phone || !payload.street || !payload.doorNumber || !payload.postalCode || !payload.city || !selectedPlanId) {
      this.modalError = 'Preenche os dados obrigatórios do atleta e escolhe o escalão.';
      return;
    }

    this.creatingAthlete = true;
    this.api.post<any>('/users/create-athlete', payload).pipe(
      switchMap((res) => {
        const athleteId = res.athlete?._id || res.athlete?.id;
        const uploadRequests = this.buildFileUploadRequests(athleteId);
        if (!uploadRequests.length) {
          return of(res);
        }
        return forkJoin(uploadRequests).pipe(map(() => res));
      })
    ).subscribe({
      next: (res) => {
        this.message = res.message || 'Atleta criado e inscrito com sucesso.';
        this.athleteModalOpen = false;
        this.creatingAthlete = false;
        this.athleteForm = this.emptyAthleteForm();
        this.searchTerm = '';
        this.loadClients(false);
        this.loadPlans();
      },
      error: (err) => {
        this.creatingAthlete = false;
        this.modalError = err?.error?.message || 'Erro ao criar atleta e inscrição.';
      }
    });
  }

  // Valores iniciais do formulário do atleta.
  private emptyAthleteForm(): any {
    return {
      name: '',
      email: '',
      phone: '',
      taxpayerNumber: '',
      birthDate: '',
      street: '',
      doorNumber: '',
      postalCode: '',
      city: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      planId: '',
      athletePhotoFile: null,
      healthCertificateFile: null
    };
  }

  // Carrega planos/escalões disponíveis.
  loadPlans(): void {
    this.api.get<any>('/enrolment-plans/load?includeInactive=false&limit=500').subscribe({
      next: (res) => this.plans = res?.plans || [],
      error: () => this.plans = []
    });
  }

  // Formata valor monetário.
  formatPrice(priceCents: number): string {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format((priceCents || 0) / 100);
  }

  // Guarda a fotografia escolhida no formulário.
  selectAthletePhotoForForm(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (file && !file.type.startsWith('image/')) {
      this.modalError = 'Seleciona uma imagem para a fotografia do atleta.';
      input.value = '';
      this.athleteForm.athletePhotoFile = null;
      return;
    }
    this.modalError = '';
    this.athleteForm.athletePhotoFile = file;
  }

  // Guarda o certificado escolhido no formulário.
  selectHealthCertificateForForm(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (file && !allowedTypes.includes(file.type)) {
      this.modalError = 'O certificado deve ser PDF ou imagem.';
      input.value = '';
      this.athleteForm.healthCertificateFile = null;
      return;
    }
    this.modalError = '';
    this.athleteForm.healthCertificateFile = file;
  }

  // Cria os pedidos de upload escolhidos no formulário.
  private buildFileUploadRequests(athleteId: string): Observable<any>[] {
    const requests: Observable<any>[] = [];

    if (this.athleteForm.athletePhotoFile) {
      const formData = new FormData();
      formData.append('image', this.athleteForm.athletePhotoFile);
      requests.push(this.api.post<any>('/images/create', formData).pipe(
        switchMap((res) => this.api.put<any>(`/users/update-athlete-files/${athleteId}`, { athletePhotoUrl: res.imageUrl }))
      ));
    }

    if (this.athleteForm.healthCertificateFile) {
      const formData = new FormData();
      formData.append('document', this.athleteForm.healthCertificateFile);
      formData.append('documentType', 'certificado_saude');
      requests.push(this.api.post<any>('/documents/create', formData).pipe(
        switchMap((res) => this.api.put<any>(`/users/update-athlete-files/${athleteId}`, {
          healthCertificateUrl: res.documentUrl,
          healthCertificateName: res.originalName,
          healthCertificateMimeType: res.mimeType
        }))
      ));
    }

    return requests;
  }
  // Envia fotografia do atleta.
  uploadAthletePhoto(event: Event, athlete: any): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.error = 'Seleciona uma imagem para a fotografia do atleta.';
      input.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('image', file);
    this.uploadingFileFor = `${athlete._id}-photo`;
    this.error = '';
    this.message = '';

    this.api.post<any>('/images/create', formData).subscribe({
      next: (res) => this.updateAthleteFiles(athlete, { athletePhotoUrl: res.imageUrl }, input),
      error: (err) => {
        this.uploadingFileFor = '';
        input.value = '';
        this.error = err?.error?.message || 'Erro ao guardar fotografia do atleta.';
      }
    });
  }

  // Envia certificado de saúde do atleta.
  uploadHealthCertificate(event: Event, athlete: any): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.error = 'O certificado deve ser PDF ou imagem.';
      input.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('document', file);
    formData.append('documentType', 'certificado_saude');
    this.uploadingFileFor = `${athlete._id}-certificate`;
    this.error = '';
    this.message = '';

    this.api.post<any>('/documents/create', formData).subscribe({
      next: (res) => this.updateAthleteFiles(athlete, {
        healthCertificateUrl: res.documentUrl,
        healthCertificateName: res.originalName,
        healthCertificateMimeType: res.mimeType
      }, input),
      error: (err) => {
        this.uploadingFileFor = '';
        input.value = '';
        this.error = err?.error?.message || 'Erro ao guardar certificado de saúde.';
      }
    });
  }

  // Associa ficheiros enviados ao atleta.
  private updateAthleteFiles(athlete: any, payload: any, input: HTMLInputElement): void {
    this.api.put<any>(`/users/update-athlete-files/${athlete._id}`, payload).subscribe({
      next: (res) => {
        athlete.userData = res.userData;
        this.message = 'Ficheiros do atleta atualizados com sucesso.';
        this.uploadingFileFor = '';
        input.value = '';
      },
      error: (err) => {
        this.uploadingFileFor = '';
        input.value = '';
        this.error = err?.error?.message || 'Erro ao associar ficheiro ao atleta.';
      }
    });
  }

  // Abre o certificado de saúde do atleta.
  openHealthCertificate(athlete: any): void {
    const url = athlete?.userData?.healthCertificateUrl;
    if (!url) return;

    const token = this.auth.getToken();
    fetch(resolveApiAsset(url), { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((response) => {
        if (!response.ok) throw new Error('Erro ao abrir certificado.');
        return response.blob();
      })
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        window.open(objectUrl, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
      })
      .catch(() => this.error = 'Erro ao abrir certificado de saúde.');
  }

  // Resolve fotografia guardada na API.
  resolveImageUrl(url: string): string {
    return resolveApiAsset(url || '');
  }

  // Obtém o nome do certificado.
  getHealthCertificateName(athlete: any): string {
    return athlete?.userData?.healthCertificateName || 'Certificado enviado';
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
