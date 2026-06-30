import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ServicoAutenticacao } from '../../core/autenticacao.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  identifier = '';
  password = '';
  showPassword = false;
  error = '';
  private returnUrl = '/dashboard';

  constructor(
    private api: ApiService,
    private auth: ServicoAutenticacao,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  // Carrega os dados iniciais do componente.
  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';

    if (this.route.snapshot.queryParamMap.get('sessionExpired') === 'true') {
      this.error = 'A tua sessão expirou. Inicia sessão novamente.';
    }
  }

  // Alterna palavra-passe.
  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  // Valida e submete o formulário.
  submit(): void {
    this.error = '';

    this.api.post<any>('/auth/login', {
      identifier: this.identifier,
      username: this.identifier,
      password: this.password
    }).subscribe({
      next: (res) => {
        this.auth.saveSession(res.token, res.user);

        if (res.user.role === 'Funcionario' && !res.user.validado) {
          this.router.navigate(['/alterar-password-inicial']);
          return;
        }

        if (res.user.role === 'Funcionario' && res.user.employeeRole === 'Admin' && !res.user.clubSetupComplete) {
          this.router.navigate(['/configurar-clube']);
          return;
        }

        if (res.user.role === 'Funcionario' && res.user.employeeRole !== 'Admin' && !res.user.hasUserData) {
          this.router.navigate(['/dados-pessoais']);
          return;
        }

        if (res.user.role === 'Funcionario') {
          this.router.navigateByUrl(this.returnUrl);
        } else {
          this.auth.logout();
          this.error = 'Acesso reservado ao gestor do clube e treinadores.';
        }
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erro ao fazer login.';
      }
    });
  }
}
