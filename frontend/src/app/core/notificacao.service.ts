import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error';
}

@Injectable({ providedIn: 'root' })
export class ServicoNotificacao {
  private nextId = 1;
  private messagesSubject = new BehaviorSubject<ToastMessage[]>([]);
  messages$ = this.messagesSubject.asObservable();

  // Função auxiliar «success».
  success(text: string): void { this.show(text, 'success'); }
  // Função auxiliar «error».
  error(text: string): void { this.show(text, 'error'); }
  // Função auxiliar «dismiss».
  dismiss(id: number): void { this.messagesSubject.next(this.messagesSubject.value.filter((item) => item.id !== id)); }

  // Função auxiliar «show».
  private show(text: string, type: ToastMessage['type']): void {
    const message = { id: this.nextId++, text, type };
    this.messagesSubject.next([...this.messagesSubject.value, message]);
    if (typeof window !== 'undefined') window.setTimeout(() => this.dismiss(message.id), 2800);
  }
}
