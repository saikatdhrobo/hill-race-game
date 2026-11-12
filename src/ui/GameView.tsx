import { useEffect, useRef, useState } from 'react';
import type { GameEngine } from '../game/GameEngine';
import type { SaveManager } from '../game/save/SaveManager';
import type { AudioManager } from '../game/audio/AudioManager';
import type { DifficultyId, EngineCallbacks, EnvironmentId, VehicleId } from '../game/types';
import { LoadingOverlay } from './Overlays';

interface Props {
  runKey: number;
  vehicleId: VehicleId;
  environmentId: EnvironmentId;
  difficulty: DifficultyId;
  save: SaveManager;
  audio: AudioManager;
  lowQuality: boolean;
  callbacks: EngineCallbacks;
  engineRef: React.MutableRefObject<GameEngine | null>;
}

/**
 * Mounts one canvas + GameEngine pair. Remounting (new runKey) rebuilds the
 * whole world, which is what "start a new stage" means here.
 */
export function GameView({
  runKey,
  vehicleId,
  environmentId,
  difficulty,
  save,
  audio,
  lowQuality,
  callbacks,
  engineRef,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let disposed = false;
    let engine: GameEngine | null = null;
    let cleanupListeners = () => {};

    void (async () => {
      // rapier ships ~800kb of wasm — load it only when a run actually starts
      const { GameEngine: Engine } = await import('../game/GameEngine');
      if (disposed) return;
      engine = new Engine({
        canvas,
        vehicleId,
        environmentId,
        difficulty,
        save,
        audio,
        lowQuality,
        callbacks: {
          onHud: (s) => callbacksRef.current.onHud(s),
          onCrash: (r, reason) => callbacksRef.current.onCrash(r, reason),
          onComplete: (r) => callbacksRef.current.onComplete(r),
          onCheckpoint: (i, left) => callbacksRef.current.onCheckpoint(i, left),
          onPauseChange: (p) => callbacksRef.current.onPauseChange?.(p),
        },
      });
      engineRef.current = engine;
      if (import.meta.env.DEV) {
        (window as unknown as { __engine?: GameEngine }).__engine = engine;
      }

      const active = engine;
      const resize = () => {
        const rect = wrap.getBoundingClientRect();
        active.resize(Math.max(1, rect.width), Math.max(1, rect.height));
      };
      const handleVisibility = () => active.handleVisibility(document.hidden);
      window.addEventListener('resize', resize);
      window.addEventListener('orientationchange', resize);
      document.addEventListener('visibilitychange', handleVisibility);
      cleanupListeners = () => {
        window.removeEventListener('resize', resize);
        window.removeEventListener('orientationchange', resize);
        document.removeEventListener('visibilitychange', handleVisibility);
      };

      await active.init();
      if (disposed) return;
      resize();
      setLoading(false);
    })();

    return () => {
      disposed = true;
      cleanupListeners();
      engine?.dispose();
      if (engineRef.current === engine) engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  return (
    <div className="game-layer" ref={wrapRef}>
      <canvas ref={canvasRef} className="game-canvas" />
      {loading && <LoadingOverlay />}
    </div>
  );
}
