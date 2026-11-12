/**
 * Central tuning values. Everything that affects the "feel" of the game lives
 * here so it can be tweaked without touching systems code.
 */
export const GAME_CONFIG = {
  gravity: -20,
  fixedTimestep: 1 / 60,
  maxSubSteps: 6,

  /** metres of track before the car can crash into the "start" plateau edge */
  startPadLength: 18,

  camera: {
    distance: 8.3,
    height: 3.9,
    lookAhead: 7.5,
    lookHeight: 1.1,
    positionLerp: 5.5,
    yawLerp: 3.2,
    speedPullback: 0.09, // extra distance per m/s
    shakeDecay: 5.5,
  },

  vehicle: {
    /** how strongly air tilt input spins the chassis (rad/s) */
    airPitchRate: 3.0,
    airYawDamp: 1.6,
    /** gravity multiplier while airborne so jumps feel controlled */
    airGravityScale: 1.0,
    brakeForce: 9,
    handbrakeForce: 26,
    reverseForceFactor: 0.3,
    reverseMaxSpeed: 9,
    maxSteerAngle: 0.42,
    steerResponse: 6.5,
    drag: 0.0021,
    rollingResistance: 1.4,
    /** fraction of top speed where engine force starts to fade out */
    powerBandStart: 0.55,
    /** recovered from a fully flipped car after this many seconds */
    flipCrashTime: 1.15,
    stuckSpeed: 1.4,
    stuckCrashTime: 2.6,
    beachedTime: 3.4,
    stuckUpDot: 0.42,
    fallCrashDepth: 34,
  },

  coins: {
    pickupRadius: 2.35,
    spacing: 16,
    value: 1,
    scoreValue: 25,
  },

  scoring: {
    distanceScore: 10,
    checkpointBonus: 120,
  },

  difficulty: {
    rewards: { easy: 1, medium: 1.35, hard: 1.8 } as Record<string, number>,
  },

  physics: {
    maxWheelContacts: 4,
  },
} as const;
