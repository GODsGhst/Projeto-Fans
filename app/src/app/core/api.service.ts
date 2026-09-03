import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';

export type ParamsApi = Record<string, string | number | boolean>;

/**
 * Unico ponto que sabe onde a API mora e como falar com ela.
 *
 * Nao trata erro: quem traduz status em erro de dominio e o
 * `erroHttpInterceptor`. Aqui um erro sempre sobe — engolir seria transformar
 * "falhei ao buscar" em "nao ha nada", o pior bug possivel deste app.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  get<T>(rota: string, params?: ParamsApi): Promise<T> {
    return firstValueFrom(this.http.get<T>(this.base + rota, { params: montar(params) }));
  }

  post<T>(rota: string, corpo?: unknown): Promise<T> {
    return firstValueFrom(this.http.post<T>(this.base + rota, corpo ?? {}));
  }

  put<T>(rota: string, corpo?: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(this.base + rota, corpo ?? {}));
  }

  /**
   * PATCH em registro versionado exige `If-Match`; sem o header o backend
   * devolve 428.
   *
   * `version` é opcional porque nem todo recurso tem bloqueio otimista: a turma
   * não tem coluna `version`, e mandar `If-Match` nela seria inventar uma
   * concorrência que o servidor não valida. Evento, material e matéria têm — e
   * lá o parâmetro continua obrigatório na prática, porque o backend recusa sem
   * ele.
   */
  patch<T>(rota: string, corpo: unknown, version?: number): Promise<T> {
    return firstValueFrom(
      this.http.patch<T>(this.base + rota, corpo, {
        headers: version === undefined ? {} : ifMatch(version),
      }),
    );
  }

  /** Exclusao e sempre logica no servidor; aqui e so o verbo. */
  delete<T>(rota: string, version?: number): Promise<T> {
    return firstValueFrom(
      this.http.delete<T>(this.base + rota, {
        headers: version === undefined ? {} : ifMatch(version),
      }),
    );
  }
}

function ifMatch(version: number): Record<string, string> {
  return { 'If-Match': String(version) };
}

function montar(params?: ParamsApi): HttpParams {
  let p = new HttpParams();
  for (const chave of Object.keys(params ?? {})) {
    p = p.set(chave, String((params as ParamsApi)[chave]));
  }
  return p;
}
