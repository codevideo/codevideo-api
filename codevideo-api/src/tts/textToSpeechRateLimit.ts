export const TEXT_TO_SPEECH_TOKEN_COST = 0;
export function createTextToSpeechRateLimiter(now: () => number = Date.now) {
  const users = new Map<string, { minute: number[]; count: number }>();
  let currentDay = -1;
  return {
    consume(userId: string): { allowed: boolean; retryAfterSeconds: number } {
      const timestamp = now();
      const day = Math.floor(timestamp / 86400000);
      if (day !== currentDay) {
        users.clear();
        currentDay = day;
      }
      const user = users.get(userId) ?? { minute: [], count: 0 };
      user.minute = user.minute.filter((t) => t > timestamp - 60000);
      users.set(userId, user);
      if (user.count >= 300)
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil(((day + 1) * 86400000 - timestamp) / 1000),
          ),
        };
      if (user.minute.length >= 30)
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((user.minute[0] + 60000 - timestamp) / 1000),
          ),
        };
      user.minute.push(timestamp);
      user.count++;
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
export const textToSpeechRateLimit = createTextToSpeechRateLimiter();
