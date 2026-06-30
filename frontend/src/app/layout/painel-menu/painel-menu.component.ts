import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface PainelMenuItem {
  id: string;
  label: string;
  description: string;
}

@Component({
  selector: 'app-painel-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './painel-menu.component.html',
  styleUrl: './painel-menu.component.scss'
})
export class PainelMenuComponent {
  @Input() items: PainelMenuItem[] = [];
  @Input() activeId = '';
  @Input() ariaLabel = 'Áreas do painel';
  @Output() itemSelected = new EventEmitter<string>();
}
