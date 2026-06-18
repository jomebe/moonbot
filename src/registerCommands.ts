import { REST, Routes } from 'discord.js';
import { commandJson } from './commands/index.js';
import { requireRegistrationEnv } from './config/env.js';
import { logger } from './config/logger.js';

const registerCommands = async (): Promise<void> => {
  const { discordToken, clientId, guildId } = requireRegistrationEnv();
  const rest = new REST({ version: '10' }).setToken(discordToken);

  logger.info('글로벌 슬래시 명령어 등록을 시작합니다...');
  await rest.put(Routes.applicationCommands(clientId), {
    body: commandJson,
  });
  logger.info('글로벌 슬래시 명령어 등록 완료');

  if (guildId) {
    logger.info(`개발용 길드 ID(${guildId})가 감지되어 해당 길드에도 슬래시 명령어를 즉시 반영 등록합니다.`);
    try {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commandJson,
      });
      logger.info(`개발용 길드 슬래시 명령어 등록 완료 (guildId=${guildId})`);
    } catch (error) {
      logger.warn(`개발용 길드 슬래시 명령어 등록 중 오류 발생 (guildId=${guildId}):`, error);
    }
  }
};

registerCommands().catch(error => {
  logger.error('명령어 등록 실패', error);
  process.exitCode = 1;
});
