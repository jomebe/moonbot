import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { env } from '../config/env.js';
import { formatIsoToKstLabel } from '../utils/dateDisplay.js';
import type { SlashCommandModule } from './types.js';

const commandData = new SlashCommandBuilder()
  .setName('봇정보')
  .setDescription('봇 런타임과 조회 서버 정보를 표시합니다.')
  .setDescriptionLocalizations({ ko: '봇 런타임과 조회 서버 정보를 표시합니다.' });

const toUptimeString = (seconds: number): string => {
  const total = Math.floor(seconds);
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const secs = total % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}일`);
  if (hours > 0 || parts.length > 0) parts.push(`${hours}시간`);
  if (minutes > 0 || parts.length > 0) parts.push(`${minutes}분`);
  parts.push(`${secs}초`);
  return parts.join(' ');
};

const formatMessage = (): string => {
  const checkedAtIso = new Date().toISOString();
  const checkedAtLabel = formatIsoToKstLabel(checkedAtIso);

  const lines = [
    '봇 정보',
    `Node.js: ${process.version}`,
    `업타임: ${toUptimeString(process.uptime())}`,
    `조회 서버: ${env.UNCIV_BASE_URL}`,
    `타임아웃: ${env.REQUEST_TIMEOUT_MS}ms`,
    `조회 시각: ${checkedAtLabel}`,
  ];

  return lines.join('\n');
};

export const botInfoCommand: SlashCommandModule = {
  data: commandData,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply(formatMessage());
  },
};
