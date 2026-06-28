import type { Client } from 'discord.js';
import { logger } from '../config/logger.js';
import { dbService } from './dbService.js';
import type { UncivTurnService } from './uncivTurnService.js';

let pollingInterval: NodeJS.Timeout | null = null;
const REMINDER_INTERVAL_MS = 60 * 60 * 1000;

const getKstHour = (date: Date): number => (date.getUTCHours() + 9) % 24;

const sendChannelMessage = async (client: Client, channelId: string, message: string): Promise<void> => {
  const channel = await client.channels.fetch(channelId);
  if (channel && channel.isTextBased()) {
    await (channel as any).send(message);
    return;
  }
  logger.warn(`채널(${channelId})이 텍스트 채널이 아니거나 접근할 수 없습니다.`);
};

// 20단계 x 10개 메시지 에스컬레이션 테이블
const getEscalatedReminder = (count: number): string => {
  const messages: string[][] = [
    // Level 1
    [
      '턴 좀 넘겨주세요.',
      '차례가 되셨습니다. 진행해 주세요!',
      '턴 진행 부탁드립니다~',
      '언시브 턴이 왔습니다! 확인해 주세요.',
      '플레이어님, 차례입니다. 고고!',
      '턴 진행할 시간입니다~',
      'Unciv 턴 한 번만 봐주세요!',
      '기기 기다리고 있습니다. 턴 넘겨주세요~',
      '차례 오셨으니 진행 부탁드립니다!',
      '턴이 넘어왔어요! 확인 부탁드립니다.'
    ],
    // Level 2
    [
      '턴 아직 안 보셨나요? 확인 부탁해요!',
      '빨리 넘어가면 좋겠어요. 고고!',
      '턴이 살짝 멈춰있네요. 진행해주세요!',
      '바쁘시겠지만 턴 진행 부탁드립니다.',
      '차례 돌아온 지 좀 됐습니다~',
      '턴 보실 때 되었습니다!',
      '기다리는 사람들이 있어요, 턴 고고!',
      '슬슬 다음 턴으로 넘어가볼까요?',
      '바쁜 일 끝나시면 턴 부탁해요!',
      '턴 넘기는 걸 깜빡하신 건 아니죠?'
    ],
    // Level 3
    [
      '아직도 안넘겼냐? 빨리 좀 넘기자.',
      '슬슬 턴 넘길 시간입니다. 어서요!',
      '대기 시간이 길어지고 있어요. 진행 고!',
      '조금만 서둘러서 턴 진행해주세요!',
      '아직 턴 안 보셨어요? 빨리 보고 넘깁시다.',
      '기다리다 지치겠어요. 턴 좀 넘겨줘요~',
      '턴 진행 부탁드려요, 흐름 끊깁니다!',
      '빠른 진행을 위해 턴 좀 부탁합니다.',
      '다음 사람 기다리고 있습니다. 고고!',
      '턴 안넘기고 뭐하세요! 얼른 가봅시다.'
    ],
    // Level 4
    [
      '진짜 턴 안넘기고 뭐하냐? 턴빨넘;',
      '슬슬 넘길 때 지났는데... 빨리 좀요!',
      '대체 언제 넘기나요? 어서 넘겨주세요.',
      '흐름 너무 끊기는데 턴 빨리 넘기시죠.',
      '아직도 턴을 붙잡고 계십니까?',
      '기다리는 사람들 지쳐가요. 빨리 고!',
      '턴 넘겨주세요, 현기증 난단 말이에요.',
      '시간 꽤 지났는데 빨리 턴 봅시다.',
      '얼른 넘기고 다음 판 구상합시다.',
      '턴 안넘기고 딴짓하시는 중인가요?'
    ],
    // Level 5
    [
      '벌써 몇 시간째냐... 빨리 좀 넘기라.',
      '야, 아직도 네 차례다. 빨리 넘겨라.',
      '턴 좀 빨리빨리 넘깁시다 진짜로.',
      '기다리다 사리 나오겠네. 턴 좀 줘라.',
      '턴 안넘기고 잠수 타는 거 아니지?',
      '빨리 턴 넘겨, 진도 나가야지.',
      '하루 종일 네 턴만 기다릴 순 없다.',
      '슬슬 지루해집니다. 빨리 턴 좀요.',
      '턴 안넘기고 뭐 해, 얼른 넘겨.',
      '대기 시간 실화냐? 턴 좀 넘기자.'
    ],
    // Level 6
    [
      '시발 턴 안넘기냐? 빨리넘겨라',
      '아니 진짜 턴 좀 빨리 넘기라고',
      '아직도 턴 안넘긴 거 실화냐? 어이가 없네',
      '작작 뭉개고 턴 좀 빨리 넘겨라 좀',
      '내 차례는 언제 오냐? 빨리 넘겨',
      '턴 좀 넘겨라 답답해 죽겠다 진짜',
      '아직도 네 차례인 게 말이 되냐?',
      '빨리 좀 넘겨라, 게임방 전원 대기 중이다',
      '턴 잡고 뭐 하길래 이렇게 오래 걸려?',
      '진짜 눈물 나게 안 넘어가네, 턴 고!'
    ],
    // Level 7
    [
      '야 이 새끼야 턴 안넘기고 쳐자냐? 빨리넘겨라',
      '시발 언제까지 기다려야 돼? 빨리 턴 넘겨',
      '빨리 턴 넘겨라 지랄하지 말고',
      '턴 안넘기고 똥 싸러 갔냐? 빨리 넘겨라',
      '존나 안 넘어가네 진짜, 턴 빨리 넘겨',
      '아 진짜 턴 개느리네, 빨리 좀 넘겨',
      '시발 게임 혼자 하냐? 턴 좀 넘기자',
      '아직도 안넘긴 건 선 넘었지 빨리 넘겨라',
      '턴 좀 넘겨라 진짜 답답해서 암 걸리겠다',
      '언제 넘길 건데 시발아 빨리 넘겨'
    ],
    // Level 8
    [
      '야 턴 안넘기냐? 진짜 개패고 싶네 빨리넘겨',
      '시발련아 턴 안넘기고 뭐하냐? 빨리 좀 하자',
      '존나 굼벵이 기어가네 턴 빨리 넘겨라',
      '뇌 빼고 겜하냐? 턴 빨리 넘기라고',
      '시발 턴 넘기는 게 그렇게 어렵냐? 빨리 고',
      '작작 좀 뭉개고 빨리 넘겨라 개새끼야',
      '너 땜에 게임 흐름 다 뒤졌다 빨리 턴 넘겨',
      '아직도 턴 안넘긴 거 진짜 실화냐 시발?',
      '야, 안 졸리니까 턴 빨리 넘겨라 쳐자지 말고',
      '게임 속도 실화냐? 턴 좀 넘겨라 개새끼야'
    ],
    // Level 9
    [
      '개사발면아 뒤지고싶냐? 빨리넘겨시발련아',
      '야 이 병신아 턴 안넘기고 쳐자냐? 빨리 넘겨',
      '시발련아 손가락 부러졌냐? 턴 안넘기냐?',
      '대가리 총 맞았냐? 턴 왜 이렇게 안 넘어가',
      '진짜 암 덩어리네 턴 빨리 좀 넘겨라 시발',
      '야 이 쓰레기야 턴 안넘기고 뭐하냐? 빨리 고',
      '존나 느려 터졌네 턴 빨리 넘겨라 시발련아',
      '너 땜에 암 걸려 뒤지겠다 턴 빨리 넘겨',
      '시발 겜을 하겠다는 거냐 말겠다는 거냐 빨리 넘겨',
      '아가리 닥치고 턴이나 빨리 넘겨라 병신아'
    ],
    // Level 10
    [
      '개새끼야 턴 안넘기면 컴퓨터 터트린다 빨리넘겨',
      '시발련아 뒤지기 싫으면 턴 빨리 넘겨라',
      '진짜 개빡치게 하네 턴 안넘기냐 개새끼야?',
      '야 이 씹새끼야 턴 빨리 안 넘기냐? 어?',
      '손가락 압수하기 전에 턴 빨리 넘겨라 시발',
      '뇌가 썩었냐? 턴 넘기는 데 한 세월이네 병신',
      '야 이 호로새끼야 턴 안넘기고 뭐하냐 빨리 넘겨',
      '존나 빡치네 진짜 턴 빨리 넘겨라 시발새끼야',
      '너 땜에 혈압 올라 뒤지겠다 턴 빨리 넘겨라',
      '시발련아 잠이 오냐? 턴이나 넘기고 쳐자라'
    ],
    // Level 11
    [
      '야 이 씨발련아 진짜 장난하냐? 빨리넘겨라',
      '너 땜에 대기 타는 시간만 오조오억년이다 병신아',
      '아가리 찢기 전에 턴 빨리 넘겨라 개새끼야',
      '시발련아 컴 터지기 싫으면 턴 빨리 넘겨라',
      '야 진짜 적당히 해라 시발 턴 왜 안넘기냐?',
      '개새끼야 아직도 안넘긴 건 선 많이 넘었지',
      '진짜 살인 충동 느끼게 하지 말고 턴 넘겨라',
      '시발 겜 같이 못하겠네 존나 안넘기네 진짜',
      '야 이 굼벵이 새끼야 턴 빨리 안 넘기냐?',
      '개새끼야 쳐돌았냐? 턴 안넘기고 뭐 하냐고 시발련아'
    ],
    // Level 12
    [
      '진짜 개 좆같은 놈이네 턴 빨리 안넘기냐?',
      '시발새끼가 사람 인내심 테스트하나 빨리 넘겨',
      '너 진짜 죽고 싶냐? 턴 안넘기고 쳐자네 병신이',
      '야 이 씨발새끼야 턴 빨리 넘기라고 쳐먹지만 말고',
      '대가리가 장식품이냐? 턴 안넘기고 뭐해 시발',
      '존나 이기적인 새끼네 겜 혼자 하냐? 턴 넘겨',
      '시발련아 숨 쉬지 말고 턴이나 빨리 넘겨라',
      '아 진짜 빡치네 턴 좀 빨리 넘겨라 개좆같은련아',
      '야 개새끼야 게임 터트리기 전에 턴 넘겨라',
      '쳐맞기 전에 턴 빨리 넘겨라 시발련아 진짜'
    ],
    // Level 13
    [
      '야 이 개좆같은 씨발새끼야 턴 빨리 안넘기냐?',
      '시발 겜 방 파놓고 쳐자는 새끼 뚝배기 깨고싶네',
      '진짜 개새끼네 이거 턴 안넘기냐? 뒤질래?',
      '야 이 호로잡놈의 새끼야 턴 빨리 넘겨라 진짜',
      '손가락 잘라버리기 전에 턴 빨리 넘겨라 병신아',
      '시발 존나 안 넘기네 쳐돌았나 진짜 빨리 넘겨',
      '너 땜에 다들 빡쳤다 턴 빨리 넘겨라 개새끼야',
      '야 이 씨발련아 장난 까냐? 턴 안넘기냐고',
      '대가리 깨지기 싫으면 턴 빨리 넘겨라 시발련아',
      '진짜 개민폐 덩어리네 턴 빨리 넘겨 개새끼야'
    ],
    // Level 14
    [
      '시발련아 네 턴에 세계 대전 일어났냐? 빨리넘겨라',
      '야 이 개새끼야 턴 안넘기고 뭐하냐 진짜 뒤질래?',
      '뇌 주름 펴졌냐? 턴 넘기는 법 까먹었어 병신아?',
      '진짜 개씹새끼네 이거 턴 빨리 안 넘기냐?',
      '아가리 닥치고 턴이나 빨리 처넘겨라 씹새끼야',
      '시발 존나 빡치네 턴 왜 이렇게 안 넘어가냐고',
      '너 진짜 뚝배기 깨지고 싶어서 환장했냐? 턴 넘겨',
      '야 이 병신새끼야 턴 안넘기고 쳐자냐? 어?',
      '진짜 혈압 터져 뒤지겠네 턴 빨리 넘겨라 시발',
      '쳐돌았냐 진짜? 턴 빨리 안 넘기냐고 개새끼야'
    ],
    // Level 15
    [
      '야 이 씹버러지 새끼야 턴 안넘기고 뭐하냐? 빨리 넘겨',
      '시발련이 쳐돌아가지고 턴 존나 안넘기네 빨리 넘겨',
      '진짜 개 좆같은 새끼네 이거 턴 안넘기냐 뒤질래?',
      '야 이 씨발련아 컴퓨터 부수기 전에 턴 빨리 넘겨',
      '손가락 부러뜨려 주기 전에 턴 빨리 넘겨라 개새끼야',
      '시발 겜을 똥구멍으로 하냐? 턴 존나 안 넘어가네',
      '너 같은 민폐 새끼는 첨 본다 턴 빨리 넘겨 시발',
      '야 개좆같은 새끼야 턴 빨리 안 넘기냐고 진짜',
      '진짜 암 유발자네 턴 빨리 처넘겨라 개새끼야',
      '시발련아 잠이 오냐? 턴 넘기고 기절해라 제발'
    ],
    // Level 16
    [
      '이 개좆같은 씹버러지 새끼야 턴 빨리 넘기라고 시발',
      '야 진짜 뚝배기 깨고 싶으니까 턴 빨리 처넘겨라',
      '시발새끼가 사람 죽이려고 환장했나 턴 안넘기냐?',
      '너 진짜 오늘 제삿날이고 싶냐? 턴 빨리 넘겨',
      '야 이 개자식아 턴 안넘기고 뭐 처먹고 자빠졌냐?',
      '시발 존나 빡치게 하네 턴 빨리 넘기라고 개새끼야',
      '뇌가 있으면 턴을 빨리 처넘기세요 이 병신새끼야',
      '야 씨발련아 장난하는 것도 아니고 턴 왜 안넘기냐',
      '진짜 개 좆같네 턴 좀 빨리 처넘겨라 개새끼야',
      '쳐돌았냐 진짜? 턴 빨리 넘겨라 시발련아 뒤질래?'
    ],
    // Level 17
    [
      '야 이 씨발 개좆같은 버러지 새끼야 턴 빨리 안넘기냐?',
      '시발련아 진짜 오늘 끝장 볼까? 턴 빨리 넘겨라',
      '대가리 장식품인 개새끼야 턴 안넘기냐 진짜 뒤질래?',
      '야 이 씹새끼야 사람 빡치게 하는 재주가 있네 턴 넘겨',
      '손가락 다 뽑아버리기 전에 턴 빨리 넘겨라 시발련아',
      '시발 존나 짜증 나게 하네 턴 왜 안 넘어가는데 개새끼야',
      '너 땜에 암 걸려 뒤지기 일보직전이다 턴 빨리 넘겨',
      '야 이 개자식아 쳐돌아가지고 턴 안넘기고 잠수 타냐?',
      '진짜 살인난다 시발련아 턴 빨리 넘겨라 개새끼야',
      '아가리 처닫고 턴이나 빨리 넘겨라 개좆같은 새끼야'
    ],
    // Level 18
    [
      '야 이 씹창난 개새끼야 턴 안넘기고 뭐하냐? 빨리 넘겨',
      '시발련아 진짜 뚝배기 개박살 내기 전에 턴 넘겨라',
      '진짜 개 좆같은 버러지 새끼네 턴 안넘기냐 뒤질래?',
      '야 이 씨발새끼야 컴퓨터 던지기 전에 턴 빨리 넘겨',
      '손가락 압수해서 튀겨버리기 전에 턴 빨리 넘겨라',
      '시발 겜을 발가락으로 하냐? 턴 존나 안 넘어가네 병신',
      '너 같은 개민폐 새끼는 첨 본다 턴 빨리 넘겨 시발련아',
      '야 개좆같은 씨발새끼야 턴 빨리 안 넘기냐고 진짜로',
      '진짜 암덩어리 새끼네 턴 빨리 처넘겨라 개자식아',
      '시발련아 눈깔 파버리기 전에 턴이나 빨리 넘겨라'
    ],
    // Level 19
    [
      '야 이 씹버러지 개좆같은 새끼야 턴 빨리 안넘기냐?',
      '시발련아 진짜 오늘 너 죽고 나 죽자 턴 빨리 넘겨',
      '대가리에 똥만 찬 개새끼야 턴 안넘기냐 진짜 뒤질래?',
      '야 이 씹새끼야 사람 돌게 만들지 말고 턴 빨리 넘겨',
      '손가락 다 으깨버리기 전에 턴 빨리 넘겨라 시발련아',
      '시발 존나 빡치게 하네 턴 왜 안 넘어가는데 개새끼야',
      '너 땜에 혈압 터져 뒤질 것 같다 턴 빨리 처넘겨라',
      '야 이 개자식아 쳐돌아서 턴 안넘기고 쳐자빠졌냐?',
      '진짜 피꺼솟하네 시발련아 턴 빨리 넘겨라 개새끼야',
      '아가리 찢어버리기 전에 턴이나 빨리 넘겨라 병신아'
    ],
    // Level 20
    [
      '야 이 개씨발 개좆같은 씹창난 개버러지 새끼야 턴 빨리 안넘기냐? 진짜 뒤지고 싶어서 환장했냐 개새끼야?',
      '시발련아 진짜 오늘 살인사건 난다 턴 빨리 넘겨라 뒤지기 싫으면',
      '대가리에 우동사리 든 개씹새끼야 턴 안넘기냐 진짜 뒤질래? 뚝배기 깬다',
      '야 이 개씹새끼야 사람 진짜 빡돌게 만드네 턴 빨리 넘겨라 쳐자지 말고',
      '손가락 발가락 다 잘라버리기 전에 턴 빨리 넘겨라 시발련아 진짜 빡치니까',
      '시발 존나 개빡치게 하네 턴 왜 안 넘어가는데 개새끼야 진짜 돌았냐?',
      '너 땜에 암 걸려 뒈질 것 같다 턴 빨리 처넘겨라 이 개좆같은 쓰레기새끼야',
      '야 이 쓰레기 새끼야 쳐돌아서 턴 안넘기고 쳐자빠져 자냐? 빨리 넘겨',
      '진짜 피가 거꾸로 솟구친다 시발련아 턴 빨리 넘겨라 개새끼야 다 패버리기 전에',
      '너 때문에 다 멈췄잖아 개새끼야 빨리넘겨라 뒤지기실으면 진짜로 뚝배기 깬다'
    ]
  ];

  const stage = Math.max(0, count);
  const stageIndex = Math.min(stage, messages.length - 1);
  const stageMessages = messages[stageIndex] ?? messages[0]!;

  const randomIndex = Math.floor(Math.random() * stageMessages.length);
  return stageMessages[randomIndex] ?? stageMessages[0]!;
};

export const startPolling = (
  client: Client,
  turnService: UncivTurnService,
  intervalMs = 60_000
): void => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  logger.info(`Unciv 턴 상태 폴링을 시작합니다. 주기: ${intervalMs / 1000}초`);

  pollingInterval = setInterval(async () => {
    try {
      const links = dbService.getAllLinks();
      if (links.length === 0) {
        return;
      }

      logger.debug(`총 ${links.length}개의 연동된 채널 폴링 중...`);

      for (const link of links) {
        try {
          const result = await turnService.lookup(link.gameId);

          const lastPlayer = link.lastPlayer;
          const lastTurn = link.lastTurn;

          // 턴 진행 또는 플레이어 변경 감지
          const isPlayerChanged = lastPlayer !== undefined && lastPlayer !== result.currentPlayer;
          const isTurnChanged = lastTurn !== undefined && result.turn !== undefined && lastTurn !== result.turn;

          if (isPlayerChanged || isTurnChanged) {
            logger.info(
              `턴 변경 감지 [채널: ${link.channelId}, 게임: ${link.gameId}]: ` +
              `이전(${lastPlayer}, 턴 ${lastTurn}) -> 현재(${result.currentPlayer}, 턴 ${result.turn})`
            );

            const mappedUserId = link.players[result.currentPlayer];
            const playerDisplay = mappedUserId ? `<@${mappedUserId}>` : `**${result.currentPlayer}**`;

            const msg = `${playerDisplay} ㅌㄴㄱ`;

            // 디스코드 채널로 메시지 전송
            try {
              await sendChannelMessage(client, link.channelId, msg);
            } catch (error) {
              logger.error(`채널(${link.channelId})에 알림 메시지 전송 중 오류 발생:`, error);
            }
          } else {
            const now = new Date();
            const reminderBase = link.lastReminderAt ?? link.turnStartedAt;
            const reminderDue = reminderBase
              ? now.getTime() - new Date(reminderBase).getTime() >= REMINDER_INTERVAL_MS
              : false;
            const isQuietHours = getKstHour(now) < 8;
            const mappedUserId = link.players[result.currentPlayer];

            if (reminderDue && !isQuietHours && mappedUserId && !link.reminderDisabled) {
              const reminder = getEscalatedReminder(link.reminderCount ?? 0);
              try {
                await sendChannelMessage(client, link.channelId, `<@${mappedUserId}> ${reminder}`);
                dbService.updateReminderState(link.channelId, now.toISOString());
              } catch (error) {
                logger.error(`채널(${link.channelId})에 재촉 메시지 전송 중 오류 발생:`, error);
              }
            }
          }

          // 상태가 변경되었거나 최초 기록인 경우 DB 업데이트
          if (lastPlayer !== result.currentPlayer || lastTurn !== result.turn || !link.turnStartedAt) {
            dbService.updateLastKnownState(link.channelId, result.turn, result.currentPlayer);
          }
        } catch (error) {
          logger.warn(`게임 ID ${link.gameId} 조회 중 오류 발생 (채널: ${link.channelId}):`, error);
        }
      }
    } catch (error) {
      logger.error('폴링 루프 실행 중 예상치 못한 예외 발생:', error);
    }
  }, intervalMs);
};

export const stopPolling = (): void => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    logger.info('Unciv 턴 상태 폴링을 중지했습니다.');
  }
};
