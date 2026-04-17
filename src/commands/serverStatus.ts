import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { logger } from '../config/logger.js';
import { formatIsoToKstLabel } from '../utils/dateDisplay.js';
import { toUserErrorMessage } from '../utils/errorMessage.js';
import type { SlashCommandModule } from './types.js';

const commandData = new SlashCommandBuilder()
  .setName('서버상태')
  .setDescription('Unciv 서버의 공개 상태 버전을 확인합니다.')
  .setDescriptionLocalizations({ ko: 'Unciv 서버의 공개 상태 버전을 확인합니다.' });

const formatServerStatusMessage = (result: {
  authVersion: number;
  chatVersion: number;
  checkedAt: string;
}): string => {
  const checkedAtLabel = formatIsoToKstLabel(result.checkedAt);

  const lines = [
    'Unciv 서버 상태',
    `authVersion: ${result.authVersion}`,
    `chatVersion: ${result.chatVersion}`,
    `조회 시각: ${checkedAtLabel}`,
  ];

  return lines.join('\n');
};

export const serverStatusCommand: SlashCommandModule = {
  data: commandData,

  async execute(interaction: ChatInputCommandInteraction, context) {
    await interaction.deferReply();

    try {
      const result = await context.turnService.getServerStatus();
      await interaction.editReply(formatServerStatusMessage(result));
    } catch (error) {
      logger.warn('/서버상태 처리 중 오류', error);
      await interaction.editReply(toUserErrorMessage(error));
    }
  },
};
