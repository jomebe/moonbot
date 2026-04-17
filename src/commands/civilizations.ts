import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { logger } from '../config/logger.js';
import { formatIsoToKstLabel } from '../utils/dateDisplay.js';
import { toUserErrorMessage } from '../utils/errorMessage.js';
import type { SlashCommandModule } from './types.js';

const commandData = new SlashCommandBuilder()
  .setName('문명목록')
  .setDescription('게임의 문명 목록과 인간 문명 목록을 조회합니다.')
  .setDescriptionLocalizations({ ko: '게임의 문명 목록과 인간 문명 목록을 조회합니다.' })
  .addStringOption(option =>
    option
      .setName('gameid')
      .setDescription('조회할 Unciv 게임 ID')
      .setDescriptionLocalizations({ ko: '조회할 Unciv 게임 ID' })
      .setRequired(true)
  );

const formatList = (values: string[]): string => {
  if (values.length === 0) return '없음';
  return values.join(', ');
};

const formatMessage = (result: {
  resolvedGameId: string;
  civilizations: string[];
  humanCivilizations: string[];
  checkedAt: string;
}): string => {
  const checkedAtLabel = formatIsoToKstLabel(result.checkedAt);

  const lines = [
    `게임 ID: ${result.resolvedGameId}`,
    `전체 문명 (${result.civilizations.length}): ${formatList(result.civilizations)}`,
    `인간 문명 (${result.humanCivilizations.length}): ${formatList(result.humanCivilizations)}`,
    `조회 시각: ${checkedAtLabel}`,
  ];

  return lines.join('\n');
};

export const civilizationsCommand: SlashCommandModule = {
  data: commandData,

  async execute(interaction: ChatInputCommandInteraction, context) {
    const gameId = interaction.options.getString('gameid', true);

    await interaction.deferReply();

    try {
      const result = await context.turnService.lookupSummary(gameId);
      await interaction.editReply(formatMessage(result));
    } catch (error) {
      logger.warn('/문명목록 처리 중 오류', error);
      await interaction.editReply(toUserErrorMessage(error));
    }
  },
};
