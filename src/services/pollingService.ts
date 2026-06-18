import type { Client } from 'discord.js';
import { logger } from '../config/logger.js';
import { dbService } from './dbService.js';
import type { UncivTurnService } from './uncivTurnService.js';

let pollingInterval: NodeJS.Timeout | null = null;
const REMINDER_INTERVAL_MS = 60 * 60 * 1000;

const getKstHour = (date: Date): number => (date.getUTCHours() + 9) % 24;

const sendChannelMessage = async (client: Client, channelId: string, message: string): Promise<void> => {
  const channel = await client.channels.fetch(channelId);
  if (channel && channel.isTextBased()) {
    await (channel as any).send(message);
    return;
  }
  logger.warn(`채널(${channelId})이 텍스트 채널이 아니거나 접근할 수 없습니다.`);
};

export const startPolling = (
  client: Client,
  turnService: UncivTurnService,
  intervalMs = 60_000
): void => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  logger.info(`Unciv 턴 상태 폴링을 시작합니다. 주기: ${intervalMs / 1000}초`);

  pollingInterval = setInterval(async () => {
    try {
      const links = dbService.getAllLinks();
      if (links.length === 0) {
        return;
      }

      logger.debug(`총 ${links.length}개의 연동된 채널 폴링 중...`);

      for (const link of links) {
        try {
          const result = await turnService.lookup(link.gameId);

          const lastPlayer = link.lastPlayer;
          const lastTurn = link.lastTurn;

          // 턴 진행 또는 플레이어 변경 감지
          const isPlayerChanged = lastPlayer !== undefined && lastPlayer !== result.currentPlayer;
          const isTurnChanged = lastTurn !== undefined && result.turn !== undefined && lastTurn !== result.turn;

          if (isPlayerChanged || isTurnChanged) {
            logger.info(
              `턴 변경 감지 [채널: ${link.channelId}, 게임: ${link.gameId}]: ` +
              `이전(${lastPlayer}, 턴 ${lastTurn}) -> 현재(${result.currentPlayer}, 턴 ${result.turn})`
            );

            const mappedUserId = link.players[result.currentPlayer];
            const playerDisplay = mappedUserId ? `<@${mappedUserId}>` : `**${result.currentPlayer}**`;

            const msg = `${playerDisplay} ㅌㄴㄱ`;

            // 디스코드 채널로 메시지 전송
            try {
              await sendChannelMessage(client, link.channelId, msg);
            } catch (error) {
              logger.error(`채널(${link.channelId})에 알림 메시지 전송 중 오류 발생:`, error);
            }
          } else {
            const now = new Date();
            const reminderBase = link.lastReminderAt ?? link.turnStartedAt;
            const reminderDue = reminderBase
              ? now.getTime() - new Date(reminderBase).getTime() >= REMINDER_INTERVAL_MS
              : false;
            const isQuietHours = getKstHour(now) < 8;
            const mappedUserId = link.players[result.currentPlayer];

            if (reminderDue && !isQuietHours && mappedUserId) {
              const reminder = (link.reminderCount ?? 0) === 0 ? '턴언넘' : '턴빨넘';
              try {
                await sendChannelMessage(client, link.channelId, `<@${mappedUserId}> ${reminder}`);
                dbService.updateReminderState(link.channelId, now.toISOString());
              } catch (error) {
                logger.error(`채널(${link.channelId})에 재촉 메시지 전송 중 오류 발생:`, error);
              }
            }
          }

          // 상태가 변경되었거나 최초 기록인 경우 DB 업데이트
          if (lastPlayer !== result.currentPlayer || lastTurn !== result.turn || !link.turnStartedAt) {
            dbService.updateLastKnownState(link.channelId, result.turn, result.currentPlayer);
          }
        } catch (error) {
          logger.warn(`게임 ID ${link.gameId} 조회 중 오류 발생 (채널: ${link.channelId}):`, error);
        }
      }
    } catch (error) {
      logger.error('폴링 루프 실행 중 예상치 못한 예외 발생:', error);
    }
  }, intervalMs);
};

export const stopPolling = (): void => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    logger.info('Unciv 턴 상태 폴링을 중지했습니다.');
  }
};
