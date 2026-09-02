"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { UgcVideoResult } from "@/lib/ugc-video-studio/contracts";

export function ugcPlaybackSource(url: string, revision: number): string {
  if (revision <= 0) return url;
  return `${url}${url.includes("?") ? "&" : "?"}playback=${revision}`;
}

export function UgcResultVideo(props: {
  result: UgcVideoResult;
  autoPlay?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const automaticRefreshUsedRef = useRef(false);
  const [revision, setRevision] = useState(0);
  const [reloadRequired, setReloadRequired] = useState(false);

  const refresh = useCallback((automatic: boolean) => {
    if (automatic && automaticRefreshUsedRef.current) {
      setReloadRequired(true);
      return;
    }
    if (automatic) automaticRefreshUsedRef.current = true;
    setReloadRequired(false);
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    automaticRefreshUsedRef.current = false;
    setReloadRequired(false);
    setRevision(0);
  }, [props.result.id, props.result.url]);

  useEffect(() => {
    const recoverIfNeeded = () => {
      if (document.visibilityState !== "hidden" && videoRef.current?.error) {
        refresh(true);
      }
    };
    document.addEventListener("visibilitychange", recoverIfNeeded);
    window.addEventListener("pageshow", recoverIfNeeded);
    return () => {
      document.removeEventListener("visibilitychange", recoverIfNeeded);
      window.removeEventListener("pageshow", recoverIfNeeded);
    };
  }, [refresh]);

  return (
    <>
      <video
        ref={videoRef}
        className={props.className}
        src={ugcPlaybackSource(props.result.url, revision)}
        controls
        autoPlay={props.autoPlay}
        playsInline
        preload="metadata"
        onError={() => refresh(true)}
        onCanPlay={() => {
          automaticRefreshUsedRef.current = false;
          setReloadRequired(false);
        }}
      />
      {reloadRequired ? (
        <button
          type="button"
          className="uv-video-reload"
          onClick={() => refresh(false)}
        >
          <RotateCcw size={15} /> Video erneut laden
        </button>
      ) : null}
    </>
  );
}
