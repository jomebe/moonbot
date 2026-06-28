import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { dbService } from '../services/dbService.js';
import type { SlashCommandModule } from './types.js';

const commandData = new SlashCommandBuilder()
  .setName('알람')
  .setDescription('매 시간마다 전송되는 턴 재촉 알람을 켜거나 끕니다.')
  .setDescriptionLocalizations({ ko: '매 시간마다 전송되는 턴 재촉 알람을 켜거나 끕니다.' })
  .addStringOption(option =>
    option
      .setName('상태')
      .setDescription('알람 상태 (켜기/끄기)')
      .setDescriptionLocalizations({ ko: '알람 상태 (켜기/끄기)' })
      .setRequired(true)
      .addChoices(
        { name: '켜기', value: 'on' },
        { name: '끄기', value: 'off' }
      )
  );

export const toggleReminderCommand: SlashCommandModule = {
  data: commandData,

  async execute(interaction: ChatInputCommandInteraction) {
    const channelId = interaction.channelId;
    const state = interaction.options.getString('상태', true);

    try {
      // 1. 채널에 연동된 게임이 있는지 검증
      const link = dbService.getLink(channelId);
      if (!link) {
        await interaction.reply({
          content: '❌ **설정 실패:** 이 채널에 연동된 Unciv 게임이 없습니다. 먼저 \`/연동\` 명령어로 게임 ID를 연동해주세요.',
          ephemeral: true,
        });
        return;
      }

      const disabled = state === 'off';
      dbService.setReminderDisabled(channelId, disabled);

      await interaction.reply({
        content: `✅ **알람 설정 변경 완료!**\n- 턴 재촉 알람 상태: **${disabled ? '끄기 (비활성화)' : '켜기 (활성화)'}**\n- 이제 매 시간마다 전송되는 알람이 **${disabled ? '전송되지 않습니다' : '전송됩니다'}**.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await interaction.reply({
        content: `❌ **오류 발생:** ${message}`,
        ephemeral: true,
      });
    }
  },
};
