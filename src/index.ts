import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  ChannelType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { commandMap } from './commands/index.js';
import { requireRuntimeEnv } from './config/env.js';
import { logger } from './config/logger.js';
import { createUncivTurnService } from './services/uncivTurnService.js';
import { startPolling } from './services/pollingService.js';

const { discordToken } = requireRuntimeEnv();
const turnService = createUncivTurnService();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, readyClient => {
  logger.info(`Discord 봇 로그인 완료: ${readyClient.user.tag}`);
  startPolling(readyClient, turnService);
});

// DM 제거 메시지 리스너 (명령어 형태 또는 단순 메시지로 전송 시 작동)
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  const CREATOR_ID = '820221944728780840';
  if (message.author.id !== CREATOR_ID) return;

  // DM 채널인지 검증
  if (message.channel.type !== ChannelType.DM) return;

  const content = message.content.trim();
  if (content === '제거' || content === '/제거') {
    const guilds = client.guilds.cache;
    if (guilds.size === 0) {
      await message.reply('현재 참여 중인 서버가 없습니다.');
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('leave-guild-select')
      .setPlaceholder('퇴장할 서버를 선택하세요')
      .addOptions(
        guilds
          .map(guild => ({
            label: guild.name.slice(0, 100),
            description: `ID: ${guild.id}`,
            value: guild.id,
          }))
          .slice(0, 25)
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await message.reply({
      content: '퇴장하고 싶은 서버를 선택해주세요:',
      components: [row],
    });
  }
});

client.on(Events.InteractionCreate, async interaction => {
  // 셀렉트 메뉴 선택 이벤트 처리
  if (interaction.isStringSelectMenu() && interaction.customId === 'leave-guild-select') {
    const CREATOR_ID = '820221944728780840';
    if (interaction.user.id !== CREATOR_ID) {
      await interaction.reply({
        content: '❌ 제작자만 이 작업을 수행할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    const guildId = interaction.values[0];
    if (!guildId) {
      await interaction.reply({
        content: '❌ 선택된 서버가 올바르지 않습니다.',
        ephemeral: true,
      });
      return;
    }
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      await interaction.reply({
        content: '❌ 해당 서버를 찾을 수 없거나 이미 퇴장했습니다.',
        ephemeral: true,
      });
      return;
    }

    try {
      await interaction.reply({
        content: `👋 **${guild.name}** 서버에서 퇴장합니다...`,
      });
      await guild.leave();
    } catch (error) {
      logger.error(`서버 퇴장 중 오류 발생 (${guild.name}):`, error);
      await interaction.followUp({
        content: '❌ 서버 퇴장 처리 중 오류가 발생했습니다.',
        ephemeral: true,
      }).catch(() => {});
    }
    return;
  }

  // 기존 슬래시 명령어 처리
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
