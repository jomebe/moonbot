# Unciv 멀티플레이 공개 정보 조회 Discord 봇 (MVP)

Unciv 멀티플레이 게임의 `gameId`를 넣으면, 외부 Unciv 서버에서 공개 상태를 읽어 현재 차례/요약 정보를 알려주는 Discord 봇입니다.

## 핵심 포인트

- 1순위 조회: `GET /jsons/:gameId`
- fallback 조회: `GET /files/:gameId`
- 동일 gameId에서 `/jsons`와 `/files`를 모두 확인해 더 최신 턴/시각 데이터를 우선 채택
- 서버 상태: `GET /isalive`
- 목표: **지금 누구 차례인지**를 빠르게 반환

## 비공식 API 주의

이 구현은 UncivServer 계열 공개 서버 코드(`touhidurrr/UncivServer.xyz`)의 라우트를 기준으로 작성되었습니다.
공식 API 보장이 없고, 서버 설정(권한/프록시/버전)에 따라 동작이 달라질 수 있습니다.

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
│  │  ├─ botInfo.ts
│  │  ├─ civilizations.ts
│  │  ├─ gameSummary.ts
│  │  ├─ gameIdCheck.ts
│  │  ├─ help.ts
│  │  ├─ lookupMeta.ts
│  │  ├─ ping.ts
│  │  ├─ serverStatus.ts
│  │  └─ uncivTurn.ts
│  ├─ config
│  │  ├─ env.ts
│  │  └─ logger.ts
│  ├─ lib
│  │  └─ appError.ts
│  ├─ services
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
   └─ uncivParser.test.ts
```

## 환경변수

- `DISCORD_TOKEN`: Discord 봇 토큰
- `DISCORD_CLIENT_ID`: Discord 애플리케이션(Client) ID
- `DISCORD_GUILD_ID`: 개발용 길드 ID (있으면 길드 명령어로 빠르게 반영)
- `UNCIV_BASE_URL`: 조회할 Unciv 서버 주소
- `LOG_LEVEL`: `debug | info | warn | error`
- `REQUEST_TIMEOUT_MS`: HTTP 타임아웃(ms)

## 설치 및 실행

```bash
npm install
cp .env.example .env
```

`.env`를 채운 뒤:

```bash
# 슬래시 명령어 등록
npm run register:commands

# 개발 실행
npm run dev
```

배포 실행:

```bash
npm run build
npm run start
```

## 명령어

- `/차례 gameid:<string>`
- `/게임요약 gameid:<string>`
- `/문명목록 gameid:<string>`
- `/조회메타 gameid:<string>`
- `/아이디검증 gameid:<string>`
- `/서버상태`
- `/핑`
- `/봇정보`
- `/도움말`

## 응답 예시

`/차례` 성공:

```text
게임 ID: 12345678-1234-1234-1234-1234567890ab
현재 차례: Babylon
현재 턴: 143
마지막 갱신 추정: 2026-04-14 14:20:11 KST (UTC 2026-04-14T05:20:11.000Z) · 2초 전
조회 시각: 2026-04-14 14:20:13 KST (UTC 2026-04-14T05:20:13.482Z)
```

`/게임요약` 성공:

```text
게임 ID: 12345678-1234-1234-1234-1234567890ab
현재 차례: Babylon
현재 턴: 143
전체 문명: Babylon, Egypt, Korea
인간 문명: Babylon, Korea
마지막 갱신 추정: 2026-04-14 14:20:11 KST (UTC 2026-04-14T05:20:11.000Z) · 2초 전
조회 시각: 2026-04-14 14:20:13 KST (UTC 2026-04-14T05:20:13.482Z)
```

`/서버상태` 성공:

```text
Unciv 서버 상태
authVersion: 24
chatVersion: 1
조회 시각: 2026-04-14T05:20:13.482Z
```

실패(존재하지 않는 gameId):

```text
게임을 찾을 수 없습니다.
게임 ID가 틀렸거나 서버에서 조회를 막고 있을 수 있습니다.
```

실패(인증 필요 서버):

```text
이 서버는 인증이 필요한 서버일 수 있습니다.
공개 조회가 막혀 있을 때는 /jsons 또는 /files 접근이 거부됩니다.
```

실패(파싱 불가):

```text
응답은 받았지만 필요한 필드를 해석하지 못했습니다.
서버 응답 구조가 다르거나 압축 형식이 다른 경우일 수 있습니다.
```

## 테스트

```bash
npm run test
```

`tests/uncivParser.test.ts`에서 다음을 검증합니다.

- 표준 `currentPlayer` 필드 파싱
- `playerTurn` 인덱스 기반 파싱
- `/files` 응답(base64+gzip) 디코딩
- 파싱 실패 케이스

## 추후 확장 아이디어 (미구현)

- 게임 별칭 저장/목록/삭제 (`/언시브게임등록`, `/언시브게임목록`, `/언시브게임삭제`)
- 여러 gameId 일괄 조회
- 폴링 기반 "내 차례" 알림
- `/sync` 웹소켓 기반 실시간 감시
- 인증 기반 `/api/profiles/:id/games` 연동
