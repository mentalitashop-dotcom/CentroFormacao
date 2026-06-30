import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { resolveApiAsset } from '../../core/configuracao-api';

type ClubField = '' | 'name' | 'phone' | 'email' | 'address' | 'aboutText';
type SavingField = ClubField | 'logo';


@Component({
  selector: 'app-admin-clube',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-clube.component.html',
  styleUrl: './admin-clube.component.scss'
})
export class AdminClubeComponent implements OnInit {
  private api = inject(ApiService);

  readonly logoWidth = 128;
  readonly logoHeight = 44;

  settings: any = {
    name: 'Clube Formação',
    logoUrl: '',
    phone: '',
    email: '',
    aboutText: '',
    address: ''
  };

  fieldForm = {
    name: '',
    phone: '',
    email: '',
    aboutText: '',
    address: ''
  };

  editingField: ClubField = '';
  savingField: SavingField = '';
  message = '';
  error = '';


  // Carrega os dados iniciais do componente.
  ngOnInit(): void {
    this.loadSettings();
  }

  // Carrega configurações.
  loadSettings(): void {
    this.message = '';
    this.error = '';

    this.api.get<any>('/club-settings/load').subscribe({
      next: (settings) => this.applySettings(settings),
      error: (err) => this.error = err?.error?.message || 'Erro ao carregar dados do clube.'
    });
  }

  // Função auxiliar «startEdit».
  startEdit(field: ClubField): void {
    this.message = '';
    this.error = '';
    this.editingField = field;
    this.resetFieldForm();
  }

  // Função auxiliar «cancelEdit».
  cancelEdit(): void {
    this.editingField = '';
    this.error = '';
    this.resetFieldForm();
  }

  // Guarda campo.
  saveField(field: Exclude<ClubField, ''>): void {
    this.message = '';
    this.error = '';

    const value = String(this.fieldForm[field] || '').trim();
    const payload: Record<string, string> = {};

    if (field === 'name' && !value) {
      this.error = 'O nome do clube é obrigatório.';
      return;
    }

    if (field === 'phone' && value && !/^[29]\d{8}$/.test(value)) {
      this.error = 'O telefone deve ter 9 dígitos e começar por 9 ou 2.';
      return;
    }

    if (field === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      this.error = 'Insere um email válido.';
      return;
    }

    if (field === 'address' && value && !this.isValidAddress(value)) {
      this.error = 'A morada deve começar por Rua, Avenida, Praça, Largo ou outro tipo de via válido.';
      return;
    }

    if (field === 'aboutText' && value.length > 1200) {
      this.error = 'A história do clube não pode ultrapassar 1200 caracteres.';
      return;
    }

    payload[field] = value;
    this.patchSettings(payload, field);
  }

  // Envia o logotipo do clube.
  uploadLogo(event: Event): void {
    this.message = '';
    this.error = '';

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.error = 'Seleciona um ficheiro de imagem.';
      input.value = '';
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      if (image.width !== this.logoWidth || image.height !== this.logoHeight) {
        this.error = `O logotipo deve ter exatamente ${this.logoWidth} x ${this.logoHeight} px.`;
        input.value = '';
        return;
      }

      const formData = new FormData();
      formData.append('image', file);
      this.savingField = 'logo';

      this.api.post<any>('/images/create', formData).subscribe({
        next: (res) => {
          this.patchSettings({ logoUrl: res.imageUrl }, 'logo');
          input.value = '';
        },
        error: (err) => {
          this.savingField = '';
          this.error = err?.error?.message || 'Erro ao enviar logotipo.';
          input.value = '';
        }
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      this.error = 'Não foi possível ler a imagem selecionada.';
      input.value = '';
    };

    image.src = objectUrl;
  }

  // Função auxiliar «resolveImageUrl».
  resolveImageUrl(url: string): string {
    if (!url) return '';
    return resolveApiAsset(url);
  }

  // Função auxiliar «patchSettings».
  private patchSettings(payload: Record<string, unknown>, field: SavingField): void {
    this.savingField = field;

    this.api.patch<any>('/club-settings/update', payload).subscribe({
      next: (res) => {
        this.message = res.message;
        this.applySettings(res.settings);
        this.editingField = '';
        this.savingField = '';
      },
      error: (err) => {
        this.savingField = '';
        this.error = err?.error?.message || 'Erro ao guardar campo do clube.';
      }
    });
  }

  // Aplica configurações.
  private applySettings(settings: any): void {
    this.settings = {
      name: settings?.name || 'Clube Formação',
      logoUrl: settings?.logoUrl || '',
      phone: /^[29]\d{8}$/.test(String(settings?.phone || '')) ? settings.phone : '',
      email: settings?.email || '',
      aboutText: settings?.aboutText || '',
      address: settings?.address || ''
    };
    this.resetFieldForm();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('club-settings-updated', { detail: this.settings }));
    }
  }

  // Repõe campo formulário.
  private resetFieldForm(): void {
    this.fieldForm = {
      name: this.settings.name || '',
      phone: this.settings.phone || '',
      email: this.settings.email || '',
      aboutText: this.settings.aboutText || '',
      address: this.settings.address || ''
    };
  }


  // Verifica se a morada é válida.
  private isValidAddress(address: string): boolean {
    const allowedStart = /^(rua|avenida|praça|praca|largo|travessa|alameda|estrada|caminho|praceta|urbanização|urbanizacao|rotunda|beco|bairro|quinta|lugar|rampa|escadas|pátio|patio|zona industrial)\b/i;
    return allowedStart.test(address.trim());
  }
}
