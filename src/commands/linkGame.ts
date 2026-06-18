import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { logger } from '../config/logger.js';
import { dbService } from '../services/dbService.js';
import { toUserErrorMessage } from '../utils/errorMessage.js';
import type { SlashCommandModule } from './types.js';

const commandData = new SlashCommandBuilder()
  .setName('연동')
  .setDescription('이 채널에 Unciv 게임 ID를 연동합니다.')
  .setDescriptionLocalizations({ ko: '이 채널에 Unciv 게임 ID를 연동합니다.' })
  .addStringOption(option =>
    option
      .setName('gameid')
      .setDescription('연동할 Unciv 게임 ID')
      .setDescriptionLocalizations({ ko: '연동할 Unciv 게임 ID' })
      .setRequired(true)
  );

export const linkGameCommand: SlashCommandModule = {
  data: commandData,

  async execute(interaction: ChatInputCommandInteraction, context) {
    const gameId = interaction.options.getString('gameid', true);
    const channelId = interaction.channelId;

    await interaction.deferReply();

    try {
      // Unciv 서버에서 해당 게임 ID가 존재하는지 및 현재 상태 조회 시도
      const result = await context.turnService.lookup(gameId);

      // 연동 저장 (현재 턴과 플레이어도 함께 초기화하여 저장함으로써 첫 폴링 때 중복 알림 방지)
      dbService.setLink(channelId, result.resolvedGameId, result.turn, result.currentPlayer);

      await interaction.editReply(
        `✅ **Unciv 게임 연동 성공!**\n` +
        `- 게임 ID: \`${result.resolvedGameId}\`\n` +
        `- 현재 차례: **${result.currentPlayer}**\n` +
        `- 현재 턴: **${result.turn ?? '알 수 없음'}**\n\n` +
        `이제 이 채널에서 턴이 바뀔 때마다 알림이 전송됩니다. 플레이어 이름과 디스코드 유저를 매핑하려면 \`/등록\` 명령어를 사용해주세요.`
      );
    } catch (error) {
      logger.warn('/연동 처리 중 오류', error);
      await interaction.editReply(`❌ **연동 실패:** ${toUserErrorMessage(error)}`);
    }
  },
};
