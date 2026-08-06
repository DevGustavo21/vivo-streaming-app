"use client";

import { useEffect } from "react";
import { resetCameraSessionState } from "@/lib/camera";

/** Estado de cámara en memoria (facing) se reinicia al entrar a cada sala. */
export default function CameraSessionInit({ inviteCode }: { inviteCode: string }) {
  useEffect(() => {
    resetCameraSessionState();
  }, [inviteCode]);

  return null;
}
