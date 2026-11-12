export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Frame-rate independent exponential smoothing factor. */
export const dampFactor = (lambda: number, dt: number): number =>
  1 - Math.exp(-lambda * dt);

export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, dampFactor(lambda, dt));

export const moveTowards = (current: number, target: number, maxDelta: number): number => {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
};

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface QuatLike {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Rotates a vector by a quaternion without pulling in a maths library.
 * Equivalent to THREE.Vector3.applyQuaternion but dependency free so the
 * physics layer stays headless-testable.
 */
export function rotateVector(q: QuatLike, v: Vec3Like): Vec3Like {
  const ix = q.w * v.x + q.y * v.z - q.z * v.y;
  const iy = q.w * v.y + q.z * v.x - q.x * v.z;
  const iz = q.w * v.z + q.x * v.y - q.y * v.x;
  const iw = -q.x * v.x - q.y * v.y - q.z * v.z;
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  };
}

export function quatToForward(q: QuatLike): Vec3Like {
  return rotateVector(q, { x: 1, y: 0, z: 0 });
}

export function quatToUp(q: QuatLike): Vec3Like {
  return rotateVector(q, { x: 0, y: 1, z: 0 });
}

export function quatToRight(q: QuatLike): Vec3Like {
  return rotateVector(q, { x: 0, y: 0, z: 1 });
}
