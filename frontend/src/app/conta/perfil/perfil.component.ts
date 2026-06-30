import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ServicoAutenticacao } from '../../core/autenticacao.service';

type ProfileField = '' | 'username' | 'email' | 'name' | 'phone' | 'taxpayerNumber' | 'jobTitle';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.scss'
})
export class PerfilComponent implements OnInit {
  @Input() embedded = false;
  private auth = inject(ServicoAutenticacao);
  private api = inject(ApiService);
  private router = inject(Router);

  user = this.auth.getUser();
  editingField: ProfileField = '';
  editingAddress = false;
  message = '';
  error = '';

  profile = {
    username: '', email: '', name: '', phone: '', taxpayerNumber: '', employeeNumber: '', jobTitle: '',
    street: '', addressType: 'Rua', addressName: '', doorNumber: '', postalCode: '', city: ''
  };
  originalProfile = { ...this.profile };

  // Função auxiliar «userTypeLabel».
  get userTypeLabel(): string {
    if (this.user?.role === 'Funcionario') return this.user?.employeeRole === 'Admin' ? 'Gestor do Clube' : 'Treinador';
    return this.user?.role || '';
  }

  // Verifica se o utilizador é funcionário.
  get isFuncionario(): boolean {
    return this.user?.role === 'Funcionario';
  }

  // Função auxiliar «formattedAddress».
  get formattedAddress(): string {
    const p = this.profile;
    if (!p.addressName) return 'Ainda não preenchida';
    return `${p.addressType} ${p.addressName}, ${p.doorNumber}, ${p.postalCode} ${p.city}`;
  }

  // Carrega os dados iniciais do componente.
  ngOnInit(): void {
    if (this.user) this.loadProfile();
  }

  // Carrega perfil.
  loadProfile(): void {
    this.api.get<any>('/auth/load-session').subscribe({
      next: (res) => this.applyResponse(res),
      error: (err) => {
        if (!this.handleUnauthorized(err)) this.error = err?.error?.message || 'Erro ao carregar perfil.';
      }
    });
  }

  // Função auxiliar «startEdit».
  startEdit(field: ProfileField): void {
    this.editingField = field;
    this.message = '';
    this.error = '';
  }

  // Função auxiliar «cancelEdit».
  cancelEdit(field: ProfileField): void {
    if (field) this.profile[field] = this.originalProfile[field];
    this.editingField = '';
  }

  // Função auxiliar «numbersOnly».
  numbersOnly(field: 'phone' | 'taxpayerNumber' | 'postalCode'): void {
    const digits = String(this.profile[field] || '').replace(/\D/g, '');
    this.profile[field] = field === 'phone' || field === 'taxpayerNumber'
      ? digits.slice(0, 9)
      : `${digits.slice(0, 4)}${digits.length > 4 ? '-' + digits.slice(4, 7) : ''}`;
  }

  // Guarda campo.
  saveField(field: ProfileField): void {
    if (!field) return;
    const value = String(this.profile[field] || '').trim();
    if (!value) return this.setError('O campo não pode ficar vazio.');
    if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return this.setError('Insere um email valido.');
    if (field === 'phone' && !/^[29]\d{8}$/.test(value)) return this.setError('O telefone deve ter 9 digitos e comecar por 9 ou 2.');
    if (field === 'taxpayerNumber' && !this.isValidTaxpayerNumber(value)) return this.setError('Indica um NIF valido.');

    this.updateProfile({ [field]: value });
  }

  // Guarda morada.
  saveAddress(): void {
    const address = {
      street: this.profile.street.trim(),
      doorNumber: this.profile.doorNumber.trim(),
      postalCode: this.profile.postalCode.trim(),
      city: this.profile.city.trim()
    };

    if (!/^(rua|avenida|praca|praça|largo|travessa|alameda|estrada|caminho|praceta|urbanizacao|urbanização|rotunda|beco|bairro|quinta|lugar|zona industrial)\s+\S+/i.test(address.street)) {
      return this.setError('A morada deve começar por Rua, Avenida ou outro tipo de via válido.');
    }

    if (!address.city) return this.setError('Preenche a morada e a cidade.');
    if (!/^[0-9]+[A-Za-z]?(?:[-/][0-9A-Za-z]+)?$/.test(address.doorNumber)) return this.setError('Indica um numero de porta valido.');
    if (!/^[1-9][0-9]{3}-[0-9]{3}$/.test(address.postalCode)) return this.setError('O codigo postal deve ter o formato 1234-567.');
    this.updateProfile(address);
  }

  // Função auxiliar «cancelAddress».
  cancelAddress(): void {
    this.profile = { ...this.originalProfile };
    this.editingAddress = false;
    this.error = '';
  }

  // Atualiza perfil.
  private updateProfile(payload: any): void {
    this.error = '';
    this.message = '';
    this.api.put<any>('/users/update-profile', payload).subscribe({
      next: (res) => {
        this.applyResponse(res);
        this.editingField = '';
        this.editingAddress = false;
        this.message = res.message || 'Perfil atualizado com sucesso.';
      },
      error: (err) => {
        if (!this.handleUnauthorized(err)) this.error = err?.error?.message || 'Erro ao atualizar perfil.';
      }
    });
  }

  // Aplica response.
  private applyResponse(res: any): void {
    const d = res.userData || {};
    this.user = { ...this.user, ...res.user, name: d.name || res.user?.username };
    this.profile = {
      username: res.user?.username || this.profile.username,
      email: res.user?.email || this.profile.email,
      name: d.name || this.profile.name,
      phone: d.phone || this.profile.phone,
      taxpayerNumber: d.taxpayerNumber || '',
      employeeNumber: d.employeeNumber || this.profile.employeeNumber,
      jobTitle: d.jobTitle || this.profile.jobTitle,
      street: d.addressName ? `${d.addressType || ''} ${d.addressName}`.trim() : '',
      addressType: d.addressType || this.profile.addressType,
      addressName: d.addressName || this.profile.addressName,
      doorNumber: d.doorNumber || this.profile.doorNumber,
      postalCode: d.postalCode || this.profile.postalCode,
      city: d.city || this.profile.city
    };
    this.auth.updateStoredUser(this.user);
    this.originalProfile = { ...this.profile };
  }

  // Função auxiliar «setError».
  private setError(message: string): void {
    this.error = message;
  }

  // Verifica se o NIF é válido.
  private isValidTaxpayerNumber(value: string): boolean {
    const nif = String(value || '').trim();
    if (!/^[1-9]\d{8}$/.test(nif)) return false;
    const sum = nif.slice(0, 8).split('').reduce((total, digit, index) => total + Number(digit) * (9 - index), 0);
    const checkDigit = 11 - (sum % 11);
    return Number(nif[8]) === (checkDigit >= 10 ? 0 : checkDigit);
  }

  // Função auxiliar «handleUnauthorized».
  private handleUnauthorized(err: any): boolean {
    if (err?.status !== 401) return false;
    this.auth.logout();
    this.router.navigate(['/login']);
    return true;
  }
}
