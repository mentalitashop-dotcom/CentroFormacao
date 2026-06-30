import { Routes } from '@angular/router';
import { LoginComponent } from './autenticacao/login/login.component';
import { FuncionarioDashboardComponent } from './funcionario/painel/funcionario-dashboard.component';
import { AlterarPasswordInicialComponent } from './autenticacao/alterar-password-inicial/alterar-password-inicial.component';
import { DadosPessoaisComponent } from './conta/dados-pessoais/dados-pessoais.component';
import { PerfilComponent } from './conta/perfil/perfil.component';
import { DefinicoesComponent } from './conta/definicoes/definicoes.component';
import { ConfigurarClubeComponent } from './admin/configurar-clube/configurar-clube.component';
import { protecaoFuncionario, protecaoPublica } from './core/autenticacao.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, canActivate: [protecaoPublica] },
  { path: 'alterar-password-inicial', component: AlterarPasswordInicialComponent, canActivate: [protecaoFuncionario] },
  { path: 'configurar-clube', component: ConfigurarClubeComponent, canActivate: [protecaoFuncionario] },
  { path: 'dados-pessoais', component: DadosPessoaisComponent, canActivate: [protecaoFuncionario] },
  { path: 'completar-perfil', redirectTo: 'dados-pessoais' },
  { path: 'dados-funcionario', redirectTo: 'dados-pessoais' },
  { path: 'dashboard', component: FuncionarioDashboardComponent, canActivate: [protecaoFuncionario] },
  { path: 'perfil', component: PerfilComponent, canActivate: [protecaoFuncionario] },
  { path: 'definicoes', component: DefinicoesComponent, canActivate: [protecaoFuncionario] },
  { path: '**', redirectTo: 'dashboard' }
];
