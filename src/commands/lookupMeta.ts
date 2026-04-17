import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { logger } from '../config/logger.js';
import { formatIsoToKstLabel } from '../utils/dateDisplay.js';
import { toUserErrorMessage } from '../utils/errorMessage.js';
import type { SlashCommandModule } from './types.js';

const commandData = new SlashCommandBuilder()
  .setName('조회메타')
  .setDescription('조회에 사용된 엔드포인트와 매칭 필드 정보를 보여줍니다.')
  .setDescriptionLocalizations({ ko: '조회에 사용된 엔드포인트와 매칭 필드 정보를 보여줍니다.' })
  .addStringOption(option =>
    option
      .setName('gameid')
      .setDescription('조회할 Unciv 게임 ID')
      .setDescriptionLocalizations({ ko: '조회할 Unciv 게임 ID' })
      .setRequired(true)
  );

const valueOrUnknown = (value: string | undefined): string => value ?? '미탐지';

const formatMessage = (result: {
  requestedGameId: string;
  resolvedGameId: string;
  source: 'jsons' | 'files';
  matchedPlayerField: string;
  matchedTurnField?: string;
  matchedUpdatedAtField?: string;
  matchedCivilizationsField?: string;
  checkedAt: string;
}): string => {
  const checkedAtLabel = formatIsoToKstLabel(result.checkedAt);

  const lines = [
    `요청 ID: ${result.requestedGameId}`,
    `해석 ID: ${result.resolvedGameId}`,
    `사용 소스: /${result.source}`,
    `현재 차례 필드: ${result.matchedPlayerField}`,
    `턴 필드: ${valueOrUnknown(result.matchedTurnField)}`,
    `시간 필드: ${valueOrUnknown(result.matchedUpdatedAtField)}`,
    `문명 배열 필드: ${valueOrUnknown(result.matchedCivilizationsField)}`,
    `조회 시각: ${checkedAtLabel}`,
  ];

  return lines.join('\n');
};

export const lookupMetaCommand: SlashCommandModule = {
  data: commandData,

  async execute(interaction: ChatInputCommandInteraction, context) {
    const gameId = interaction.options.getString('gameid', true);

    await interaction.deferReply();

    try {
      const result = await context.turnService.lookupSummary(gameId);
      await interaction.editReply(formatMessage(result));
    } catch (error) {
      logger.warn('/조회메타 처리 중 오류', error);
      await interaction.editReply(toUserErrorMessage(error));
    }
  },
};
