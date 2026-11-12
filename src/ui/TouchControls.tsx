import { useCallback, useEffect, useState } from 'react';
import type { GameEngine } from '../game/GameEngine';
import type { ActionName } from '../game/types';
import { BrakeIcon, GasIcon, TiltDownIcon, TiltUpIcon } from './Icons';

interface HoldProps {
  action: ActionName;
  engineRef: React.MutableRefObject<GameEngine | null>;
  size: 'small' | 'medium' | 'large';
  label: string;
  children: React.ReactNode;
  onPress?: () => void;
}

/**
 * Press-and-hold control that works identically for mouse, pen and multi-touch
 * via Pointer Events. Release is guaranteed through pointer capture plus a
 * global safety net so a button can never get stuck down.
 */
function HoldButton({ action, engineRef, size, label, children, onPress }: HoldProps) {
  const [pressed, setPressed] = useState(false);

  const release = useCallback(() => {
    setPressed(false);
    engineRef.current?.input.setPointerAction(action, false);
  }, [action, engineRef]);

  useEffect(() => {
    if (!pressed) return;
    const safety = () => release();
    window.addEventListener('pointerup', safety);
    window.addEventListener('pointercancel', safety);
    window.addEventListener('blur', safety);
    return () => {
      window.removeEventListener('pointerup', safety);
      window.removeEventListener('pointercancel', safety);
      window.removeEventListener('blur', safety);
    };
  }, [pressed, release]);

  const press = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* older browsers */
    }
    engineRef.current?.input.setPointerAction(action, true);
    setPressed(true);
    onPress?.();
  };

  return (
    <button
      type="button"
      className={`control-btn ${size} ${pressed ? 'pressed' : ''}`}
      aria-label={label}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={() => pressed && release()}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
      style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
    >
      {children}
      <span className="touch-label">{label}</span>
    </button>
  );
}

interface Props {
  engineRef: React.MutableRefObject<GameEngine | null>;
  visible: boolean;
  onAnyPress?: () => void;
}

export function TouchControls({ engineRef, visible, onAnyPress }: Props) {
  if (!visible) return null;
  return (
    <div className="touch-layer">
      <div className="touch-side">
        <HoldButton action="brake" engineRef={engineRef} size="medium" label="Brake" onPress={onAnyPress}>
          <BrakeIcon />
        </HoldButton>
      </div>

      <div className="touch-center">
        <HoldButton action="left" engineRef={engineRef} size="small" label="Nose up" onPress={onAnyPress}>
          <TiltUpIcon />
        </HoldButton>
        <HoldButton action="right" engineRef={engineRef} size="small" label="Nose down" onPress={onAnyPress}>
          <TiltDownIcon />
        </HoldButton>
      </div>

      <div className="touch-side">
        <HoldButton action="throttle" engineRef={engineRef} size="large" label="Throttle" onPress={onAnyPress}>
          <GasIcon />
        </HoldButton>
      </div>
    </div>
  );
}
