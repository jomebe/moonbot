import type { Client } from 'discord.js';
import { logger } from '../config/logger.js';
import { dbService } from './dbService.js';
import type { UncivTurnService } from './uncivTurnService.js';

let pollingInterval: NodeJS.Timeout | null = null;

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
            const playerDisplay = mappedUserId ? `<@${mappedUserId}> 님` : `**${result.currentPlayer}**`;

            let msg = `🔔 **[Unciv 턴 알림]**\n`;
            if (lastPlayer) {
              msg += `이전 플레이어(**${lastPlayer}**)가 턴을 넘겼습니다!\n`;
            } else {
              msg += `턴이 업데이트되었습니다!\n`;
            }
            msg += `다음 차례: ${playerDisplay}\n`;
            msg += `- 게임 ID: \`${result.resolvedGameId}\`\n`;
            if (result.turn !== undefined) {
              msg += `- 현재 턴: **${result.turn}**`;
            }

            // 디스코드 채널로 메시지 전송
            try {
              const channel = await client.channels.fetch(link.channelId);
              if (channel && channel.isTextBased()) {
                await (channel as any).send(msg);
              } else {
                logger.warn(`채널(${link.channelId})이 텍스트 채널이 아니거나 접근할 수 없습니다.`);
              }
            } catch (error) {
              logger.error(`채널(${link.channelId})에 알림 메시지 전송 중 오류 발생:`, error);
            }
          }

          // 상태가 변경되었거나 최초 기록인 경우 DB 업데이트
          if (lastPlayer !== result.currentPlayer || lastTurn !== result.turn) {
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
