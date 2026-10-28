'use strict';

/** Shared size and rate limits. Keep client-side limits in sync with these values. */
module.exports = Object.freeze({
  MAX_ROOM_NAME_LENGTH: 60,
  DEFAULT_ROOM_NAME: 'Untitled Room',
  MAX_MESSAGE_LENGTH: 500,
  MAX_STORED_MESSAGES: 200,
  SNAPSHOT_MESSAGE_COUNT: 100,
  MAX_URL_LENGTH: 2048,
  MAX_POSITION_SECONDS: 60 * 60 * 24 * 7,
  MAX_SDP_LENGTH: 64 * 1024,
  MAX_ICE_CANDIDATE_LENGTH: 2048,
});
