# Unciv 멀티플레이 턴 알림 Discord 봇

Unciv 멀티플레이 게임을 Discord 채널에 연동하여 실시간으로 턴을 감시하고, 턴이 넘어갔을 때 다음 플레이어(매핑된 디스코드 사용자)를 자동으로 멘션하여 알림을 주는 디스코드 봇입니다.

---

## ⚠️ 중요: 슬래시 명령어가 안 뜰 때 해결법

디스코드 봇을 서버에 초대할 때 **슬래시 명령어 권한(applications.commands)**을 함께 부여해야 명령어가 서버에 노출됩니다.

### 1. 올바른 초대 링크 생성 방법
디스코드 개발자 포털(Discord Developer Portal)에서 초대 링크를 만들 때 다음 항목들을 필수로 선택해주세요:
- **OAuth2 > URL Generator** 메뉴로 이동
- **Scopes**: `bot` 과 **`applications.commands`**를 **둘 다 반드시 체크**
- **Bot Permissions**: `Send Messages` (메시지 전송 권한) 체크
- 생성된 하단의 URL로 봇을 서버에 다시 초대하세요.

### 2. 슬래시 명령어 등록 속도 문제 (글로벌 vs 길드)
- **글로벌 등록 (기본값)**: `DISCORD_GUILD_ID` 환경변수를 비워둔 채 명령어 등록 스크립트를 실행하면, 전 세계 모든 서버에 반영되는 글로벌 명령어로 등록됩니다. 이는 디스코드 API 사정상 반영되는 데 **최대 1시간**이 걸릴 수 있습니다.
- **길드 등록 (추천 - 즉시 반영)**: `.env` 파일에 봇이 있는 디스코드 서버 ID(길드 ID)를 `DISCORD_GUILD_ID`로 지정한 뒤 명령어를 등록하면 **1초 이내에 즉시** 명령어가 적용됩니다.

---

## 프로젝트 구조

```text
.
├─ .env.example
├─ package.json
├─ tsconfig.json
├─ README.md
├─ src
│  ├─ index.ts
│  ├─ registerCommands.ts
│  ├─ commands
│  │  ├─ index.ts
│  │  ├─ types.ts
│  │  ├─ linkGame.ts       # 게임 연동 (/연동)
│  │  ├─ unlinkGame.ts     # 연동 해제 (/연동해제)
│  │  ├─ registerPlayer.ts # 플레이어 매핑 (/등록)
│  │  └─ uncivTurn.ts      # 차례 조회 (/차례)
│  ├─ config
│  │  ├─ env.ts
│  │  └─ logger.ts
│  ├─ lib
│  │  └─ appError.ts
│  ├─ services
│  │  ├─ dbService.ts      # JSON 파일 데이터베이스
│  │  ├─ pollingService.ts # 실시간 턴 감시 서비스
│  │  ├─ uncivApiClient.ts
│  │  ├─ uncivParser.ts
│  │  └─ uncivTurnService.ts
│  ├─ types
│  │  └─ unciv.ts
│  └─ utils
│     ├─ errorMessage.ts
│     ├─ guards.ts
│     ├─ objectPath.ts
│     └─ time.ts
└─ tests
   ├─ uncivParser.test.ts
   └─ dbService.test.ts
```

---

## 환경변수 설정 (`.env`)

- `DISCORD_TOKEN`: Discord 봇 토큰
- `DISCORD_CLIENT_ID`: Discord 애플리케이션 ID
- `DISCORD_GUILD_ID`: 즉시 테스트할 디스코드 서버(길드) ID (개발/테스트 단계 권장)
- `UNCIV_BASE_URL`: 조회할 Unciv 서버 주소 (기본값: `https://uncivserver.xyz`)
- `LOG_LEVEL`: 로그 레벨 (`debug | info | warn | error`)
- `REQUEST_TIMEOUT_MS`: API 요청 타임아웃(ms)

---

## 설치 및 실행 방법

### 1. 로컬 환경 실행

1. 의존성 설치:
   ```bash
   npm install
   ```
2. `.env` 파일 설정:
   ```bash
   cp .env.example .env
   # .env 파일을 열고 실제 토큰 및 ID를 입력하세요.
   ```
3. 슬래시 명령어 등록 (길드 ID 설정 후 실행 시 즉시 반영):
   ```bash
   npm run register:commands
   ```
4. 봇 실행 (개발 모드):
   ```bash
   npm run dev
   ```

### 2. Render.com 배포 환경 설정

- **Build Command**:
  ```bash
  npm install && npm run build && npm run register:commands
  ```
- **Start Command**:
  ```bash
  npm run start
  ```
- **Environment Variables**: Render의 설정 페이지에서 `.env`에 정의된 변수들을 등록하세요.

---

## 슬래시 명령어 사용법

- `/연동 gameid:<string>`: 현재 채널에 Unciv 게임 ID를 연동합니다.
- `/연동해제`: 현재 채널의 게임 연동을 해제합니다.
- `/등록 플레이어이름:<string> 디스코드유저:<mention>`: Unciv 플레이어/문명과 디스코드 계정을 연결합니다.
- `/차례`: 현재 누구 차례인지 조회하며, 매핑된 플레이어가 있다면 멘션하여 알려줍니다.
- `/제거`: 개발자 전용 명령어로, 봇을 해당 서버에서 퇴장시킵니다.

