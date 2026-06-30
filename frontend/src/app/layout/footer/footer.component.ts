import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { resolveApiAsset } from '../../core/configuracao-api';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent implements OnInit {
  private api = inject(ApiService);

  store: any = { name: 'Clube Formação', logoUrl: '', aboutText: '', phone: '', email: '', address: ''};

  // Carrega os dados iniciais do componente.
  ngOnInit(): void {
    this.api.get<any>('/club-settings/load').subscribe({
      next: (settings) => this.store = { ...this.store, ...settings }
    });
  }


  // Devolve o ano atual.
  get year(): number {
    return new Date().getFullYear();
  }

  // Função auxiliar «resolveImageUrl».
  resolveImageUrl(url: string): string {
    if (!url) return '';
    return resolveApiAsset(url);
  }
}
