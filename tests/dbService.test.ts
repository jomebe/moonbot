import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { DbService } from '../src/services/dbService.js';

const tempDbPath = path.join(process.cwd(), 'tests', 'temp_db.json');

before(() => {
  // Ensure the temp db file is deleted if it exists
  if (fs.existsSync(tempDbPath)) {
    fs.unlinkSync(tempDbPath);
  }
});

after(() => {
  // Clean up the temp db file
  if (fs.existsSync(tempDbPath)) {
    fs.unlinkSync(tempDbPath);
  }
});

test('DbService - 초기 파일 생성 및 로드', () => {
  const db = new DbService(tempDbPath);
  const data = db.load();

  assert.deepEqual(data, { channels: {} });
  assert.ok(fs.existsSync(tempDbPath));
});

test('DbService - 게임 연동 등록 및 해제', () => {
  const db = new DbService(tempDbPath);
  const channelId = 'test-channel-1';
  const gameId = '12345678-1234-1234-1234-1234567890ab';

  db.setLink(channelId, gameId, 1, 'Babylon');

  const link = db.getLink(channelId);
  assert.ok(link);
  assert.equal(link.channelId, channelId);
  assert.equal(link.gameId, gameId);
  assert.equal(link.lastTurn, 1);
  assert.equal(link.lastPlayer, 'Babylon');
  assert.deepEqual(link.players, {});

  // 연동 해제
  const unlinked = db.unlink(channelId);
  assert.equal(unlinked, true);

  const linkAfter = db.getLink(channelId);
  assert.equal(linkAfter, undefined);

  // 없는 연동 해제 시도
  const unlinkedFailed = db.unlink(channelId);
  assert.equal(unlinkedFailed, false);
});

test('DbService - 플레이어 연동 및 해제', () => {
  const db = new DbService(tempDbPath);
  const channelId = 'test-channel-2';
  const gameId = '87654321-4321-4321-4321-8765432109ba';

  db.setLink(channelId, gameId);

  // 플레이어 등록
  db.registerPlayer(channelId, 'Babylon', 'discord-user-123');

  let link = db.getLink(channelId);
  assert.ok(link);
  assert.equal(link.players['Babylon'], 'discord-user-123');

  // 플레이어 해제
  const unregistered = db.unregisterPlayer(channelId, 'Babylon');
  assert.equal(unregistered, true);

  link = db.getLink(channelId);
  assert.ok(link);
  assert.equal(link.players['Babylon'], undefined);

  // 없는 플레이어 해제 시도
  const unregisteredFailed = db.unregisterPlayer(channelId, 'Babylon');
  assert.equal(unregisteredFailed, false);
});

test('DbService - 상태 업데이트', () => {
  const db = new DbService(tempDbPath);
  const channelId = 'test-channel-3';
  const gameId = '11111111-2222-3333-4444-555555555555';

  db.setLink(channelId, gameId, 10, 'Korea');

  db.updateLastKnownState(channelId, 11, 'Rome');

  const link = db.getLink(channelId);
  assert.ok(link);
  assert.equal(link.lastTurn, 11);
  assert.equal(link.lastPlayer, 'Rome');
});
