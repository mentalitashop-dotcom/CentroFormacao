import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ServicoAutenticacao } from '../../core/autenticacao.service';

@Component({
  selector: 'app-definicoes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './definicoes.component.html',
  styleUrl: './definicoes.component.scss'
})
export class DefinicoesComponent {
  private auth = inject(ServicoAutenticacao);
  private api = inject(ApiService);
  private router = inject(Router);
  user = this.auth.getUser();
  passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
  passwordMessage = '';
  passwordError = '';
  changingPassword = false;

  // Verifica se o utilizador é funcionário.
  get isFuncionario(): boolean {
    return this.user?.role === 'Funcionario';
  }

  // Termina a sessão atual do utilizador.
  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  // Altera palavra-passe.
  changePassword(): void {
    this.passwordMessage = '';
    this.passwordError = '';
    if (this.passwordForm.newPassword.length < 8) {
      this.passwordError = 'A nova password deve ter pelo menos 8 caracteres.';
      return;
    }
    if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
      this.passwordError = 'A confirmação da password não coincide.';
      return;
    }

    this.changingPassword = true;
    this.api.put<any>('/users/update-password', this.passwordForm).subscribe({
      next: (res) => {
        this.changingPassword = false;
        this.passwordMessage = res.message;
        this.passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
      },
      error: (err) => {
        this.changingPassword = false;
        this.passwordError = err?.error?.message || 'Erro ao alterar password.';
      }
    });
  }
}
