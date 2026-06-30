import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Subscription, interval } from 'rxjs';
import { ApiService } from '../../../core/api.service';
import { ServicoAutenticacao } from '../../../core/autenticacao.service';

type EmployeeStatusFilter = 'todos' | 'ativos' | 'inativos';
type EmployeeValidationFilter = 'todos' | 'validados' | 'por-validar';
type EmployeeProfileFilter = 'todos' | 'com-dados' | 'sem-dados';
type EmployeeEditField = '' | 'username' | 'email';
type EmployeeSortFilter = 'nameAsc' | 'nameDesc' | 'createdDesc' | 'createdAsc' | 'numberAsc' | 'numberDesc';
type PaginationItem = number | 'ellipsis';

@Component({
  selector: 'app-admin-funcionarios-tabela',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-funcionarios-tabela.component.html',
  styleUrl: './admin-funcionarios-tabela.component.scss'
})
export class AdminFuncionariosTabelaComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(ServicoAutenticacao);
  private refreshSubscription = new Subscription();

  employees: any[] = [];
  readonly employeesPerPage = 6;
  employeePage = 1;
  searchTerm = '';
  statusFilter: EmployeeStatusFilter = 'todos';
  validationFilter: EmployeeValidationFilter = 'todos';
  profileFilter: EmployeeProfileFilter = 'todos';
  sortFilter: EmployeeSortFilter = 'nameAsc';

  createEmployeeModalOpen = false;
  selectedEmployee: any = null;
  editingEmployeeField: EmployeeEditField = '';
  message = '';
  error = '';
  createEmployeeError = '';

  employeeForm = {
    username: '',
    email: '',
    name: '',
    phone: '',
    jobTitle: 'Treinador'
  };

  editEmployeeForm = {
    username: '',
    email: '',
    name: '',
    phone: '',
    jobTitle: ''
  };

  // Função auxiliar «currentUserId».
  get currentUserId(): string {
    const currentUser = this.auth.getUser();
    return String(currentUser?._id || currentUser?.id || '');
  }

  // Verifica ativos filtros.
  get hasActiveFilters(): boolean {
    return !!this.searchTerm.trim() ||
      this.statusFilter !== 'todos' ||
      this.validationFilter !== 'todos' ||
      this.profileFilter !== 'todos' ||
      this.sortFilter !== 'nameAsc';
  }

  // Função auxiliar «filteredEmployees».
  get filteredEmployees(): any[] {
    const search = this.searchTerm.trim().toLowerCase();

    return this.employees.filter((item) => {
      const userData = item.userData || {};
      const matchesSearch = !search || [
        item.username,
        item.email,
        userData.name,
        userData.phone,
        userData.employeeNumber
      ].some((value) => String(value || '').toLowerCase().includes(search));

      const matchesStatus =
        this.statusFilter === 'todos' ||
        (this.statusFilter === 'ativos' && item.ativo) ||
        (this.statusFilter === 'inativos' && !item.ativo);

      const matchesValidation =
        this.validationFilter === 'todos' ||
        (this.validationFilter === 'validados' && item.validado) ||
        (this.validationFilter === 'por-validar' && !item.validado);

      const hasUserData = !!(userData.name || userData.phone || userData.employeeNumber || userData.jobTitle);
      const matchesProfile =
        this.profileFilter === 'todos' ||
        (this.profileFilter === 'com-dados' && hasUserData) ||
        (this.profileFilter === 'sem-dados' && !hasUserData);

      return matchesSearch && matchesStatus && matchesValidation && matchesProfile;
    }).sort((a, b) => this.sortEmployees(a, b));
  }

  // Função auxiliar «totalEmployeePages».
  get totalEmployeePages(): number {
    return Math.max(Math.ceil(this.filteredEmployees.length / this.employeesPerPage), 1);
  }

  // Cria a lista de páginas disponíveis.
  get pageNumbers(): PaginationItem[] {
    return this.buildPageNumbers(this.employeePage, this.totalEmployeePages);
  }

  // Função auxiliar «paginatedEmployees».
  get paginatedEmployees(): any[] {
    if (this.employeePage > this.totalEmployeePages) {
      this.employeePage = this.totalEmployeePages;
    }

    const start = (this.employeePage - 1) * this.employeesPerPage;
    return this.filteredEmployees.slice(start, start + this.employeesPerPage);
  }

  // Função auxiliar «employeeEmptyRows».
  get employeeEmptyRows(): undefined[] {
    if (this.filteredEmployees.length === 0) return [];
    return Array.from({ length: Math.max(this.employeesPerPage - this.paginatedEmployees.length, 0) });
  }

  // Carrega os dados iniciais do componente.
  ngOnInit(): void {
    this.loadEmployees();
    this.refreshSubscription = interval(10000).subscribe(() => this.loadEmployees(false));
  }

  // Liberta subscrições e recursos utilizados pelo componente.
  ngOnDestroy(): void {
    this.refreshSubscription.unsubscribe();
  }

  // Carrega treinadores.
  loadEmployees(showError = true): void {
    if (showError) this.error = '';

    this.api.get<any[]>('/users/load?role=Funcionario').subscribe({
      next: (data) => {
        this.employees = (data || [])
          .filter((item) => item.role === 'Funcionario')
          .sort((a, b) => {
            const adminOrder = Number(b.employeeRole === 'Admin') - Number(a.employeeRole === 'Admin');
            if (adminOrder !== 0) return adminOrder;
            return String(this.getUserName(a)).localeCompare(String(this.getUserName(b)), 'pt-PT');
          });

        if (this.selectedEmployee) {
          const updatedSelected = this.employees.find((item) => String(item._id) === String(this.selectedEmployee._id));
          this.selectedEmployee = updatedSelected || null;
        }
      },
      error: (err) => {
        if (showError) this.error = err?.error?.message || 'Erro ao carregar treinadores.';
      }
    });
  }

  // Cria treinador.
  createEmployee(form?: NgForm): void {
    this.message = '';
    this.error = '';
    this.createEmployeeError = '';

    const payload = {
      username: this.employeeForm.username.trim(),
      email: this.employeeForm.email.trim().toLowerCase(),
      name: this.employeeForm.name.trim(),
      phone: this.employeeForm.phone.trim(),
      jobTitle: this.employeeForm.jobTitle.trim()
    };

    if (!payload.username || !payload.email || form?.invalid) {
      this.createEmployeeError = 'Preenche um nome de utilizador válido e um email válido.';
      return;
    }

    this.api.post<any>('/users/create-employee', payload).subscribe({
      next: (res) => {
        this.message = res.message;
        this.employeeForm = { username: '', email: '', name: '', phone: '', jobTitle: 'Treinador' };
        form?.resetForm(this.employeeForm);
        this.createEmployeeModalOpen = false;
        this.loadEmployees();
      },
      error: (err) => {
        this.createEmployeeError = err?.error?.message || 'Erro ao criar treinador.';
      }
    });
  }

  // Abre janela para criar treinador.
  openCreateEmployeeModal(): void {
    this.message = '';
    this.error = '';
    this.createEmployeeError = '';
    this.employeeForm = { username: '', email: '', name: '', phone: '', jobTitle: 'Treinador' };
    this.createEmployeeModalOpen = true;
  }

  // Fecha janela para criar treinador.
  closeCreateEmployeeModal(): void {
    this.createEmployeeModalOpen = false;
    this.employeeForm = { username: '', email: '', name: '', phone: '', jobTitle: 'Treinador' };
    this.createEmployeeError = '';
  }

  // Alterna utilizador ativos.
  toggleUserActive(user: any): void {
    if (this.isCurrentUser(user)) {
      this.error = 'Não podes alterar o estado da tua própria conta.';
      return;
    }

    this.message = '';
    this.error = '';

    this.api.patch<any>(`/users/update-status/${user._id}`, {}).subscribe({
      next: (res) => {
        this.message = res.message;
        this.loadEmployees();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erro ao alterar estado do utilizador.';
      }
    });
  }

  // Remove utilizador.
  removeUser(user: any): void {
    if (this.isCurrentUser(user)) {
      this.error = 'Não podes remover a tua própria conta.';
      return;
    }

    if (user.ativo) {
      this.error = 'Só podes remover utilizadores inativos.';
      return;
    }

    const confirmed = confirm(`Queres remover definitivamente o utilizador "${this.getUserName(user)}"?`);
    if (!confirmed) return;

    this.message = '';
    this.error = '';

    this.api.delete<any>(`/users/remove/${user._id}`).subscribe({
      next: (res) => {
        this.message = res.message;
        this.selectedEmployee = String(this.selectedEmployee?._id) === String(user._id) ? null : this.selectedEmployee;
        this.loadEmployees();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erro ao remover utilizador.';
      }
    });
  }

  // Função auxiliar «showEmployeeDetails».
  showEmployeeDetails(user: any): void {
    this.message = '';
    this.error = '';
    this.selectedEmployee = user;
    this.editingEmployeeField = '';
    this.editEmployeeForm = {
      username: user?.username || '',
      email: user?.email || '',
      name: user?.userData?.name || '',
      phone: user?.userData?.phone || '',
      jobTitle: user?.userData?.jobTitle || ''
    };
  }

  // Fecha janela do treinador.
  closeEmployeeModal(): void {
    this.selectedEmployee = null;
    this.editingEmployeeField = '';
  }

  // Função auxiliar «startEditEmployeeField».
  startEditEmployeeField(field: EmployeeEditField): void {
    if (!this.selectedEmployee || !field) return;

    this.editingEmployeeField = field;
    this.message = '';
    this.error = '';
    this.editEmployeeForm = {
      username: this.selectedEmployee.username || '',
      email: this.selectedEmployee.email || '',
      name: this.selectedEmployee.userData?.name || '',
      phone: this.selectedEmployee.userData?.phone || '',
      jobTitle: this.selectedEmployee.userData?.jobTitle || ''
    };
  }

  // Função auxiliar «cancelEditEmployee».
  cancelEditEmployee(): void {
    this.editingEmployeeField = '';
    this.editEmployeeForm = {
      username: this.selectedEmployee?.username || '',
      email: this.selectedEmployee?.email || '',
      name: this.selectedEmployee?.userData?.name || '',
      phone: this.selectedEmployee?.userData?.phone || '',
      jobTitle: this.selectedEmployee?.userData?.jobTitle || ''
    };
  }

  // Guarda conta do treinador.
  saveEmployeeAccount(): void {
    if (!this.selectedEmployee) return;

    const payload = {
      username: this.editEmployeeForm.username.trim(),
      email: this.editEmployeeForm.email.trim().toLowerCase(),
      name: this.editEmployeeForm.name.trim(),
      phone: this.editEmployeeForm.phone.trim(),
      jobTitle: this.editEmployeeForm.jobTitle.trim()
    };

    if (!payload.username || !payload.email) {
      this.error = 'Nome de utilizador e email são obrigatórios.';
      return;
    }

    this.message = '';
    this.error = '';

    this.api.put<any>(`/users/update-employee/${this.selectedEmployee._id}`, payload).subscribe({
      next: (res) => {
        this.message = res.message;
        const updatedEmployee = { ...this.selectedEmployee, ...res.employee };
        this.selectedEmployee = updatedEmployee;
        this.employees = this.employees.map((item) => item._id === updatedEmployee._id ? { ...item, ...updatedEmployee } : item);
        this.editingEmployeeField = '';
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erro ao atualizar treinador.';
      }
    });
  }

  // Função auxiliar «onFilterChange».
  onFilterChange(): void {
    this.employeePage = 1;
  }

  // Limpa filtros.
  clearFilters(): void {
    this.searchTerm = '';
    this.statusFilter = 'todos';
    this.validationFilter = 'todos';
    this.profileFilter = 'todos';
    this.sortFilter = 'nameAsc';
    this.employeePage = 1;
  }

  // Navega para a página selecionada.
  goToPage(page: PaginationItem): void {
    if (page === 'ellipsis') return;
    this.employeePage = Math.min(Math.max(page, 1), this.totalEmployeePages);
  }

  // Verifica o utilizador atual.
  isCurrentUser(user: any): boolean {
    return String(user?._id || user?.id || '') === this.currentUserId;
  }

  // Obtém utilizador name.
  getUserName(user: any): string {
    return user?.userData?.name || user?.username || 'Utilizador';
  }

  // Obtém tipo de conta interna.
  getEmployeeTypeLabel(user: any): string {
    if (user?.role !== 'Funcionario') {
      return user?.role || '-';
    }

    return user?.employeeRole === 'Admin' ? 'Gestor do Clube' : 'Treinador';
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

  // Ordena treinadores.
  private sortEmployees(a: any, b: any): number {
    if (this.sortFilter === 'createdDesc') {
      return this.withEmployeeTieBreakers(new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(), a, b);
    }

    if (this.sortFilter === 'createdAsc') {
      return this.withEmployeeTieBreakers(new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(), a, b);
    }

    if (this.sortFilter === 'numberAsc') {
      return this.withEmployeeTieBreakers(
        String(a.userData?.employeeNumber || '').localeCompare(String(b.userData?.employeeNumber || ''), 'pt-PT'),
        a,
        b
      );
    }

    if (this.sortFilter === 'numberDesc') {
      return this.withEmployeeTieBreakers(
        String(b.userData?.employeeNumber || '').localeCompare(String(a.userData?.employeeNumber || ''), 'pt-PT'),
        a,
        b
      );
    }

    const direction = this.sortFilter === 'nameDesc' ? -1 : 1;
    return this.withEmployeeTieBreakers(
      String(this.getUserName(a)).localeCompare(String(this.getUserName(b)), 'pt-PT') * direction,
      a,
      b
    );
  }

  // Função auxiliar «withEmployeeTieBreakers».
  private withEmployeeTieBreakers(primary: number, a: any, b: any): number {
    if (primary !== 0) return primary;

    const activeCompare = Number(b.ativo) - Number(a.ativo);
    if (activeCompare !== 0) return activeCompare;

    const roleCompare = Number(b.employeeRole === 'Admin') - Number(a.employeeRole === 'Admin');
    if (roleCompare !== 0) return roleCompare;

    return String(a.email || '').localeCompare(String(b.email || ''), 'pt-PT');
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
