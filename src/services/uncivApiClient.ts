import { AppError } from '../lib/appError.js';
import { parseJsonEndpointBody } from './uncivParser.js';
import { isRecord } from '../utils/guards.js';

type HttpTextResponse = {
  status: number;
  text: string;
};

export class UncivApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number
  ) {}

  private buildUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private toStatusError(status: number, path: string, responseBody: string): AppError {
    const meta = {
      path,
      status,
      bodySample: responseBody.slice(0, 300),
    };

    if (status === 401 || status === 403) {
      return new AppError('UNAUTHORIZED', '인증이 필요한 서버입니다.', { status, meta });
    }

    if (status === 404) {
      return new AppError('NOT_FOUND', '해당 gameId를 찾을 수 없습니다.', { status, meta });
    }

    if (status === 400 || status === 422) {
      return new AppError('INVALID_GAME_ID', 'gameId 형식이 유효하지 않습니다.', { status, meta });
    }

    if (status >= 500) {
      return new AppError('SERVER_ERROR', '서버 내부 오류가 발생했습니다.', { status, meta });
    }

    return new AppError('BAD_RESPONSE', `예상하지 못한 응답 상태 코드: ${status}`, {
      status,
      meta,
    });
  }

  private async getText(path: string): Promise<HttpTextResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.buildUrl(path), {
        method: 'GET',
        signal: controller.signal,
        headers: {
          accept: 'application/json,text/plain,*/*',
        },
      });

      const text = await response.text();
      return { status: response.status, text };
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') {
        throw new AppError('NETWORK', `서버 응답 타임아웃(${this.timeoutMs}ms)`, {
          cause,
          meta: { path },
        });
      }

      throw new AppError('NETWORK', 'Unciv 서버 요청 중 네트워크 오류가 발생했습니다.', {
        cause,
        meta: { path },
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async fetchJsonPayload(gameId: string): Promise<unknown> {
    const path = `/jsons/${encodeURIComponent(gameId)}`;
    const response = await this.getText(path);

    if (response.status !== 200) {
      throw this.toStatusError(response.status, path, response.text);
    }

    return parseJsonEndpointBody(response.text);
  }

  async fetchFileRaw(gameId: string): Promise<string> {
    const path = `/files/${encodeURIComponent(gameId)}`;
    const response = await this.getText(path);

    if (response.status !== 200) {
      throw this.toStatusError(response.status, path, response.text);
    }

    return response.text;
  }

  async fetchIsAlive(): Promise<{ authVersion: number; chatVersion: number }> {
    const path = '/isalive';
    const response = await this.getText(path);

    if (response.status !== 200) {
      throw this.toStatusError(response.status, path, response.text);
    }

    const payload = parseJsonEndpointBody(response.text);
    if (!isRecord(payload)) {
      throw new AppError('BAD_RESPONSE', '/isalive 응답 형식이 올바르지 않습니다.', {
        meta: { path, sample: response.text.slice(0, 200) },
      });
    }

    const authVersion = payload.authVersion;
    const chatVersion = payload.chatVersion;

    if (typeof authVersion !== 'number' || typeof chatVersion !== 'number') {
      throw new AppError('BAD_RESPONSE', '/isalive 필드(authVersion/chatVersion)를 해석하지 못했습니다.', {
        meta: { path, payload },
      });
    }

    return { authVersion, chatVersion };
  }
}
