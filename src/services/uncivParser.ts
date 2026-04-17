import { gunzipSync } from 'node:zlib';
import { AppError } from '../lib/appError.js';
import type { GameSummaryResult, ParserContext, TurnLookupResult } from '../types/unciv.js';
import { isNonEmptyString, isRecord, toFiniteNumber } from '../utils/guards.js';
import {
  findFirstByKeyCandidates,
  findFirstByPaths,
  getValueAtPath,
  type ValueMatch,
} from '../utils/objectPath.js';
import { toIsoDateTime } from '../utils/time.js';

const PLAYER_PATH_CANDIDATES = [
  'currentPlayer',
  'currentPlayerName',
  'currentTurnPlayer',
  'playerTurnName',
  'turnOwner',
  'game.currentPlayer',
  'data.currentPlayer',
  'state.currentPlayer',
  'preview.currentPlayer',
] as const;

const PLAYER_INDEX_PATH_CANDIDATES = [
  'playerTurn',
  'currentPlayerIndex',
  'turnPlayerIndex',
  'game.playerTurn',
  'data.playerTurn',
  'state.playerTurn',
] as const;

const TURN_PATH_CANDIDATES = [
  'turns',
  'turn',
  'currentTurn',
  'turnNumber',
  'game.turns',
  'data.turns',
  'preview.turns',
] as const;

const UPDATED_AT_PATH_CANDIDATES = [
  'updatedAt',
  'lastUpdated',
  'updated_at',
  'currentTurnStartTime',
  'lastTurnTimestamp',
  'meta.updatedAt',
  'game.updatedAt',
] as const;

const GAME_ID_PATH_CANDIDATES = [
  'gameId',
  'data.gameId',
  'preview.gameId',
  'state.gameId',
  'game.gameId',
] as const;

const PLAYER_KEY_CANDIDATES = [
  'currentPlayer',
  'currentPlayerName',
  'currentTurnPlayer',
  'playerTurnName',
  'turnOwner',
  'activePlayer',
  'activeCivilization',
] as const;

const PLAYER_INDEX_KEY_CANDIDATES = [
  'playerTurn',
  'currentPlayerIndex',
  'turnPlayerIndex',
] as const;

const TURN_KEY_CANDIDATES = ['turns', 'turn', 'currentTurn', 'turnNumber'] as const;

const UPDATED_AT_KEY_CANDIDATES = [
  'updatedAt',
  'lastUpdated',
  'updated_at',
  'currentTurnStartTime',
  'lastTurnTimestamp',
  'timestamp',
] as const;

const CIV_ARRAY_PATH_CANDIDATES = [
  'civilizations',
  'data.civilizations',
  'game.civilizations',
  'preview.civilizations',
  'state.civilizations',
] as const;

const PLAYER_NAME_PATHS = ['civName', 'name', 'playerName', 'chosenCiv', 'civilizationName'] as const;
const PLAYER_TYPE_PATHS = ['playerType', 'type'] as const;
const PLAYER_ID_PATHS = ['playerId', 'id'] as const;

const numberGuard = (value: unknown): value is number => toFiniteNumber(value) !== undefined;
const dateLikeGuard = (value: unknown): value is string | number => toIsoDateTime(value) !== undefined;

export const parseJsonEndpointBody = (rawText: string): unknown => {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new AppError('BAD_RESPONSE', '/jsons 응답 본문이 비어 있습니다.');
  }

  try {
    return JSON.parse(trimmed);
  } catch (cause) {
    throw new AppError('BAD_RESPONSE', '/jsons 응답을 JSON으로 파싱하지 못했습니다.', {
      cause,
      meta: { sample: trimmed.slice(0, 200) },
    });
  }
};

export const decodeUncivFileBody = (rawText: string): unknown => {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new AppError('PARSE_FAILED', '/files 응답 본문이 비어 있습니다.');
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // ignore and continue with base64+gzip path
  }

  try {
    const compressed = Buffer.from(trimmed, 'base64');
    const jsonText = gunzipSync(compressed).toString('utf8');
    return JSON.parse(jsonText);
  } catch (cause) {
    throw new AppError('PARSE_FAILED', '/files 응답을 base64+gzip JSON으로 해석하지 못했습니다.', {
      cause,
      meta: { sample: trimmed.slice(0, 200) },
    });
  }
};

const findArrayByPaths = (payload: unknown, paths: readonly string[]): ValueMatch<unknown[]> | undefined =>
  findFirstByPaths(payload, paths, Array.isArray);

const resolvePlayerNameFromIndex = (payload: unknown, playerIndex: number): ValueMatch<string> | undefined => {
  const arrayMatch = findArrayByPaths(payload, CIV_ARRAY_PATH_CANDIDATES);
  if (!arrayMatch) return undefined;

  const target = arrayMatch.value[playerIndex];
  if (isNonEmptyString(target)) {
    return { value: target, path: `${arrayMatch.path}[${playerIndex}]` };
  }

  if (!isRecord(target)) return undefined;
  const nameMatch = findFirstByPaths(target, PLAYER_NAME_PATHS, isNonEmptyString);
  if (!nameMatch) return undefined;

  return {
    value: nameMatch.value,
    path: `${arrayMatch.path}[${playerIndex}].${nameMatch.path}`,
  };
};

const extractTurnNumber = (payload: unknown): ValueMatch<number> | undefined => {
  const byPath = findFirstByPaths(payload, TURN_PATH_CANDIDATES, numberGuard);
  if (byPath) {
    return { value: Math.floor(toFiniteNumber(byPath.value) ?? 0), path: byPath.path };
  }

  const byKey = findFirstByKeyCandidates(payload, TURN_KEY_CANDIDATES, numberGuard);
  if (!byKey) return undefined;
  return { value: Math.floor(toFiniteNumber(byKey.value) ?? 0), path: byKey.path };
};

const extractUpdatedAt = (payload: unknown): ValueMatch<string> | undefined => {
  const byPath = findFirstByPaths(payload, UPDATED_AT_PATH_CANDIDATES, dateLikeGuard);
  if (byPath) {
    return { value: toIsoDateTime(byPath.value)!, path: byPath.path };
  }

  const byKey = findFirstByKeyCandidates(payload, UPDATED_AT_KEY_CANDIDATES, dateLikeGuard);
  if (!byKey) return undefined;
  return { value: toIsoDateTime(byKey.value)!, path: byKey.path };
};

const extractPlayer = (payload: unknown): ValueMatch<string> | undefined => {
  const byPath = findFirstByPaths(payload, PLAYER_PATH_CANDIDATES, isNonEmptyString);
  if (byPath) return byPath;

  const byKey = findFirstByKeyCandidates(payload, PLAYER_KEY_CANDIDATES, isNonEmptyString);
  if (byKey) return byKey;

  const indexByPath = findFirstByPaths(payload, PLAYER_INDEX_PATH_CANDIDATES, numberGuard);
  if (indexByPath) {
    const index = Math.floor(toFiniteNumber(indexByPath.value) ?? Number.NaN);
    if (Number.isFinite(index) && index >= 0) {
      const resolved = resolvePlayerNameFromIndex(payload, index);
      if (resolved) return resolved;
    }
  }

  const indexByKey = findFirstByKeyCandidates(payload, PLAYER_INDEX_KEY_CANDIDATES, numberGuard);
  if (indexByKey) {
    const index = Math.floor(toFiniteNumber(indexByKey.value) ?? Number.NaN);
    if (Number.isFinite(index) && index >= 0) {
      const resolved = resolvePlayerNameFromIndex(payload, index);
      if (resolved) return resolved;
    }
  }

  return undefined;
};

const extractGameId = (payload: unknown): string | undefined => {
  const byPath = findFirstByPaths(payload, GAME_ID_PATH_CANDIDATES, isNonEmptyString);
  if (byPath) return byPath.value;
  const direct = getValueAtPath(payload, 'id');
  if (isNonEmptyString(direct)) return direct;
  return undefined;
};

const unique = (values: string[]): string[] => [...new Set(values)];

const extractCivilizationName = (entry: unknown): string | undefined => {
  if (isNonEmptyString(entry)) return entry;
  if (!isRecord(entry)) return undefined;

  const nameMatch = findFirstByPaths(entry, PLAYER_NAME_PATHS, isNonEmptyString);
  if (!nameMatch) return undefined;
  return nameMatch.value;
};

const isHumanCivilization = (entry: unknown): boolean => {
  if (!isRecord(entry)) return false;

  const playerType = findFirstByPaths(entry, PLAYER_TYPE_PATHS, isNonEmptyString)?.value?.toLowerCase();
  if (playerType === 'human') return true;

  const playerId = findFirstByPaths(entry, PLAYER_ID_PATHS, isNonEmptyString)?.value;
  return isNonEmptyString(playerId);
};

const extractCivilizations = (
  payload: unknown
): { civilizations: string[]; humanCivilizations: string[]; path: string } | undefined => {
  const byPath = findFirstByPaths(payload, CIV_ARRAY_PATH_CANDIDATES, Array.isArray);
  if (!byPath) return undefined;

  const civilizations: string[] = [];
  const humanCivilizations: string[] = [];

  byPath.value.forEach(entry => {
    const name = extractCivilizationName(entry);
    if (!name) return;

    civilizations.push(name);
    if (isHumanCivilization(entry)) {
      humanCivilizations.push(name);
    }
  });

  return {
    civilizations: unique(civilizations),
    humanCivilizations: unique(humanCivilizations),
    path: byPath.path,
  };
};

export const extractTurnLookupFromPayload = (
  payload: unknown,
  context: ParserContext
): Omit<TurnLookupResult, 'checkedAt'> => {
  if (!isRecord(payload) && !Array.isArray(payload)) {
    throw new AppError('PARSE_FAILED', '응답 JSON이 객체 형태가 아닙니다.', {
      meta: {
        source: context.source,
        requestedGameId: context.requestedGameId,
        resolvedGameId: context.resolvedGameId,
      },
    });
  }

  const player = extractPlayer(payload);
  if (!player) {
    throw new AppError('PARSE_FAILED', '응답에서 현재 차례 플레이어 필드를 찾지 못했습니다.', {
      meta: {
        source: context.source,
        requestedGameId: context.requestedGameId,
        resolvedGameId: context.resolvedGameId,
      },
    });
  }

  const turn = extractTurnNumber(payload);
  const updatedAt = extractUpdatedAt(payload);
  const gameId = extractGameId(payload) ?? context.resolvedGameId;

  const result: Omit<TurnLookupResult, 'checkedAt'> = {
    requestedGameId: context.requestedGameId,
    resolvedGameId: gameId,
    currentPlayer: player.value,
    source: context.source,
    matchedPlayerField: player.path,
  };

  if (turn) {
    result.turn = turn.value;
    result.matchedTurnField = turn.path;
  }

  if (updatedAt) {
    result.updatedAt = updatedAt.value;
    result.matchedUpdatedAtField = updatedAt.path;
  }

  return result;
};

export const extractGameSummaryFromPayload = (
  payload: unknown,
  context: ParserContext
): Omit<GameSummaryResult, 'checkedAt'> => {
  if (!isRecord(payload) && !Array.isArray(payload)) {
    throw new AppError('PARSE_FAILED', '응답 JSON이 객체 형태가 아닙니다.', {
      meta: {
        source: context.source,
        requestedGameId: context.requestedGameId,
        resolvedGameId: context.resolvedGameId,
      },
    });
  }

  const player = extractPlayer(payload);
  if (!player) {
    throw new AppError('PARSE_FAILED', '응답에서 현재 차례 플레이어 필드를 찾지 못했습니다.', {
      meta: {
        source: context.source,
        requestedGameId: context.requestedGameId,
        resolvedGameId: context.resolvedGameId,
      },
    });
  }

  const turn = extractTurnNumber(payload);
  const updatedAt = extractUpdatedAt(payload);
  const gameId = extractGameId(payload) ?? context.resolvedGameId;
  const civilizationInfo = extractCivilizations(payload);

  const result: Omit<GameSummaryResult, 'checkedAt'> = {
    requestedGameId: context.requestedGameId,
    resolvedGameId: gameId,
    currentPlayer: player.value,
    civilizations: civilizationInfo?.civilizations ?? [],
    humanCivilizations: civilizationInfo?.humanCivilizations ?? [],
    source: context.source,
    matchedPlayerField: player.path,
  };

  if (turn) {
    result.turn = turn.value;
    result.matchedTurnField = turn.path;
  }

  if (updatedAt) {
    result.updatedAt = updatedAt.value;
    result.matchedUpdatedAtField = updatedAt.path;
  }

  if (civilizationInfo) {
    result.matchedCivilizationsField = civilizationInfo.path;
  }

  return result;
};
