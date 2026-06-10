"use client";
import { useEffect, useRef } from "react";

type FadingVideoProps = {
  src: string;
  className?: string;
  style?: React.CSSProperties;
  scale?: number;
};

const FADE_MS = 500;
const FADE_OUT_LEAD = 0.55;

export default function FadingVideo({ src, className, style, scale = 1 }: FadingVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const fadingOutRef = useRef<boolean>(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.style.opacity = "0";

    const fadeTo = (target: number, duration: number) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      const start = performance.now();
      const initial = parseFloat(video.style.opacity || "0");
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const value = initial + (target - initial) * eased;
        video.style.opacity = String(value);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(step);
    };

    const onLoaded = () => {
      video.style.opacity = "0";
      video.play().catch(() => undefined);
      fadeTo(1, FADE_MS);
    };

    const onTimeUpdate = () => {
      if (!video.duration) return;
      if (!fadingOutRef.current && video.duration - video.currentTime <= FADE_OUT_LEAD && video.duration - video.currentTime > 0) {
        fadingOutRef.current = true;
        fadeTo(0, FADE_MS);
      }
    };

    const onEnded = () => {
      video.style.opacity = "0";
      setTimeout(() => {
        video.currentTime = 0;
        video.play().catch(() => undefined);
        fadingOutRef.current = false;
        fadeTo(1, FADE_MS);
      }, 100);
    };

    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [src]);

  const computedStyle: React.CSSProperties = scale > 1
    ? { width: `${scale * 100}%`, height: `${scale * 100}%`, ...style }
    : { width: "100%", height: "100%", ...style };

  return (
    <video
      ref={videoRef}
      src={src}
      muted
      playsInline
      preload="auto"
      className={className}
      style={computedStyle}
    />
  );
}
