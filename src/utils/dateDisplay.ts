const KST_TIME_ZONE = 'Asia/Seoul';

const kstFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const toDate = (value: string): Date | undefined => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
};

const formatKstDateTime = (date: Date): string => {
  const parts = kstFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find(part => part.type === type)?.value ?? '00';

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');

  return `${year}-${month}-${day} ${hour}:${minute}:${second} KST`;
};

const formatElapsed = (elapsedMs: number): string => {
  if (elapsedMs < 5_000) return '방금';

  const totalSeconds = Math.floor(elapsedMs / 1_000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  if (totalSeconds < 60) return `${totalSeconds}초`;
  if (totalMinutes < 60) return `${totalMinutes}분`;

  if (totalHours < 24) {
    const minutes = totalMinutes % 60;
    if (minutes === 0) return `${totalHours}시간`;
    return `${totalHours}시간 ${minutes}분`;
  }

  const hours = totalHours % 24;
  if (hours === 0) return `${totalDays}일`;
  return `${totalDays}일 ${hours}시간`;
};

export const formatIsoToKstLabel = (iso: string): string => {
  const date = toDate(iso);
  if (!date) return iso;
  return `${formatKstDateTime(date)} (UTC ${date.toISOString()})`;
};

export const formatIsoWithElapsedLabel = (iso: string, checkedAtIso: string): string => {
  const updatedAt = toDate(iso);
  const checkedAt = toDate(checkedAtIso);

  if (!updatedAt || !checkedAt) {
    return formatIsoToKstLabel(iso);
  }

  const elapsed = checkedAt.getTime() - updatedAt.getTime();
  if (elapsed < 0) {
    return `${formatKstDateTime(updatedAt)} (UTC ${updatedAt.toISOString()})`;
  }

  return `${formatKstDateTime(updatedAt)} (UTC ${updatedAt.toISOString()}) · ${formatElapsed(elapsed)} 전`;
};
