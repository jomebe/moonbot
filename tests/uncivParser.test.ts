import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { AppError } from '../src/lib/appError.js';
import {
  decodeUncivFileBody,
  extractTurnLookupFromPayload,
  parseJsonEndpointBody,
} from '../src/services/uncivParser.js';

const toPackedSave = (obj: unknown): string =>
  Buffer.from(gzipSync(Buffer.from(JSON.stringify(obj), 'utf8'))).toString('base64');

test('표준 currentPlayer 필드 파싱', () => {
  const payload = {
    gameId: '11111111-1111-1111-1111-111111111111',
    currentPlayer: 'Babylon',
    turns: 87,
    currentTurnStartTime: 1_712_000_000,
  };

  const result = extractTurnLookupFromPayload(payload, {
    requestedGameId: payload.gameId,
    resolvedGameId: payload.gameId,
    source: 'jsons',
  });

  assert.equal(result.currentPlayer, 'Babylon');
  assert.equal(result.turn, 87);
  assert.equal(result.source, 'jsons');
  assert.ok(result.updatedAt);
});

test('playerTurn 인덱스 기반 파싱', () => {
  const payload = {
    gameId: '22222222-2222-2222-2222-222222222222',
    playerTurn: 1,
    civilizations: [{ civName: 'Korea' }, { civName: 'Rome' }, { civName: 'Maya' }],
    turns: 12,
  };

  const result = extractTurnLookupFromPayload(payload, {
    requestedGameId: payload.gameId,
    resolvedGameId: payload.gameId,
    source: 'jsons',
  });

  assert.equal(result.currentPlayer, 'Rome');
  assert.equal(result.turn, 12);
});


test('/files base64+gzip 응답 디코딩', () => {
  const original = {
    gameId: '33333333-3333-3333-3333-333333333333',
    currentPlayer: 'Egypt',
    turns: 99,
  };

  const packed = toPackedSave(original);
  const decoded = decodeUncivFileBody(packed) as { currentPlayer: string; turns: number };

  assert.equal(decoded.currentPlayer, 'Egypt');
  assert.equal(decoded.turns, 99);
});

test('파싱 실패 케이스', () => {
  const payload = {
    gameId: '44444444-4444-4444-4444-444444444444',
    civilizations: [{ civName: 'Zulu' }],
  };

  assert.throws(
    () =>
      extractTurnLookupFromPayload(payload, {
        requestedGameId: payload.gameId,
        resolvedGameId: payload.gameId,
        source: 'jsons',
      }),
    error => error instanceof AppError && error.code === 'PARSE_FAILED'
  );
});

test('/jsons 응답 JSON 파싱', () => {
  const raw = JSON.stringify({
    gameId: '55555555-5555-5555-5555-555555555555',
    currentPlayer: 'Japan',
  });

  const parsed = parseJsonEndpointBody(raw) as { currentPlayer: string };
  assert.equal(parsed.currentPlayer, 'Japan');
});
