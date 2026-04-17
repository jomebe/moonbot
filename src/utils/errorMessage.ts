import { AppError, isAppError } from '../lib/appError.js';

const withHint = (message: string): string =>
  `${message}\n게임 ID가 틀렸거나 서버에서 조회를 막고 있을 수 있습니다.`;

export const toUserErrorMessage = (error: unknown): string => {
  if (!isAppError(error)) {
    return '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }

  switch (error.code) {
    case 'INVALID_GAME_ID':
      return '게임 ID 형식이 올바르지 않습니다. UUID 또는 UUID_Preview 형식으로 입력해 주세요.';

    case 'NOT_FOUND':
      return withHint('게임을 찾을 수 없습니다.');

    case 'UNAUTHORIZED':
      return [
        '이 서버는 인증이 필요한 서버일 수 있습니다.',
        '공개 조회가 막혀 있을 때는 /jsons 또는 /files 접근이 거부됩니다.',
      ].join('\n');

    case 'NETWORK':
      return '서버가 응답하지 않습니다. 서버 주소 또는 네트워크 상태를 확인해 주세요.';

    case 'SERVER_ERROR':
      return 'Unciv 서버에서 내부 오류를 반환했습니다. 잠시 후 다시 시도해 주세요.';

    case 'PARSE_FAILED':
      return [
        '응답은 받았지만 필요한 필드를 해석하지 못했습니다.',
        '서버 응답 구조가 다르거나 압축 형식이 다른 경우일 수 있습니다.',
      ].join('\n');

    case 'BAD_RESPONSE':
      return withHint('서버 응답이 비정상입니다.');

    default:
      return (error as AppError).message;
  }
};
