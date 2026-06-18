import { env } from '../config/env.js';
import { AppError, isAppError } from '../lib/appError.js';
import type { TurnLookupResult } from '../types/unciv.js';
import { UncivApiClient } from './uncivApiClient.js';
import { decodeUncivFileBody, extractTurnLookupFromPayload } from './uncivParser.js';

const GAME_ID_REGEX = /^[\da-f]{8}-([\da-f]{4}-){3}[\da-f]{12}(_Preview)?$/i;

const normalizeGameId = (rawGameId: string): string => {
  const trimmed = rawGameId.trim();
  const hasPreviewSuffix = /_preview$/i.test(trimmed);
  const base = hasPreviewSuffix ? trimmed.slice(0, -8) : trimmed;
  const normalizedBase = base.toLowerCase();
  return `${normalizedBase}${hasPreviewSuffix ? '_Preview' : ''}`;
};

const validateGameId = (rawGameId: string): string => {
  const normalized = normalizeGameId(rawGameId);
  if (!GAME_ID_REGEX.test(normalized)) {
    throw new AppError('INVALID_GAME_ID', 'gameId 형식이 올바르지 않습니다.', {
      meta: { input: rawGameId },
    });
  }
  return normalized;
};

const buildCandidateGameIds = (gameId: string): string[] => {
  const candidates = new Set<string>();
  candidates.add(gameId);

  if (gameId.endsWith('_Preview')) {
    candidates.add(gameId.slice(0, -8));
  } else {
    candidates.add(`${gameId}_Preview`);
  }

  return [...candidates];
};

type FreshnessAwareResult = {
  turn?: number;
  updatedAt?: string;
  source: 'jsons' | 'files';
};

type ErrorBuckets = {
  parseErrors: AppError[];
  unauthorizedError?: AppError;
  networkError?: AppError;
  serverError?: AppError;
  badResponseError?: AppError;
};

const toEpochMillis = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
};

const pickFresherResult = <T extends FreshnessAwareResult>(
  current: T | undefined,
  candidate: T
): T => {
  if (!current) return candidate;

  const currentTurn = typeof current.turn === 'number' ? current.turn : Number.NEGATIVE_INFINITY;
  const candidateTurn = typeof candidate.turn === 'number' ? candidate.turn : Number.NEGATIVE_INFINITY;
  if (candidateTurn !== currentTurn) {
    return candidateTurn > currentTurn ? candidate : current;
  }

  const currentTime = toEpochMillis(current.updatedAt) ?? Number.NEGATIVE_INFINITY;
  const candidateTime = toEpochMillis(candidate.updatedAt) ?? Number.NEGATIVE_INFINITY;
  if (candidateTime !== currentTime) {
    return candidateTime > currentTime ? candidate : current;
  }

  if (current.source !== candidate.source) {
    return candidate.source === 'files' ? candidate : current;
  }

  return current;
};

const recordLookupError = (error: unknown, buckets: ErrorBuckets): void => {
  if (!isAppError(error)) throw error;

  switch (error.code) {
    case 'NOT_FOUND':
      return;
    case 'UNAUTHORIZED':
      buckets.unauthorizedError ??= error;
      return;
    case 'NETWORK':
      buckets.networkError ??= error;
      return;
    case 'SERVER_ERROR':
      buckets.serverError ??= error;
      return;
    case 'PARSE_FAILED':
    case 'BAD_RESPONSE':
      buckets.parseErrors.push(error);
      return;
    case 'INVALID_GAME_ID':
      throw error;
    default:
      buckets.badResponseError ??= error;
      return;
  }
};

const throwLookupError = (buckets: ErrorBuckets, requestedGameId: string, parseMessage: string): never => {
  if (buckets.unauthorizedError) throw buckets.unauthorizedError;
  if (buckets.parseErrors.length > 0) {
    throw new AppError('PARSE_FAILED', parseMessage, {
      meta: {
        requestedGameId,
        parseAttempts: buckets.parseErrors.length,
      },
    });
  }
  if (buckets.networkError) throw buckets.networkError;
  if (buckets.serverError) throw buckets.serverError;
  if (buckets.badResponseError) throw buckets.badResponseError;

  throw new AppError('NOT_FOUND', '게임을 찾을 수 없습니다.', {
    meta: { requestedGameId },
  });
};

export class UncivTurnService {
  constructor(private readonly apiClient: UncivApiClient) {}

  async lookup(rawGameId: string): Promise<TurnLookupResult> {
    const requestedGameId = validateGameId(rawGameId);
    const candidates = buildCandidateGameIds(requestedGameId);

    const buckets: ErrorBuckets = { parseErrors: [] };
    let freshest: Omit<TurnLookupResult, 'checkedAt'> | undefined;

    for (const candidate of candidates) {
      try {
        const payload = await this.apiClient.fetchJsonPayload(candidate);
        const parsed = extractTurnLookupFromPayload(payload, {
          requestedGameId,
          resolvedGameId: candidate,
          source: 'jsons',
        });
        freshest = pickFresherResult(freshest, parsed);
      } catch (error) {
        recordLookupError(error, buckets);
      }

      try {
        const raw = await this.apiClient.fetchFileRaw(candidate);
        const payload = decodeUncivFileBody(raw);
        const parsed = extractTurnLookupFromPayload(payload, {
          requestedGameId,
          resolvedGameId: candidate,
          source: 'files',
        });
        freshest = pickFresherResult(freshest, parsed);
      } catch (error) {
        recordLookupError(error, buckets);
      }
    }

    if (freshest) {
      return {
        ...freshest,
        checkedAt: new Date().toISOString(),
      };
    }

    return throwLookupError(buckets, requestedGameId, '응답은 받았지만 현재 차례 필드를 해석하지 못했습니다.');
  }
}

export const createUncivTurnService = (): UncivTurnService =>
  new UncivTurnService(new UncivApiClient(env.UNCIV_BASE_URL, env.REQUEST_TIMEOUT_MS));
