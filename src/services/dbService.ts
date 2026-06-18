import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../config/logger.js';

export interface LinkedChannel {
  channelId: string;
  gameId: string;
  players: Record<string, string>; // Maps Unciv player/civ name -> Discord user ID
  lastTurn?: number | undefined;
  lastPlayer?: string | undefined;
  turnStartedAt?: string | undefined;
  lastReminderAt?: string | undefined;
  reminderCount?: number | undefined;
}

export interface DatabaseSchema {
  channels: Record<string, LinkedChannel>;
}

export class DbService {
  private readonly dbPath: string;

  constructor(customPath?: string) {
    this.dbPath = customPath ?? path.join(process.cwd(), 'data', 'db.json');
  }

  private ensureDirectoryAndFile(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.dbPath)) {
      const initialData: DatabaseSchema = { channels: {} };
      fs.writeFileSync(this.dbPath, JSON.stringify(initialData, null, 2), 'utf8');
    }
  }

  load(): DatabaseSchema {
    try {
      this.ensureDirectoryAndFile();
      const content = fs.readFileSync(this.dbPath, 'utf8');
      return JSON.parse(content) as DatabaseSchema;
    } catch (error) {
      logger.error('데이터베이스 파일 읽기 실패, 초기화합니다.', error);
      return { channels: {} };
    }
  }

  save(data: DatabaseSchema): void {
    try {
      this.ensureDirectoryAndFile();
      fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      logger.error('데이터베이스 파일 저장 실패', error);
    }
  }

  getLink(channelId: string): LinkedChannel | undefined {
    const db = this.load();
    return db.channels[channelId];
  }

  setLink(channelId: string, gameId: string, lastTurn?: number | undefined, lastPlayer?: string | undefined): void {
    const db = this.load();
    const existing = db.channels[channelId];
    db.channels[channelId] = {
      channelId,
      gameId,
      players: existing?.players ?? {},
      lastTurn: lastTurn !== undefined ? lastTurn : (existing?.lastTurn !== undefined ? existing.lastTurn : undefined),
      lastPlayer: lastPlayer !== undefined ? lastPlayer : (existing?.lastPlayer !== undefined ? existing.lastPlayer : undefined),
      turnStartedAt: existing?.turnStartedAt ?? new Date().toISOString(),
      lastReminderAt: existing?.lastReminderAt,
      reminderCount: existing?.reminderCount ?? 0,
    };
    this.save(db);
  }

  unlink(channelId: string): boolean {
    const db = this.load();
    if (!db.channels[channelId]) {
      return false;
    }
    delete db.channels[channelId];
    this.save(db);
    return true;
  }

  registerPlayer(channelId: string, playerName: string, userId: string): void {
    const db = this.load();
    const channel = db.channels[channelId];
    if (!channel) {
      throw new Error('이 채널에 연동된 게임이 없습니다. 먼저 /연동 명령어를 사용해주세요.');
    }
    channel.players[playerName] = userId;
    this.save(db);
  }

  unregisterPlayer(channelId: string, playerName: string): boolean {
    const db = this.load();
    const channel = db.channels[channelId];
    if (!channel || !channel.players[playerName]) {
      return false;
    }
    delete channel.players[playerName];
    this.save(db);
    return true;
  }

  getAllLinks(): LinkedChannel[] {
    const db = this.load();
    return Object.values(db.channels);
  }

  updateLastKnownState(channelId: string, lastTurn?: number | undefined, lastPlayer?: string | undefined): void {
    const db = this.load();
    const channel = db.channels[channelId];
    if (channel) {
      channel.lastTurn = lastTurn;
      channel.lastPlayer = lastPlayer;
      channel.turnStartedAt = new Date().toISOString();
      channel.lastReminderAt = undefined;
      channel.reminderCount = 0;
      this.save(db);
    }
  }

  updateReminderState(channelId: string, sentAt: string): void {
    const db = this.load();
    const channel = db.channels[channelId];
    if (channel) {
      channel.lastReminderAt = sentAt;
      channel.reminderCount = (channel.reminderCount ?? 0) + 1;
      this.save(db);
    }
  }
}

export const dbService = new DbService();
