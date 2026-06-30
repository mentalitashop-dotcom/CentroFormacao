import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ServicoAutenticacao } from '../../core/autenticacao.service';

@Component({
  selector: 'app-alterar-password-inicial',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alterar-password-inicial.component.html',
  styleUrl: './alterar-password-inicial.component.scss'
})
export class AlterarPasswordInicialComponent {
  newPassword = '';
  confirmPassword = '';
  error = '';

  constructor(
    private api: ApiService,
    private auth: ServicoAutenticacao,
    private router: Router
  ) {}

  // Valida e submete o formulário.
  submit(): void {
    this.error = '';

    this.api.put<any>('/users/update-initial-password', {
      newPassword: this.newPassword,
      confirmPassword: this.confirmPassword
    }).subscribe({
      next: (res) => {
        this.auth.updateStoredUser(res.user);
        this.router.navigate(['/dados-pessoais']);
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erro ao alterar palavra-passe.';
      }
    });
  }
}
