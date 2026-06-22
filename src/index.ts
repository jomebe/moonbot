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
import { dbService } from './services/dbService.js';

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

// 메시지 리스너 (제거 / 빨넘 명령어 대응)
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  const content = message.content.trim();
  const botMention = client.user ? `<@${client.user.id}>` : '';
  const cleanContent = botMention ? content.replace(botMention, '').trim() : content;

  // 1. '제거' 단어가 메시지에 포함되어 있는지 검사 (멘션 후 제거 포함)
  const isRemoveTrigger =
    content.includes('제거') ||
    cleanContent.includes('제거');

  if (isRemoveTrigger) {
    const CREATOR_ID = '820221944728780840';

    // 1-1. DM 채널인 경우
    if (message.channel.type === ChannelType.DM) {
      if (message.author.id !== CREATOR_ID) {
        await message.reply(
          '❌ DM을 통한 전체 서버 퇴장 관리 기능은 봇 관리자만 사용할 수 있습니다. ' +
          '서버 채널에서 "제거" 또는 "/제거"를 입력하여 퇴장시켜 주세요.'
        );
        return;
      }

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
      return;
    }

    // 1-2. 서버 채널인 경우 (누구나 사용 가능)
    const guild = message.guild;
    if (guild) {
      try {
        logger.info(
          `메시지 요청에 의해 서버 퇴장 시도: ${guild.name} (ID: ${guild.id}, 요청자: ${message.author.tag})`
        );
        await message.reply(`👋 요청으로 **${guild.name}** 서버에서 퇴장합니다. 이용해 주셔서 감사합니다.`);
        await guild.leave();
      } catch (error) {
        logger.error(`서버 퇴장 중 오류 발생 (${guild.name}):`, error);
        await message.reply('❌ 서버 퇴장 처리 중 오류가 발생했습니다.').catch(() => {});
      }
    }
    return;
  }

  // 2. '빨넘' 단어가 메시지에 포함되어 있는지 검사 (멘션 후 빨넘 포함)
  const isNudgeTrigger =
    content.includes('빨넘') ||
    cleanContent.includes('빨넘');

  if (isNudgeTrigger) {
    const channelId = message.channelId;
    const link = dbService.getLink(channelId);
    if (!link) {
      // 직접 정확하게 부른 경우에만 안내합니다.
      const isExactCommand =
        content === '빨넘' ||
        content === '/빨넘' ||
        cleanContent === '빨넘' ||
        cleanContent === '/빨넘';

      if (isExactCommand) {
        await message.reply('❌ 이 채널에 연동된 Unciv 게임이 없습니다. 먼저 `/연동 [gameId]` 명령어로 게임을 연동해 주세요.');
      }
      return;
    }

    try {
      const result = await turnService.lookup(link.gameId);
      const mappedUserId = link.players[result.currentPlayer];

      if (mappedUserId) {
        await message.reply(
          `<@${mappedUserId}> 빨리넘겨시발\n` +
          `*(현재 차례: **${result.currentPlayer}** / 턴: **${result.turn ?? '알 수 없음'}**)*`
        );
      } else {
        await message.reply(
          `**${result.currentPlayer}** 빨리넘겨시발\n` +
          `*(등록된 디스코드 유저가 없어 멘션을 보낼 수 없습니다. \`/등록\` 명령어로 유저를 연결해주세요. / 턴: **${result.turn ?? '알 수 없음'}**)*`
        );
      }
    } catch (error) {
      logger.warn('메시지 기반 /빨넘 처리 중 오류', error);
      const isExactCommand =
        content === '빨넘' ||
        content === '/빨넘' ||
        cleanContent === '빨넘' ||
        cleanContent === '/빨넘';

      if (isExactCommand) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await message.reply(`❌ 조회 실패: ${errorMsg}`);
      }
    }
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

  // Autocomplete 처리
  if (interaction.isAutocomplete()) {
    const command = commandMap.get(interaction.commandName);
    if (command && command.autocomplete) {
      try {
        await command.autocomplete(interaction, { turnService });
      } catch (error) {
        logger.error('Autocomplete 처리 중 예외', error);
      }
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
