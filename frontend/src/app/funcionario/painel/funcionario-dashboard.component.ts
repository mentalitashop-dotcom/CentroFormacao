import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ServicoAutenticacao } from '../../core/autenticacao.service';
import { AdminFuncionariosTabelaComponent } from '../../admin/funcionarios/admin-funcionarios-tabela/admin-funcionarios-tabela.component';
import { AdminAuditoriaComponent } from '../../admin/auditoria/admin-auditoria.component';
import { AdminClubeComponent } from '../../admin/clube/admin-clube.component';
import { FuncionarioAlunosTabelaComponent } from '../alunos/funcionario-alunos-tabela/funcionario-alunos-tabela.component';
import { FuncionarioFormacaoTabelaComponent } from '../formacao/funcionario-formacao-tabela/funcionario-formacao-tabela.component';
import { FuncionarioPlanosInscricaoTabelaComponent } from '../planos-inscricao/funcionario-planos-inscricao-tabela/funcionario-planos-inscricao-tabela.component';
import { FuncionarioInscricoesTabelaComponent } from '../inscricoes/funcionario-inscricoes-tabela/funcionario-inscricoes-tabela.component';
import { GestorResumoComponent } from '../gestor-resumo/gestor-resumo.component';
import { PainelCabecalhoComponent } from '../../layout/painel-cabecalho/painel-cabecalho.component';
import { PainelMenuComponent } from '../../layout/painel-menu/painel-menu.component';

type DashboardTab = 'inicio' | 'funcionarios' | 'alunos' | 'formacao' | 'planos' | 'inscricoes' | 'clube' | 'auditoria';
type DashboardEnrolmentFilter = 'todos' | 'abertas' | 'pendente' | 'validada' | 'em_acompanhamento' | 'concluida' | 'cancelada';
type DashboardPlanVacancyFilter = 'todos' | 'baixo' | 'sem-vagas';

type SummaryTarget =
  | { tab: 'inscricoes'; enrolmentStatus: DashboardEnrolmentFilter }
  | { tab: 'planos'; planVacancy: DashboardPlanVacancyFilter };

interface DashboardTabItem {
  id: DashboardTab;
  label: string;
  description: string;
  adminOnly?: boolean;
}

@Component({
  imports: [ CommonModule, GestorResumoComponent, AdminFuncionariosTabelaComponent, AdminAuditoriaComponent, FuncionarioAlunosTabelaComponent, FuncionarioFormacaoTabelaComponent, FuncionarioPlanosInscricaoTabelaComponent, FuncionarioInscricoesTabelaComponent, AdminClubeComponent, PainelCabecalhoComponent, PainelMenuComponent
  ],
  selector: 'app-funcionario-dashboard',
  standalone: true,
  templateUrl: './funcionario-dashboard.component.html',
  styleUrl: './funcionario-dashboard.component.scss'
})
export class FuncionarioDashboardComponent implements OnInit {
  private auth = inject(ServicoAutenticacao);
  user = this.auth.getUser();
  activeTab: DashboardTab = 'inicio';
  enrolmentStatusFilter: DashboardEnrolmentFilter = 'todos';
  planVacancyFilter: DashboardPlanVacancyFilter = 'todos';
  planStructureFilter = '';

  readonly tabs: DashboardTabItem[] = [
    { id: 'inicio', label: 'Resumo', description: 'Indicadores gerais do clube.' },
    { id: 'inscricoes', label: 'Inscrições', description: 'Pedidos, estados e histórico.' },
    { id: 'alunos', label: 'Alunos', description: 'Consulta dos alunos registados.' },
    { id: 'formacao', label: 'Formação', description: 'Áreas, escalões e turmas.' },
    { id: 'planos', label: 'Planos de inscrição', description: 'Valores, vagas, imagens e estado.' },
    { id: 'clube', label: 'Centro de Formação', description: 'Identidade, contactos e informação institucional.', adminOnly: true },
    { id: 'funcionarios', label: 'Treinadores', description: 'Equipa técnica, secretaria e acessos.', adminOnly: true },
    { id: 'auditoria', label: 'Auditoria', description: 'Histórico de ações da equipa.', adminOnly: true }
    
  ];

  // Verifica admin.
  get isAdmin(): boolean {
    const currentUser = this.auth.getUser();
    return this.auth.isFuncionarioAdmin() ||
      (currentUser?.role === 'Funcionario' && currentUser?.employeeRole === 'Admin');
  }

  // Função auxiliar «visibleTabs».
  get visibleTabs(): DashboardTabItem[] {
    return this.tabs.filter((tab) => !tab.adminOnly || this.isAdmin);
  }

  // Função auxiliar «userDisplayName».
  get userDisplayName(): string {
    return this.user?.name || this.user?.username || 'Utilizador';
  }

  // Função auxiliar «userTypeLabel».
  get userTypeLabel(): string {
    const currentUser = this.auth.getUser() || this.user;

    if (currentUser?.role === 'Funcionario') {
      return currentUser?.employeeRole === 'Admin' ? 'Gestor do Centro de Formação' : 'Treinador';
    }

    if (currentUser?.role === 'Atleta') {
      return 'Aluno';
    }

    return currentUser?.role || '';
  }

  // Carrega os dados iniciais do componente.
  ngOnInit(): void {
    this.activeTab = 'inicio';
  }

  // Seleciona tab.
  selectTab(tab: DashboardTab): void {
    const nextTab = this.visibleTabs.find((item) => item.id === tab);
    if (!nextTab) return;

    if (tab === 'inscricoes') this.enrolmentStatusFilter = 'todos';
    this.activeTab = tab;
  }
  // Seleciona tab by id.
  selectTabById(tab: string): void { this.selectTab(tab as DashboardTab); }

  // Abre summary target.
  openSummaryTarget(target: SummaryTarget): void {
    if (target.tab === 'inscricoes') {
      this.enrolmentStatusFilter = target.enrolmentStatus;
      this.activeTab = 'inscricoes';
      return;
    }

    if (target.tab === 'planos') {
      this.planVacancyFilter = target.planVacancy;
      this.activeTab = 'planos';
    }
  }

  // Abre planos por área de formação ou escalão.
  openStructurePlans(structureId: string): void {
    this.planStructureFilter = structureId;
    this.planVacancyFilter = 'todos';
    this.activeTab = 'planos';
  }
}
