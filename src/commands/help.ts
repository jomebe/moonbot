import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommandModule } from './types.js';

const commandData = new SlashCommandBuilder()
  .setName('도움말')
  .setDescription('사용 가능한 Unciv 조회 명령어를 안내합니다.')
  .setDescriptionLocalizations({ ko: '사용 가능한 Unciv 조회 명령어를 안내합니다.' });

const HELP_TEXT = [
  '사용 가능한 명령어',
  '/차례 gameid:<UUID 또는 UUID_Preview> - 현재 차례 조회',
  '/게임요약 gameid:<UUID 또는 UUID_Preview> - 차례/턴/문명 목록 요약',
  '/문명목록 gameid:<UUID 또는 UUID_Preview> - 전체 문명/인간 문명 목록',
  '/조회메타 gameid:<UUID 또는 UUID_Preview> - 조회 소스와 매칭 필드 정보',
  '/아이디검증 gameid:<string> - gameId 정규화/형식 검사',
  '/서버상태 - 서버 공개 상태 버전 조회',
  '/핑 - 봇 지연 시간 확인',
  '/봇정보 - 런타임/조회 서버 정보',
  '/도움말 - 이 안내 메시지',
  '',
  '안내',
  '- 이 봇은 공개 엔드포인트(/jsons, /files, /isalive)만 사용합니다.',
  '- 인증이 필요한 비공개 정보는 조회하지 않습니다.',
].join('\n');

export const helpCommand: SlashCommandModule = {
  data: commandData,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply(HELP_TEXT);
  },
};
