/**
 * Size and length limits enforced by the API and mirrored in the web client.
 * Changing a value here changes both sides.
 */
export const LIMITS = {
  minUsernameLength: 3,
  maxUsernameLength: 24,
  minPasswordLength: 8,
  maxPasswordBytes: 72,
  maxRoomNameLength: 60,
  defaultRoomName: 'Untitled Room',
  roomIdLength: 8,
  maxMessageLength: 500,
  maxStoredMessages: 200,
  snapshotMessageCount: 100,
  maxUrlLength: 2048,
  maxPositionSeconds: 60 * 60 * 24 * 7,
  maxSdpLength: 64 * 1024,
  maxIceCandidateLength: 2048,
} as const;
