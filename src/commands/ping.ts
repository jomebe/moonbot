import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { formatIsoToKstLabel } from '../utils/dateDisplay.js';
import type { SlashCommandModule } from './types.js';

const commandData = new SlashCommandBuilder()
  .setName('핑')
  .setDescription('봇 응답 지연 시간을 확인합니다.')
  .setDescriptionLocalizations({ ko: '봇 응답 지연 시간을 확인합니다.' });

const formatMessage = (values: {
  apiLatencyMs: number;
  wsPingMs: number;
  checkedAt: string;
}): string => {
  const checkedAtLabel = formatIsoToKstLabel(values.checkedAt);

  const lines = [
    '봇 상태',
    `응답 지연: ${values.apiLatencyMs}ms`,
    `게이트웨이 지연: ${values.wsPingMs}ms`,
    `조회 시각: ${checkedAtLabel}`,
  ];

  return lines.join('\n');
};

export const pingCommand: SlashCommandModule = {
  data: commandData,

  async execute(interaction: ChatInputCommandInteraction) {
    const startedAt = Date.now();
    await interaction.deferReply();

    const message = formatMessage({
      apiLatencyMs: Date.now() - startedAt,
      wsPingMs: interaction.client.ws.ping,
      checkedAt: new Date().toISOString(),
    });

    await interaction.editReply(message);
  },
};
