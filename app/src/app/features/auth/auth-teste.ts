import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { erroHttpInterceptor } from '../../core/http-error.interceptor';
import { StorageService } from '../../core/storage.service';
import type { Usuario } from '../../data/models';

/**
 * Sessao em memoria. O StorageService de verdade fala com o Capacitor
 * Preferences; aqui o que importa e so o que foi gravado e o que volta no boot.
 */
/** O que a sessao guarda em disco. `turmaId` ausente = tem conta, nao tem turma. */
interface SessaoFake {
  jwt: string;
  usuario: Usuario;
  turmaId?: string | null;
}

export class StorageFake implements Pick<StorageService, 'lerSessao' | 'gravarSessao' | 'limparSessao' | 'limpar'> {
  sessao: SessaoFake | null = null;

  async lerSessao(): Promise<SessaoFake | null> {
    return this.sessao;
  }
  async gravarSessao(jwt: string, usuario: Usuario, turmaId?: string | null): Promise<void> {
    this.sessao = { jwt, usuario, turmaId: turmaId ?? null };
  }
  async limparSessao(): Promise<void> {
    this.sessao = null;
  }
  async limpar(): Promise<void> {
    /* snapshot nao participa destes testes */
  }
}

export const USUARIO: Usuario = { id: 'u1', nome: 'Otavio', email: 'voce@exemplo.com' };

/** Providers comuns das telas de entrada: HTTP falso e o interceptor de erro de verdade. */
export function configurarTeste(storage: StorageFake): HttpTestingController {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideIonicAngular(),
      provideHttpClient(withInterceptors([erroHttpInterceptor])),
      provideHttpClientTesting(),
      { provide: StorageService, useValue: storage },
    ],
  });
  return TestBed.inject(HttpTestingController);
}
