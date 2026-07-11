"use client";

import { useEffect, useRef } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { ConnectionState, RoomEvent } from "livekit-client";

/** Aplica preferencias del lobby tras conectar, sin bloquear la sala si falla el dispositivo. */
export default function PrejoinMediaSync({ inviteCode }: { inviteCode: string }) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const appliedRef = useRef(false);

  useEffect(() => {
    if (appliedRef.current) return;
    if (room.state !== ConnectionState.Connected) return;

    let prejoin: { camOn?: boolean; mediaGranted?: boolean } = {};
    try {
      prejoin = JSON.parse(
        sessionStorage.getItem(`prejoin:${inviteCode}`) ?? "{}"
      ) as typeof prejoin;
    } catch {
      prejoin = {};
    }

    if (!prejoin.camOn || !prejoin.mediaGranted) {
      appliedRef.current = true;
      return;
    }

    appliedRef.current = true;
    void localParticipant.setCameraEnabled(true).catch(() => {
      // El usuario puede activar la cámara manualmente desde los controles.
    });
  }, [room.state, localParticipant, inviteCode]);

  useEffect(() => {
    function onConnected() {
      appliedRef.current = false;
    }
    room.on(RoomEvent.Connected, onConnected);
    return () => {
      room.off(RoomEvent.Connected, onConnected);
    };
  }, [room]);

  return null;
}
