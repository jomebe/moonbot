import { config } from 'dotenv';

config();

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const DEFAULT_BASE_URL = 'https://uncivserver.xyz';
const DEFAULT_TIMEOUT_MS = 10_000;
const SNOWFLAKE_REGEX = /^\d{17,20}$/;
const PLACEHOLDER_REGEX = /여기에|개발용|example|your_/i;

const getOptionalEnv = (name: string): string | undefined => {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const getRequiredEnv = (name: string): string => {
  const value = getOptionalEnv(name);
  if (!value) {
    throw new Error(`[환경변수 오류] ${name} 값이 필요합니다.`);
  }
  return value;
};

const toPositiveNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '');

const parseLogLevel = (value: string | undefined): LogLevel => {
  const lower = value?.toLowerCase();
  switch (lower) {
    case 'debug':
    case 'info':
    case 'warn':
    case 'error':
      return lower;
    default:
      return 'info';
  }
};

const validateSnowflakeEnv = (name: string, value: string, required: boolean): string | undefined => {
  const trimmed = value.trim();

  if (PLACEHOLDER_REGEX.test(trimmed)) {
    if (!required) return undefined;
    throw new Error(`[환경변수 오류] ${name} 값이 예시 문자열입니다. 실제 Discord ID(숫자)를 넣어주세요.`);
  }

  if (!SNOWFLAKE_REGEX.test(trimmed)) {
    if (!required) return undefined;
    throw new Error(`[환경변수 오류] ${name} 값이 올바른 Discord ID 형식(17~20자리 숫자)이 아닙니다.`);
  }

  return trimmed;
};

export const env = {
  DISCORD_TOKEN: getOptionalEnv('DISCORD_TOKEN'),
  DISCORD_CLIENT_ID: getOptionalEnv('DISCORD_CLIENT_ID'),
  DISCORD_GUILD_ID: getOptionalEnv('DISCORD_GUILD_ID'),
  UNCIV_BASE_URL: normalizeBaseUrl(getOptionalEnv('UNCIV_BASE_URL') ?? DEFAULT_BASE_URL),
  LOG_LEVEL: parseLogLevel(getOptionalEnv('LOG_LEVEL')),
  REQUEST_TIMEOUT_MS: toPositiveNumber(getOptionalEnv('REQUEST_TIMEOUT_MS'), DEFAULT_TIMEOUT_MS),
} as const;

export const requireRuntimeEnv = () => ({
  discordToken: getRequiredEnv('DISCORD_TOKEN'),
});

export const requireRegistrationEnv = () => ({
  discordToken: getRequiredEnv('DISCORD_TOKEN'),
  clientId: validateSnowflakeEnv('DISCORD_CLIENT_ID', getRequiredEnv('DISCORD_CLIENT_ID'), true)!,
  guildId: validateSnowflakeEnv('DISCORD_GUILD_ID', getOptionalEnv('DISCORD_GUILD_ID') ?? '', false),
});
