import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-painel-cabecalho',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './painel-cabecalho.component.html',
  styleUrl: './painel-cabecalho.component.scss'
})
export class PainelCabecalhoComponent {
  @Input() eyebrow = '';
  @Input() title = '';
  @Input() subtitle = '';

  // Função auxiliar «todayLabel».
  get todayLabel(): string {
    return new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date());
  }
}
