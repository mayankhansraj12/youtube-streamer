/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the StreamSync API. Leave empty to use the page's own origin. */
  readonly VITE_BACKEND_URL?: string;
  /** Optional JSON array of RTCIceServer objects, for example to add a TURN server. */
  readonly VITE_ICE_SERVERS?: string;
}
