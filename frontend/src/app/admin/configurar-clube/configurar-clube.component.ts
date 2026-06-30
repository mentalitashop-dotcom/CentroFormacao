import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ServicoAutenticacao } from '../../core/autenticacao.service';


@Component({
  selector: 'app-configurar-clube',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './configurar-clube.component.html',
  styleUrl: './configurar-clube.component.scss'
})
export class ConfigurarClubeComponent implements OnInit {
  form = { name: '', phone: '', email: '', address: '', aboutText: '' };


  loading = true;
  saving = false;
  error = '';

  constructor(private api: ApiService, private auth: ServicoAutenticacao, private router: Router) {}

  // Carrega dados existentes do clube.
  ngOnInit(): void {
    this.api.get<any>('/club-settings/load').subscribe({
      next: (settings) => {
        this.form = {
          name: settings?.name || '',
          phone: settings?.phone || '',
          email: settings?.email || '',
          address: settings?.address || '',
          aboutText: settings?.aboutText || ''
        };

        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Nao foi possivel carregar os dados do clube.';
      }
    });
  }

  // Mantem apenas digitos no telefone.
  numbersOnly(): void {
    this.form.phone = String(this.form.phone || '').replace(/\D/g, '').slice(0, 9);
  }

  // Valida e guarda configuracao inicial.
  submit(configForm: NgForm): void {
    this.error = '';
    configForm.control.markAllAsTouched();

    if (this.loading || this.saving) return;
    if (!this.form.name.trim()) return this.setError('Indica o nome do clube.');
    if (!/^[29]\d{8}$/.test(this.form.phone.trim())) return this.setError('O telefone deve ter 9 digitos e comecar por 9 ou 2.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email.trim())) return this.setError('Indica um email valido.');
    if (!this.isValidAddress(this.form.address)) return this.setError('A morada deve comecar por Rua, Avenida, Praca, Largo ou outro tipo de via valido.');

    this.saving = true;
    this.api.put<any>('/club-settings/update', {
      name: this.form.name.trim(),
      phone: this.form.phone.trim(),
      email: this.form.email.trim().toLowerCase(),
      address: this.form.address.trim(),
      aboutText: this.form.aboutText.trim(),
      setupComplete: true
    }).subscribe({
      next: () => {
        this.auth.updateStoredUser({ clubSetupComplete: true });
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.message || 'Erro ao guardar os dados do clube.';
      }
    });
  }

  // Valida o inicio da morada.
  private isValidAddress(address: string): boolean {
    return /^(rua|avenida|praca|praça|largo|travessa|alameda|estrada|caminho|praceta|urbanizacao|urbanização|rotunda|beco|bairro|quinta|lugar|zona industrial)\b/i.test(String(address || '').trim());
  }

  // Apresenta erro do formulario.
  private setError(message: string): void {
    this.error = message;
  }
}
