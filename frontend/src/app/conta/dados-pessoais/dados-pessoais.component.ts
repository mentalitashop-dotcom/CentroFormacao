import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ServicoAutenticacao } from '../../core/autenticacao.service';

@Component({
  selector: 'app-dados-pessoais',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dados-pessoais.component.html',
  styleUrl: './dados-pessoais.component.scss'
})
export class DadosPessoaisComponent implements OnInit {
  user: any = null;
  form = { name: '', phone: '', taxpayerNumber: '', jobTitle: '', street: '', doorNumber: '', postalCode: '', city: '' };
  error = '';
  loading = true;
  saving = false;

  constructor(private api: ApiService, private auth: ServicoAutenticacao, private router: Router) {
    this.user = this.auth.getUser();
  }

  // Carrega os dados iniciais do componente.
  ngOnInit(): void {
    this.api.get<any>('/auth/load-session').subscribe({
      next: (res) => {
        const data = res.userData || {};
        this.form.name = data.name || this.user?.name || '';
        this.form.phone = data.phone || this.user?.phone || '';
        this.form.taxpayerNumber = data.taxpayerNumber || '';
        this.form.jobTitle = data.jobTitle || '';
        this.form.street = data.addressName ? `${data.addressType || ''} ${data.addressName}`.trim() : '';
        this.form.doorNumber = data.doorNumber || '';
        this.form.postalCode = data.postalCode || '';
        this.form.city = data.city || '';
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Não foi possível carregar os dados atuais. Atualiza a página e tenta novamente.';
      }
    });
  }

  // Verifica se o utilizador é funcionário.
  get isFuncionario(): boolean { return this.user?.role === 'Funcionario'; }

  // Função auxiliar «numbersOnly».
  numbersOnly(field: 'phone' | 'taxpayerNumber' | 'postalCode'): void {
    const digits = String(this.form[field] || '').replace(/\D/g, '');
    this.form[field] = field === 'phone' || field === 'taxpayerNumber'
      ? digits.slice(0, 9)
      : `${digits.slice(0, 4)}${digits.length > 4 ? '-' + digits.slice(4, 7) : ''}`;
  }

  // Formata postal code.
  formatPostalCode(value: string): void {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 7);
    this.form.postalCode = `${digits.slice(0, 4)}${digits.length > 4 ? '-' + digits.slice(4) : ''}`;
  }

  // Valida e submete o formulário.
  submit(dadosForm: NgForm): void {
    this.error = '';
    dadosForm.control.markAllAsTouched();
    if (this.loading) return this.setError('Aguarda enquanto os teus dados são carregados.');
    if (!this.form.street.trim() || this.form.street.trim().length < 5) return this.setError('Indica o nome completo da rua ou avenida.');
    if (!this.form.city.trim() || !/^[\p{L}][\p{L} .'-]{1,79}$/u.test(this.form.city.trim())) return this.setError('Indica uma cidade válida.');
    if (this.isFuncionario && !this.form.name.trim()) return this.setError('O nome completo e obrigatorio.');
    if (this.isFuncionario && !/^[29]\d{8}$/.test(this.form.phone.trim())) return this.setError('O telefone deve ter 9 digitos e comecar por 9 ou 2.');
    if (!this.isFuncionario && this.form.taxpayerNumber && !this.isValidTaxpayerNumber(this.form.taxpayerNumber)) return this.setError('Indica um NIF valido.');
    if (!/^[1-9]\d{3}-\d{3}$/.test(this.form.postalCode.trim())) return this.setError('O codigo postal deve ter o formato 1234-567.');
    if (!/^\d+[A-Za-z]?(?:[-/][0-9A-Za-z]+)?$/.test(this.form.doorNumber.trim())) return this.setError('Indica um numero de porta valido.');
    if (this.isFuncionario && !this.form.jobTitle.trim()) return this.setError('O cargo ou funcao e obrigatorio.');
    if (!this.hasValidStreetType(this.form.street)) {
      return this.setError('A morada deve começar por Rua, Avenida ou outro tipo de via válido.');
    }

    this.saving = true;
    this.api.put<any>('/users/update-personal-data', {
      ...(this.isFuncionario ? {
        name: this.form.name.trim(),
        phone: this.form.phone.trim(),
        jobTitle: this.form.jobTitle.trim()
      } : { taxpayerNumber: this.form.taxpayerNumber.trim() }),
      street: this.form.street.trim(),
      doorNumber: this.form.doorNumber.trim(),
      postalCode: this.form.postalCode.trim(),
      city: this.form.city.trim()
    }).subscribe({
      next: (res) => {
        this.auth.updateStoredUser(res.user);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.status === 0
          ? 'Não foi possível ligar ao servidor. Confirma que o backend está iniciado na porta 2002.'
          : err?.error?.message || 'Erro ao guardar dados pessoais.';
      }
    });
  }

  // Verifica se o tipo de via é válido.
  private hasValidStreetType(street: string): boolean {
    const normalized = street.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-PT').trim();
    const types = ['rua', 'avenida', 'praca', 'largo', 'travessa', 'alameda', 'estrada', 'caminho', 'praceta', 'urbanizacao', 'rotunda', 'beco', 'bairro', 'quinta', 'lugar', 'zona industrial'];
    return types.some((type) => normalized.startsWith(`${type} `) && normalized.length > type.length + 1);
  }

  // Verifica se o NIF é válido.
  private isValidTaxpayerNumber(value: string): boolean {
    const nif = String(value || '').trim();
    if (!/^[1-9]\d{8}$/.test(nif)) return false;
    const sum = nif.slice(0, 8).split('').reduce((total, digit, index) => total + Number(digit) * (9 - index), 0);
    const checkDigit = 11 - (sum % 11);
    return Number(nif[8]) === (checkDigit >= 10 ? 0 : checkDigit);
  }

  // Função auxiliar «setError».
  private setError(message: string): void { this.error = message; }
}
