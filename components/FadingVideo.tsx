"use client";
import { useEffect, useRef, useState } from "react";

type FadingVideoProps = {
  src: string;
  className?: string;
  style?: React.CSSProperties;
  scale?: number;
  poster?: string;
  preload?: "auto" | "metadata" | "none";
};

const FADE_MS = 600;
const FADE_OUT_LEAD = 0.6;

export default function FadingVideo({ src, className, style, scale = 1, poster, preload = "metadata" }: FadingVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const isVisibleRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (restartTimerRef.current !== null) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    isVisibleRef.current = false;
    video.style.opacity = "0";
    try { video.currentTime = 0; } catch { /* ignore */ }
    setFailed(false);

    const fadeTo = (target: number, duration: number) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      const start = performance.now();
      const initial = parseFloat(video.style.opacity || "0");
      const step = (now: number) => {
        if (!mountedRef.current) return;
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

    const fadeIn = () => {
      isVisibleRef.current = true;
      fadeTo(1, FADE_MS);
    };

    const fadeOutAndLoop = () => {
      isVisibleRef.current = false;
      fadeTo(0, FADE_MS);
      if (restartTimerRef.current !== null) {
        clearTimeout(restartTimerRef.current);
      }
      restartTimerRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        try { video.currentTime = 0; } catch { /* ignore */ }
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => undefined);
        }
        fadeIn();
      }, 250);
    };

    const startPlayback = () => {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => undefined);
      }
      fadeIn();
    };

    const onCanPlay = () => {
      if (!isVisibleRef.current && video.paused) {
        startPlayback();
      }
    };

    const onPlaying = () => {
      if (!isVisibleRef.current) {
        fadeIn();
      }
    };

    const onTimeUpdate = () => {
      if (!video.duration || isVisibleRef.current === false) return;
      const remaining = video.duration - video.currentTime;
      if (remaining <= FADE_OUT_LEAD && remaining > 0) {
        fadeOutAndLoop();
      }
    };

    const onPause = () => {
      if (mountedRef.current && isVisibleRef.current === false) {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => undefined);
        }
      }
    };

    const onError = () => {
      // eslint-disable-next-line no-console
      console.warn("[FadingVideo] no se pudo cargar", src);
      if (mountedRef.current) setFailed(true);
    };

    // Fallback para móviles: si el autoplay falla por restricciones del navegador,
    // intentar reproducir en la primera interacción del usuario
    const onFirstInteraction = () => {
      if (video.paused) {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => undefined);
        }
      }
      document.removeEventListener("touchstart", onFirstInteraction);
      document.removeEventListener("click", onFirstInteraction);
      document.removeEventListener("scroll", onFirstInteraction);
    };
    document.addEventListener("touchstart", onFirstInteraction, { passive: true });
    document.addEventListener("click", onFirstInteraction);
    document.addEventListener("scroll", onFirstInteraction, { passive: true });

    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onError);

    if (video.readyState >= 3) {
      startPlayback();
    }

    return () => {
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onError);
      document.removeEventListener("touchstart", onFirstInteraction);
      document.removeEventListener("click", onFirstInteraction);
      document.removeEventListener("scroll", onFirstInteraction);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (restartTimerRef.current !== null) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
    };
  }, [src]);

  const computedStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    ...style
  };
  if (scale > 1) {
    computedStyle.width = `${scale * 100}%`;
    computedStyle.height = `${scale * 100}%`;
  }

  return (
    <>
      {failed && (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklch, var(--color-gold) 15%, transparent), transparent 70%)"
          }}
        />
      )}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        muted
        autoPlay
        loop
        playsInline
        preload={preload}
        width="100%"
        height="100%"
        disablePictureInPicture
        {...({
          webkitPlaysinline: true,
          "x5-playsinline": "true",
          "x5-video-player-type": "h5"
        } as React.VideoHTMLAttributes<HTMLVideoElement>)}
        className={className}
        style={computedStyle}
      />
    </>
  );
}
