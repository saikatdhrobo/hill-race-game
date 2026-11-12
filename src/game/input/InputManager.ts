import type { ActionName, ControlState } from '../types';

const KEY_MAP: Record<string, ActionName> = {
  KeyW: 'throttle',
  ArrowUp: 'throttle',
  KeyS: 'brake',
  ArrowDown: 'brake',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'handbrake',
  ShiftLeft: 'handbrake',
};

/**
 * One input surface for keyboard, mouse and touch.
 * Keyboard state and pointer (button) state are tracked separately and then
 * OR-ed together, so a player can hold a touch button and a key at the same
 * time without either cancelling the other.
 */
export class InputManager {
  private readonly keyboard = new Set<ActionName>();
  private readonly pointer = new Set<ActionName>();
  private readonly controls: ControlState = { throttle: 0, brake: 0, steer: 0, tilt: 0, handbrake: 0 };

  onPause?: () => void;
  onRestart?: () => void;
  enabled = true;

  private readonly handleKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) {
      if (KEY_MAP[e.code]) e.preventDefault();
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      this.onPause?.();
      e.preventDefault();
      return;
    }
    if (e.code === 'KeyR') {
      this.onRestart?.();
      e.preventDefault();
      return;
    }
    const action = KEY_MAP[e.code];
    if (action) {
      this.keyboard.add(action);
      e.preventDefault();
    }
  };

  private readonly handleKeyUp = (e: KeyboardEvent) => {
    const action = KEY_MAP[e.code];
    if (action) this.keyboard.delete(action);
  };

  private readonly clearAll = () => {
    this.keyboard.clear();
    this.pointer.clear();
  };

  attach(): void {
    window.addEventListener('keydown', this.handleKeyDown, { passive: false });
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clearAll);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clearAll();
    });
  }

  detach(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.clearAll);
  }

  /** Called by the on-screen buttons (mouse or touch, press-and-hold). */
  setPointerAction(action: ActionName, active: boolean): void {
    if (active) this.pointer.add(action);
    else this.pointer.delete(action);
  }

  releaseAllPointerActions(): void {
    this.pointer.clear();
  }

  private isActive(action: ActionName): boolean {
    return this.keyboard.has(action) || this.pointer.has(action);
  }

  /** Merged, smoothed control state for this frame. */
  sample(dt: number): ControlState {
    const throttle = this.isActive('throttle') ? 1 : 0;
    const brake = this.isActive('brake') ? 1 : 0;
    const left = this.isActive('left');
    const right = this.isActive('right');
    const handbrake = this.isActive('handbrake') ? 1 : 0;

    const steerTarget = (right ? 1 : 0) - (left ? 1 : 0);
    const tiltTarget = (left ? 1 : 0) - (right ? 1 : 0);

    const c = this.controls;
    if (!this.enabled) {
      c.throttle = 0;
      c.brake = 0;
      c.steer = 0;
      c.tilt = 0;
      c.handbrake = 0;
      return c;
    }
    // ramp digital inputs so keyboard-only players still get analogue feel
    const rate = dt * 9;
    c.throttle += Math.sign(throttle - c.throttle) * Math.min(Math.abs(throttle - c.throttle), rate);
    c.brake += Math.sign(brake - c.brake) * Math.min(Math.abs(brake - c.brake), rate * 1.6);
    c.handbrake += Math.sign(handbrake - c.handbrake) * Math.min(Math.abs(handbrake - c.handbrake), rate * 2);
    c.steer += Math.sign(steerTarget - c.steer) * Math.min(Math.abs(steerTarget - c.steer), rate * 1.4);
    c.tilt = tiltTarget;
    return c;
  }
}
