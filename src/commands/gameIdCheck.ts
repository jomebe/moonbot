import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommandModule } from './types.js';

const GAME_ID_REGEX = /^[\da-f]{8}-([\da-f]{4}-){3}[\da-f]{12}(_Preview)?$/i;

const normalizeGameId = (rawGameId: string): string => {
  const trimmed = rawGameId.trim();
  const hasPreviewSuffix = /_preview$/i.test(trimmed);
  const base = hasPreviewSuffix ? trimmed.slice(0, -8) : trimmed;
  const normalizedBase = base.toLowerCase();
  return `${normalizedBase}${hasPreviewSuffix ? '_Preview' : ''}`;
};

const buildCandidateGameIds = (gameId: string): string[] => {
  const candidates = new Set<string>();
  candidates.add(gameId);

  if (gameId.endsWith('_Preview')) {
    candidates.add(gameId.slice(0, -8));
  } else {
    candidates.add(`${gameId}_Preview`);
  }

  return [...candidates];
};

const commandData = new SlashCommandBuilder()
  .setName('아이디검증')
  .setDescription('gameId 형식과 정규화 결과를 확인합니다.')
  .setDescriptionLocalizations({ ko: 'gameId 형식과 정규화 결과를 확인합니다.' })
  .addStringOption(option =>
    option
      .setName('gameid')
      .setDescription('검증할 Unciv 게임 ID')
      .setDescriptionLocalizations({ ko: '검증할 Unciv 게임 ID' })
      .setRequired(true)
  );

const formatMessage = (rawGameId: string): string => {
  const normalized = normalizeGameId(rawGameId);
  const isValid = GAME_ID_REGEX.test(normalized);
  const candidates = buildCandidateGameIds(normalized);

  const lines = [
    `입력 값: ${rawGameId}`,
    `정규화 값: ${normalized}`,
    `형식 검사: ${isValid ? '통과' : '실패'}`,
    `조회 후보: ${candidates.join(', ')}`,
    '허용 형식: UUID 또는 UUID_Preview',
  ];

  return lines.join('\n');
};

export const gameIdCheckCommand: SlashCommandModule = {
  data: commandData,

  async execute(interaction: ChatInputCommandInteraction) {
    const gameId = interaction.options.getString('gameid', true);
    await interaction.reply(formatMessage(gameId));
  },
};
