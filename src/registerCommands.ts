import { REST, Routes } from 'discord.js';
import { commandJson } from './commands/index.js';
import { requireRegistrationEnv } from './config/env.js';
import { logger } from './config/logger.js';

const registerCommands = async (): Promise<void> => {
  const { discordToken, clientId, guildId } = requireRegistrationEnv();
  const rest = new REST({ version: '10' }).setToken(discordToken);

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commandJson,
    });
    logger.info(`길드 명령어 등록 완료 (guildId=${guildId})`);
    return;
  }

  logger.warn('DISCORD_GUILD_ID가 없거나 유효하지 않아 글로벌 명령어로 등록합니다. 반영에 최대 1시간 걸릴 수 있습니다.');
  await rest.put(Routes.applicationCommands(clientId), {
    body: commandJson,
  });
  logger.info('글로벌 명령어 등록 완료');
};

registerCommands().catch(error => {
  logger.error('명령어 등록 실패', error);
  process.exitCode = 1;
});
