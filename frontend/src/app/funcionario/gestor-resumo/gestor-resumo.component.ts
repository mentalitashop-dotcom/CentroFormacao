import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { ApiService } from '../../core/api.service';

type SummaryTarget =
  | { tab: 'inscricoes'; enrolmentStatus: 'abertas' | 'concluida' | 'cancelada' }
  | { tab: 'planos'; planVacancy: 'baixo' };

@Component({
  selector: 'app-gestor-resumo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gestor-resumo.component.html',
  styleUrl: './gestor-resumo.component.scss'
})
export class GestorResumoComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private refreshSubscription = new Subscription();

  @Output() navigateToSection = new EventEmitter<SummaryTarget>();

  stats: any = {
    totalEnrolments: 0,
    openEnrolments: 0,
    completedEnrolments: 0,
    canceledEnrolments: 0,
    plansCount: 0,
    lowVacancyPlans: 0,
    mostRequestedPlans: []
  };
  error = '';

  // Função auxiliar «completionRate».
  get completionRate(): number {
    if (!this.stats.totalEnrolments) return 0;
    return Math.round((this.stats.completedEnrolments / this.stats.totalEnrolments) * 100);
  }

  // Verifica se já existe atividade no clube.
  get hasClubActivity(): boolean {
    return !!this.stats.totalEnrolments || !!this.stats.plansCount;
  }

  // Carrega os dados iniciais do componente.
  ngOnInit(): void {
    this.loadStats();
    this.refreshSubscription = interval(10000).subscribe(() => this.loadStats(false));
  }

  // Liberta subscrições e recursos utilizados pelo componente.
  ngOnDestroy(): void {
    this.refreshSubscription.unsubscribe();
  }

  // Carrega estatísticas.
  loadStats(showError = true): void {
    if (showError) this.error = '';

    this.api.get<any>('/enrolments/load-club-stats').subscribe({
      next: (stats) => this.stats = {
        totalEnrolments: stats?.totalEnrolments || 0,
        openEnrolments: stats?.openEnrolments || 0,
        completedEnrolments: stats?.completedEnrolments || 0,
        canceledEnrolments: stats?.canceledEnrolments || 0,
        plansCount: stats?.plansCount || 0,
        lowVacancyPlans: stats?.lowVacancyPlans || 0,
        mostRequestedPlans: stats?.mostRequestedPlans || []
      },
      error: (err) => {
        if (showError) this.error = err?.error?.message || 'Erro ao carregar o resumo do clube.';
      }
    });
  }

  // Formata valor monetário.
  formatPrice(priceCents: number): string {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format((priceCents || 0) / 100);
  }

  // Abre inscrições.
  openEnrolments(enrolmentStatus: 'abertas' | 'concluida' | 'cancelada'): void {
    this.navigateToSection.emit({ tab: 'inscricoes', enrolmentStatus });
  }

  // Abre escalões com poucas vagas.
  openLowVacancyPlans(): void {
    this.navigateToSection.emit({ tab: 'planos', planVacancy: 'baixo' });
  }
}
