import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { dbService } from '../services/dbService.js';
import type { SlashCommandModule } from './types.js';

const commandData = new SlashCommandBuilder()
  .setName('연동해제')
  .setDescription('이 채널의 Unciv 게임 연동을 해제합니다.')
  .setDescriptionLocalizations({ ko: '이 채널의 Unciv 게임 연동을 해제합니다.' });

export const unlinkGameCommand: SlashCommandModule = {
  data: commandData,

  async execute(interaction: ChatInputCommandInteraction) {
    const channelId = interaction.channelId;

    const unlinked = dbService.unlink(channelId);

    if (unlinked) {
      await interaction.reply({
        content: '✅ 이 채널의 Unciv 게임 연동이 해제되었습니다. 더 이상 턴 변경 알림이 전송되지 않습니다.',
      });
    } else {
      await interaction.reply({
        content: '⚠️ 이 채널에 연동된 Unciv 게임이 없습니다.',
        ephemeral: true,
      });
    }
  },
};
