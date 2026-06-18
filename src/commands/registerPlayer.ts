import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
} from 'discord.js';
import { dbService } from '../services/dbService.js';
import type { SlashCommandModule } from './types.js';

const commandData = new SlashCommandBuilder()
  .setName('등록')
  .setDescription('Unciv 플레이어(또는 문명) 이름과 디스코드 유저를 연동합니다.')
  .setDescriptionLocalizations({ ko: 'Unciv 플레이어(또는 문명) 이름과 디스코드 유저를 연동합니다.' })
  .addStringOption(option =>
    option
      .setName('플레이어이름')
      .setDescription('Unciv 내 플레이어 이름 또는 문명명 (예: Babylon, Korea 등)')
      .setDescriptionLocalizations({ ko: 'Unciv 내 플레이어 이름 또는 문명명 (예: Babylon, Korea 등)' })
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addUserOption(option =>
    option
      .setName('디스코드유저')
      .setDescription('매핑할 디스코드 유저')
      .setDescriptionLocalizations({ ko: '매핑할 디스코드 유저' })
      .setRequired(true)
  );

export const registerPlayerCommand: SlashCommandModule = {
  data: commandData,

  async execute(interaction: ChatInputCommandInteraction) {
    const channelId = interaction.channelId;
    const playerName = interaction.options.getString('플레이어이름', true).trim();
    const discordUser = interaction.options.getUser('디스코드유저', true);

    try {
      // 1. 채널에 연동된 게임이 있는지 검증
      const link = dbService.getLink(channelId);
      if (!link) {
        await interaction.reply({
          content: '❌ **등록 실패:** 이 채널에 연동된 Unciv 게임이 없습니다. 먼저 \`/연동\` 명령어로 게임 ID를 연동해주세요.',
          ephemeral: true,
        });
        return;
      }

      // 2. 플레이어 매핑 등록
      dbService.registerPlayer(channelId, playerName, discordUser.id);

      await interaction.reply({
        content: `✅ **플레이어 연동 완료!**\n- Unciv 플레이어: \`${playerName}\`\n- 디스코드 유저: <@${discordUser.id}>`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await interaction.reply({
        content: `❌ **오류 발생:** ${message}`,
        ephemeral: true,
      });
    }
  },

  async autocomplete(interaction: AutocompleteInteraction, context) {
    const focusedValue = interaction.options.getFocused();
    const channelId = interaction.channelId;

    try {
      const link = dbService.getLink(channelId);
      if (!link) {
        await interaction.respond([]);
        return;
      }

      const players = await context.turnService.getPlayers(link.gameId);
      const filtered = players
        .filter(player => player.toLowerCase().includes(focusedValue.toLowerCase()))
        .slice(0, 25);

      await interaction.respond(
        filtered.map(player => ({ name: player, value: player }))
      );
    } catch {
      await interaction.respond([]).catch(() => {});
    }
  },
};
