import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { logger } from '../config/logger.js';
import { dbService } from '../services/dbService.js';
import { toUserErrorMessage } from '../utils/errorMessage.js';
import type { SlashCommandModule } from './types.js';

const commandData = new SlashCommandBuilder()
  .setName('빨넘')
  .setDescription('현재 차례인 플레이어에게 빨리 턴을 넘기라고 재촉합니다.')
  .setDescriptionLocalizations({ ko: '현재 차례인 플레이어에게 빨리 턴을 넘기라고 재촉합니다.' });

export const fastPassCommand: SlashCommandModule = {
  data: commandData,

  async execute(interaction: ChatInputCommandInteraction, context) {
    const channelId = interaction.channelId;

    const link = dbService.getLink(channelId);
    if (!link) {
      await interaction.reply({
        content: '❌ 이 채널에 연동된 Unciv 게임이 없습니다. 먼저 \`/연동\` 명령어로 게임을 연동해주세요.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const result = await context.turnService.lookup(link.gameId);
      const mappedUserId = link.players[result.currentPlayer];

      if (mappedUserId) {
        await interaction.editReply(
          `<@${mappedUserId}> 빨리넘겨시발\n` +
          `*(현재 차례: **${result.currentPlayer}** / 턴: **${result.turn ?? '알 수 없음'}**)*`
        );
      } else {
        await interaction.editReply(
          `**${result.currentPlayer}** 빨리넘겨시발\n` +
          `*(등록된 디스코드 유저가 없어 멘션을 보낼 수 없습니다. \`/등록\` 명령어로 유저를 연결해주세요. / 턴: **${result.turn ?? '알 수 없음'}**)*`
        );
      }
    } catch (error) {
      logger.warn('/빨넘 처리 중 오류', error);
      await interaction.editReply(`❌ 조회 실패: ${toUserErrorMessage(error)}`);
    }
  },
};
