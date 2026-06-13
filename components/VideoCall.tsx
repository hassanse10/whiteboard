"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "../lib/socket";
import type { Identity } from "../lib/identity";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

type Peer = {
  socketId: string;
  name: string;
  color: string;
  stream: MediaStream | null;
};

type VideoCallProps = {
  identity: Identity;
};

export default function VideoCall({ identity }: VideoCallProps) {
  const [inCall, setInCall] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const [error, setError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const createPeerConnection = useCallback((peerId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        getSocket().emit("call-signal", {
          to: peerId,
          signal: { type: "candidate", candidate: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      setPeers((prev) => ({
        ...prev,
        [peerId]: {
          ...(prev[peerId] || { socketId: peerId, name: "", color: "#999999" }),
          stream: event.streams[0]
        }
      }));
    };

    peerConnectionsRef.current.set(peerId, pc);
    return pc;
  }, []);

  const cleanupPeer = useCallback((peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    pc?.close();
    peerConnectionsRef.current.delete(peerId);
    setPeers((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, []);

  const leaveCall = useCallback(() => {
    const socket = getSocket();
    socket.emit("call-leave");

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    setPeers({});

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    setInCall(false);
  }, []);

  const joinCall = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setMicOn(true);
      setCamOn(true);
      setInCall(true);
      getSocket().emit("call-join");
    } catch (err) {
      console.error("Failed to access camera/microphone", err);
      setError("Could not access camera or microphone");
    }
  }, []);

  useEffect(() => {
    if (inCall && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [inCall]);

  useEffect(() => {
    const socket = getSocket();

    const handlePeers = async ({ peers: existingPeers }: { peers: { socketId: string; name: string; color: string }[] }) => {
      for (const peer of existingPeers) {
        setPeers((prev) => ({
          ...prev,
          [peer.socketId]: { socketId: peer.socketId, name: peer.name, color: peer.color, stream: null }
        }));

        const pc = createPeerConnection(peer.socketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call-signal", { to: peer.socketId, signal: { type: "offer", sdp: offer } });
      }
    };

    const handlePeerJoined = ({ socketId, name, color }: { socketId: string; name: string; color: string }) => {
      setPeers((prev) => ({
        ...prev,
        [socketId]: { socketId, name, color, stream: null }
      }));
    };

    const handleSignal = async ({ from, signal }: { from: string; signal: any }) => {
      let pc = peerConnectionsRef.current.get(from);

      if (signal.type === "offer") {
        if (!pc) {
          pc = createPeerConnection(from);
        }
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call-signal", { to: from, signal: { type: "answer", sdp: answer } });
      } else if (signal.type === "answer") {
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        }
      } else if (signal.type === "candidate") {
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      }
    };

    const handlePeerLeft = ({ socketId }: { socketId: string }) => {
      cleanupPeer(socketId);
    };

    socket.on("call-peers", handlePeers);
    socket.on("call-peer-joined", handlePeerJoined);
    socket.on("call-signal", handleSignal);
    socket.on("call-peer-left", handlePeerLeft);

    return () => {
      socket.off("call-peers", handlePeers);
      socket.off("call-peer-joined", handlePeerJoined);
      socket.off("call-signal", handleSignal);
      socket.off("call-peer-left", handlePeerLeft);
    };
  }, [createPeerConnection, cleanupPeer]);

  useEffect(() => {
    return () => {
      if (inCall) {
        leaveCall();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const enabled = !micOn;
    stream.getAudioTracks().forEach((track) => (track.enabled = enabled));
    setMicOn(enabled);
  };

  const toggleCam = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const enabled = !camOn;
    stream.getVideoTracks().forEach((track) => (track.enabled = enabled));
    setCamOn(enabled);
  };

  const peerList = Object.values(peers);

  return (
    <div className="video-call">
      {!inCall ? (
        <button type="button" className="call-toggle" onClick={joinCall} title="Start video call" aria-label="Start video call">
          <CallIcon name="video" />
          {error ? <span className="call-error">{error}</span> : null}
        </button>
      ) : (
        <div className="call-panel">
          <div className="call-tiles">
            <div className="call-tile local">
              <video ref={localVideoRef} autoPlay playsInline muted />
              <span className="tile-label" style={{ backgroundColor: identity.color }}>
                {identity.name} (you)
              </span>
            </div>
            {peerList.map((peer) => (
              <PeerTile key={peer.socketId} peer={peer} />
            ))}
          </div>
          <div className="call-controls">
            <button
              type="button"
              className={micOn ? "call-btn" : "call-btn off"}
              onClick={toggleMic}
              title={micOn ? "Mute microphone" : "Unmute microphone"}
              aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
            >
              <CallIcon name={micOn ? "mic" : "micOff"} />
            </button>
            <button
              type="button"
              className={camOn ? "call-btn" : "call-btn off"}
              onClick={toggleCam}
              title={camOn ? "Turn off camera" : "Turn on camera"}
              aria-label={camOn ? "Turn off camera" : "Turn on camera"}
            >
              <CallIcon name={camOn ? "video" : "videoOff"} />
            </button>
            <button type="button" className="call-btn leave" onClick={leaveCall} title="Leave call" aria-label="Leave call">
              <CallIcon name="phoneOff" />
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .video-call {
          position: absolute;
          top: 112px;
          right: 16px;
          z-index: 10;
        }

        .call-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          padding: 0;
          border: none;
          border-radius: 12px;
          background: #ffffff;
          color: #1e1e1e;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12), 0 2px 4px rgba(15, 23, 42, 0.08);
          cursor: pointer;
        }

        .call-toggle:hover {
          background: #f1f0ff;
          color: #4f46e5;
        }

        .call-error {
          position: absolute;
          top: 48px;
          right: 0;
          white-space: nowrap;
          background: #ffffff;
          color: #e03131;
          font-size: 0.78rem;
          padding: 4px 8px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
        }

        .call-panel {
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: #ffffff;
          border-radius: 12px;
          padding: 10px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12), 0 2px 4px rgba(15, 23, 42, 0.08);
          width: 220px;
        }

        .call-tiles {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 320px;
          overflow-y: auto;
        }

        .call-tile {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 3;
          border-radius: 8px;
          overflow: hidden;
          background: #1e1e1e;
        }

        .call-tile video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1);
        }

        .tile-label {
          position: absolute;
          bottom: 4px;
          left: 4px;
          font-size: 0.7rem;
          color: #ffffff;
          padding: 2px 6px;
          border-radius: 6px;
          background: rgba(0, 0, 0, 0.35);
        }

        .call-controls {
          display: flex;
          gap: 6px;
          justify-content: center;
        }

        .call-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 8px;
          background: #f1f0ff;
          color: #1e1e1e;
          cursor: pointer;
        }

        .call-btn:hover {
          background: #e5e3ff;
        }

        .call-btn.off {
          background: #ffe3e3;
          color: #e03131;
        }

        .call-btn.leave {
          background: #e03131;
          color: #ffffff;
        }

        .call-btn.leave:hover {
          background: #c92a2a;
        }

        @media (max-width: 640px) {
          .video-call {
            top: 100px;
            right: 8px;
          }

          .call-panel {
            width: 160px;
          }
        }
      `}</style>
    </div>
  );
}

function PeerTile({ peer }: { peer: Peer }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  return (
    <div className="call-tile">
      <video ref={videoRef} autoPlay playsInline />
      <span className="tile-label" style={{ backgroundColor: peer.color }}>
        {peer.name || "Guest"}
      </span>
      <style jsx>{`
        .call-tile {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 3;
          border-radius: 8px;
          overflow: hidden;
          background: #1e1e1e;
        }

        .call-tile video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .tile-label {
          position: absolute;
          bottom: 4px;
          left: 4px;
          font-size: 0.7rem;
          color: #ffffff;
          padding: 2px 6px;
          border-radius: 6px;
          background: rgba(0, 0, 0, 0.35);
        }
      `}</style>
    </div>
  );
}

type CallIconName = "video" | "videoOff" | "mic" | "micOff" | "phoneOff";

function CallIcon({ name }: { name: CallIconName }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {callIconPaths[name]}
    </svg>
  );
}

const callIconPaths: Record<CallIconName, React.ReactNode> = {
  video: (
    <>
      <path d="m16 13 5.5-3.5a1 1 0 0 1 1.5.87v7.26a1 1 0 0 1-1.5.87L16 15" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </>
  ),
  videoOff: (
    <>
      <path d="M2 2 22 22" />
      <path d="M16 13 21.5 9.5a1 1 0 0 1 1.5.87v7.26a1 1 0 0 1-1.5.87L16 15" />
      <path d="M9 6H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h7" />
      <path d="M14 6h0a2 2 0 0 1 2 2v0" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 17v4" />
      <path d="M8 21h8" />
    </>
  ),
  micOff: (
    <>
      <path d="M2 2 22 22" />
      <path d="M9 9v2a3 3 0 0 0 5.12 2.12" />
      <path d="M15 5a3 3 0 0 0-6 0v3" />
      <path d="M5 10a7 7 0 0 0 11.36 5.49" />
      <path d="M19 10a7 7 0 0 1-.46 2.46" />
      <path d="M12 17v4" />
      <path d="M8 21h8" />
    </>
  ),
  phoneOff: (
    <>
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92" />
      <path d="M22 22 2 2" />
      <path d="M8.16 8.16A12.84 12.84 0 0 0 8 5.18 2 2 0 0 1 9.91 3h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.7 2.34" />
      <path d="M14.5 11.5 22 19" />
      <path d="M2 5.18a2 2 0 0 1 2-1.18 12.84 12.84 0 0 0 2.81.7" />
    </>
  )
};
