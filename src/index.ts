import { Client, Events, GatewayIntentBits } from 'discord.js';
import { commandMap } from './commands/index.js';
import { requireRuntimeEnv } from './config/env.js';
import { logger } from './config/logger.js';
import { createUncivTurnService } from './services/uncivTurnService.js';

const { discordToken } = requireRuntimeEnv();
const turnService = createUncivTurnService();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, readyClient => {
  logger.info(`Discord 봇 로그인 완료: ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = commandMap.get(interaction.commandName);
  if (!command) {
    await interaction.reply({
      content: '알 수 없는 명령어입니다.',
      ephemeral: true,
    });
    return;
  }

  try {
    await command.execute(interaction, { turnService });
  } catch (error) {
    logger.error('명령어 처리 중 예외', error);

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply('명령어 처리 중 예외가 발생했습니다.').catch(() => {
        // empty
      });
      return;
    }

    await interaction
      .reply({
        content: '명령어 처리 중 예외가 발생했습니다.',
        ephemeral: true,
      })
      .catch(() => {
        // empty
      });
  }
});

process.on('unhandledRejection', error => {
  logger.error('Unhandled Rejection', error);
});

process.on('uncaughtException', error => {
  logger.error('Uncaught Exception', error);
});

client.login(discordToken).catch(error => {
  logger.error('Discord 로그인 실패', error);
  process.exitCode = 1;
});
