import type { IceCandidatePayload, SessionDescriptionPayload } from '@streamsync/shared';
import type { RoomSocket } from './socket';
import type { SignalPayload } from '../types';

export interface VoiceMeshEvents {
  onStream: (remoteId: string, stream: MediaStream) => void;
  onConnectionState: (remoteId: string, state: RTCPeerConnectionState) => void;
  onRemoved: (remoteId: string) => void;
}

export interface VoiceMeshOptions {
  socket: RoomSocket;
  selfId: string;
  iceServers: RTCIceServer[];
  events: VoiceMeshEvents;
}

interface PeerLink {
  connection: RTCPeerConnection;
  transceiver: RTCRtpTransceiver;
  polite: boolean;
  makingOffer: boolean;
  offerInFlight: Promise<void> | null;
  ignoreOffer: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  queue: Promise<void>;
}

/** The wire form of a local ICE candidate, as the API relays it. */
function toCandidatePayload(candidate: RTCIceCandidate): IceCandidatePayload {
  return { candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex };
}

/** The wire form of a local session description, as the API relays it. */
function toDescriptionPayload(description: RTCSessionDescription): SessionDescriptionPayload {
  return { type: description.type, sdp: description.sdp };
}

/**
 * Full-mesh voice connections built on native WebRTC. Signals travel through the room socket
 * and are relayed by the server. Negotiation follows the "perfect negotiation" pattern from
 * the MDN WebRTC guide: the polite peer rolls back its own offer when offers collide, and the
 * impolite peer ignores the colliding remote offer. Incoming signals are applied one at a time
 * per peer, and a local offer that is still being created is allowed to finish first.
 */
export class VoiceMesh {
  private readonly socket: RoomSocket;
  private readonly selfId: string;
  private readonly iceServers: RTCIceServer[];
  private readonly events: VoiceMeshEvents;
  private readonly links = new Map<string, PeerLink>();
  private localTrack: MediaStreamTrack | null = null;

  constructor(options: VoiceMeshOptions) {
    this.socket = options.socket;
    this.selfId = options.selfId;
    this.iceServers = options.iceServers;
    this.events = options.events;
    this.socket.on('rtc:signal', this.handleSignal);
  }

  setLocalTrack(track: MediaStreamTrack | null): void {
    this.localTrack = track;
    for (const link of this.links.values()) {
      void link.transceiver.sender.replaceTrack(track).catch(() => undefined);
    }
  }

  /** Makes the set of connections match the remote participants exactly. */
  sync(remoteIds: string[]): void {
    const wanted = new Set(remoteIds.filter((id) => id !== this.selfId));

    for (const id of wanted) {
      if (!this.links.has(id)) this.createLink(id);
    }
    for (const id of [...this.links.keys()]) {
      if (!wanted.has(id)) this.removeLink(id);
    }
  }

  destroy(): void {
    this.socket.off('rtc:signal', this.handleSignal);
    for (const id of [...this.links.keys()]) this.removeLink(id);
  }

  private readonly handleSignal = (payload: SignalPayload) => {
    if (!payload || typeof payload.from !== 'string') return;

    const link = this.links.get(payload.from) ?? this.createLink(payload.from);
    link.queue = link.queue
      .then(() => this.applySignal(link, payload))
      .catch((error: unknown) => console.warn('Voice signalling failed', error));
  };

  private createLink(remoteId: string): PeerLink {
    const connection = new RTCPeerConnection({ iceServers: this.iceServers });
    const transceiver = connection.addTransceiver('audio', { direction: 'sendrecv' });
    const link: PeerLink = {
      connection,
      transceiver,
      polite: this.selfId < remoteId,
      makingOffer: false,
      offerInFlight: null,
      ignoreOffer: false,
      pendingCandidates: [],
      queue: Promise.resolve(),
    };
    this.links.set(remoteId, link);

    connection.onicecandidate = ({ candidate }) => {
      if (candidate) this.socket.emit('rtc:signal', { to: remoteId, candidate: toCandidatePayload(candidate) });
    };

    connection.onnegotiationneeded = () => {
      link.makingOffer = true;
      link.offerInFlight = this.publishLocalOffer(link, remoteId);
    };

    connection.ontrack = ({ track, streams }) => {
      this.events.onStream(remoteId, streams[0] ?? new MediaStream([track]));
    };

    connection.onconnectionstatechange = () => {
      this.events.onConnectionState(remoteId, connection.connectionState);
      if (connection.connectionState === 'failed') connection.restartIce();
    };

    if (this.localTrack) {
      void transceiver.sender.replaceTrack(this.localTrack).catch(() => undefined);
    }
    return link;
  }

  private removeLink(remoteId: string): void {
    const link = this.links.get(remoteId);
    if (!link) return;

    link.connection.close();
    this.links.delete(remoteId);
    this.events.onRemoved(remoteId);
  }

  private async publishLocalOffer(link: PeerLink, remoteId: string): Promise<void> {
    try {
      await link.connection.setLocalDescription();
      const local = link.connection.localDescription;
      if (local) this.socket.emit('rtc:signal', { to: remoteId, description: toDescriptionPayload(local) });
    } catch (error) {
      console.warn('Could not start a voice connection', error);
    } finally {
      link.makingOffer = false;
      link.offerInFlight = null;
    }
  }

  private async applySignal(link: PeerLink, payload: SignalPayload): Promise<void> {
    const { connection } = link;

    if (payload.description) {
      if (link.offerInFlight) await link.offerInFlight;

      const { description } = payload;
      const offerCollision = description.type === 'offer' && connection.signalingState !== 'stable';
      link.ignoreOffer = !link.polite && offerCollision;
      if (link.ignoreOffer) {
        link.pendingCandidates = [];
        return;
      }

      if (offerCollision) await connection.setLocalDescription({ type: 'rollback' });
      await connection.setRemoteDescription(description);
      this.flushCandidates(link);

      if (description.type === 'offer') {
        await connection.setLocalDescription();
        const local = connection.localDescription;
        if (local) this.socket.emit('rtc:signal', { to: payload.from, description: toDescriptionPayload(local) });
      }
      return;
    }

    if (payload.candidate) {
      if (!connection.remoteDescription) {
        link.pendingCandidates.push(payload.candidate);
        return;
      }
      await this.addCandidate(link, payload.candidate);
    }
  }

  private async addCandidate(link: PeerLink, candidate: RTCIceCandidateInit): Promise<void> {
    try {
      await link.connection.addIceCandidate(candidate);
    } catch (error) {
      // Candidates for an offer that was superseded by a collision cannot be attached.
      if (!link.ignoreOffer) throw error;
    }
  }

  private flushCandidates(link: PeerLink): void {
    const pending = link.pendingCandidates.splice(0);
    for (const candidate of pending) {
      this.addCandidate(link, candidate).catch(() => undefined);
    }
  }
}
