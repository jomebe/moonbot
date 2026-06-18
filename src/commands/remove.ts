import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { logger } from '../config/logger.js';
import type { SlashCommandModule } from './types.js';

const commandData = new SlashCommandBuilder()
  .setName('제거')
  .setDescription('봇을 현재 서버에서 퇴장시킵니다.')
  .setDescriptionLocalizations({ ko: '봇을 현재 서버에서 퇴장시킵니다.' });

export const removeCommand: SlashCommandModule = {
  data: commandData,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: '❌ 이 명령어는 서버 내에서만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    try {
      logger.info(`요청에 의해 서버 퇴장 시도: ${guild.name} (ID: ${guild.id}, 요청자: ${interaction.user.tag})`);
      await interaction.reply({
        content: `👋 **${guild.name}** 서버에서 퇴장합니다. 이용해 주셔서 감사합니다.`,
      });

      await guild.leave();
    } catch (error) {
      logger.error(`서버 퇴장 중 오류 발생 (${guild.name}):`, error);
      await interaction.followUp({
        content: '❌ 서버 퇴장 처리 중 오류가 발생했습니다.',
        ephemeral: true,
      }).catch(() => {});
    }
  },
};
