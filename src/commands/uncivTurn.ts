import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { logger } from '../config/logger.js';
import { formatIsoToKstLabel, formatIsoWithElapsedLabel } from '../utils/dateDisplay.js';
import { toUserErrorMessage } from '../utils/errorMessage.js';
import type { SlashCommandModule } from './types.js';

const commandData = new SlashCommandBuilder()
  .setName('차례')
  .setDescription('Unciv 멀티플레이 현재 차례를 조회합니다.')
  .setDescriptionLocalizations({ ko: 'Unciv 멀티플레이 현재 차례를 조회합니다.' })
  .addStringOption(option =>
    option
      .setName('gameid')
      .setDescription('조회할 Unciv 게임 ID')
      .setDescriptionLocalizations({ ko: '조회할 Unciv 게임 ID' })
      .setRequired(true)
  );

const inferUpdatedAtLabel = (matchedUpdatedAtField: string | undefined): string => {
  if (!matchedUpdatedAtField) return '마지막 갱신 추정';
  if (/currentTurnStartTime|lastTurnTimestamp/i.test(matchedUpdatedAtField)) {
    return '현재 턴 시작 추정';
  }
  return '마지막 갱신 추정';
};

const formatTurnMessage = (result: {
  resolvedGameId: string;
  currentPlayer: string;
  turn?: number;
  updatedAt?: string;
  checkedAt: string;
  matchedUpdatedAtField?: string;
}): string => {
  const checkedAtLabel = formatIsoToKstLabel(result.checkedAt);
  const updatedAtLabel = inferUpdatedAtLabel(result.matchedUpdatedAtField);

  const lines = [
    `게임 ID: ${result.resolvedGameId}`,
    `현재 차례: ${result.currentPlayer}`,
    `현재 턴: ${result.turn ?? '알 수 없음'}`,
    result.updatedAt ? `${updatedAtLabel}: ${formatIsoWithElapsedLabel(result.updatedAt, result.checkedAt)}` : undefined,
    `조회 시각: ${checkedAtLabel}`,
  ].filter((line): line is string => typeof line === 'string');

  return lines.join('\n');
};

export const uncivTurnCommand: SlashCommandModule = {
  data: commandData,

  async execute(interaction: ChatInputCommandInteraction, context) {
    const gameId = interaction.options.getString('gameid', true);

    await interaction.deferReply();

    try {
      const result = await context.turnService.lookup(gameId);
      await interaction.editReply(formatTurnMessage(result));
    } catch (error) {
      logger.warn('/차례 처리 중 오류', error);
      await interaction.editReply(toUserErrorMessage(error));
    }
  },
};
