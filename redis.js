import Redis from "ioredis";

export const redisClient = new Redis(
  "rediss://default:Ac0pAAIncDFhMjlkYmE5NDAxMDY0YzcyOTlkZWM2YWFkNjA2MzhiN3AxNTI1MjE@wanted-herring-52521.upstash.io:6379"
);
