import type { VehicleId } from './types';

export interface VehicleConfig {
  id: VehicleId;
  name: string;
  className: string;
  blurb: string;
  cost: number;
  /** chassis half extents (x = length, y = height, z = width) */
  half: { x: number; y: number; z: number };
  wheel: {
    radius: number;
    width: number;
    /** connection points relative to chassis centre */
    frontX: number;
    rearX: number;
    halfTrack: number;
    connectionY: number;
    restLength: number;
    travel: number;
    stiffness: number;
    compression: number;
    relaxation: number;
    maxForce: number;
  };
  mass: number;
  engineForce: number;
  maxSpeed: number;
  /** 0..1 grip multiplier */
  grip: number;
  /** how much the chassis resists roll (0..1) */
  rollResist: number;
  /** fraction of engine force applied to the front axle */
  frontDrive: number;
  steerRate: number;
  colors: { body: string; accent: string; trim: string; glass: string; rim: string };
  style: 'buggy' | 'monster' | 'rally' | 'pickup' | 'suv';
}

export const VEHICLES: Record<VehicleId, VehicleConfig> = {
  tumble: {
    id: 'tumble',
    name: 'Tumble',
    className: 'Trail Buggy',
    blurb: 'Featherweight tube-frame buggy. Nippy, forgiving suspension and quick to recover in the air. The perfect starting rig.',
    cost: 0,
    half: { x: 1.3, y: 0.28, z: 0.72 },
    wheel: {
      radius: 0.45,
      width: 0.32,
      frontX: 0.92,
      rearX: -0.92,
      halfTrack: 0.76,
      connectionY: 0.3,
      restLength: 0.5,
      travel: 0.36,
      stiffness: 58,
      compression: 1.5,
      relaxation: 1.9,
      maxForce: 34000,
    },
    mass: 620,
    engineForce: 6800,
    maxSpeed: 26,
    grip: 1.0,
    rollResist: 1,
    frontDrive: 0.35,
    steerRate: 5.5,
    colors: { body: '#f4683c', accent: '#ffd166', trim: '#2b2f36', glass: '#9fd8e8', rim: '#d8dce3' },
    style: 'buggy',
  },
  boulder: {
    id: 'boulder',
    name: 'Boulder',
    className: 'Monster Truck',
    blurb: 'Enormous wheels and a huge torque curve. Climbs almost anything, but it is heavy and hates tight landings.',
    cost: 300,
    half: { x: 1.55, y: 0.4, z: 0.88 },
    wheel: {
      radius: 0.66,
      width: 0.52,
      frontX: 1.12,
      rearX: -1.12,
      halfTrack: 0.92,
      connectionY: 0.44,
      restLength: 0.66,
      travel: 0.44,
      stiffness: 66,
      compression: 1.7,
      relaxation: 2.2,
      maxForce: 60000,
    },
    mass: 980,
    engineForce: 11500,
    maxSpeed: 22,
    grip: 1.05,
    rollResist: 0.85,
    frontDrive: 0.45,
    steerRate: 4.4,
    colors: { body: '#3f78c9', accent: '#7ee0a8', trim: '#1b2330', glass: '#bfe6f3', rim: '#c7ccd4' },
    style: 'monster',
  },
  ridgeback: {
    id: 'ridgeback',
    name: 'Ridgeback',
    className: 'Rally Coupe',
    blurb: 'Low, quick and planted. Highest top speed in the garage with stiff suspension that rewards clean racing lines.',
    cost: 650,
    half: { x: 1.45, y: 0.26, z: 0.7 },
    wheel: {
      radius: 0.42,
      width: 0.34,
      frontX: 1.02,
      rearX: -1.02,
      halfTrack: 0.72,
      connectionY: 0.26,
      restLength: 0.44,
      travel: 0.32,
      stiffness: 70,
      compression: 1.9,
      relaxation: 2.3,
      maxForce: 36000,
    },
    mass: 700,
    engineForce: 7600,
    maxSpeed: 31,
    grip: 1.08,
    rollResist: 1.15,
    frontDrive: 0.4,
    steerRate: 6.2,
    colors: { body: '#e8e9ee', accent: '#e0344b', trim: '#22262e', glass: '#a9cfe0', rim: '#2f333b' },
    style: 'rally',
  },
  hauly: {
    id: 'hauly',
    name: 'Hauly',
    className: 'Ridge Pickup',
    blurb: 'Long-wheelbase hauler with a fat torque band. Stable and forgiving, but it understeers on tight switchbacks.',
    cost: 1100,
    half: { x: 1.7, y: 0.34, z: 0.82 },
    wheel: {
      radius: 0.5,
      width: 0.4,
      frontX: 1.18,
      rearX: -1.2,
      halfTrack: 0.82,
      connectionY: 0.32,
      restLength: 0.52,
      travel: 0.38,
      stiffness: 64,
      compression: 1.7,
      relaxation: 2.0,
      maxForce: 46000,
    },
    mass: 860,
    engineForce: 9200,
    maxSpeed: 24,
    grip: 1.02,
    rollResist: 0.95,
    frontDrive: 0.3,
    steerRate: 4.8,
    colors: { body: '#d9a13b', accent: '#2f3540', trim: '#1f242c', glass: '#b6dbe8', rim: '#d5d9e0' },
    style: 'pickup',
  },
  apex: {
    id: 'apex',
    name: 'Apex',
    className: 'Expedition SUV',
    blurb: 'All-round expedition rig. Balanced power, tall clearance and very forgiving landings — the safe choice on Hard.',
    cost: 1700,
    half: { x: 1.5, y: 0.36, z: 0.8 },
    wheel: {
      radius: 0.52,
      width: 0.38,
      frontX: 1.06,
      rearX: -1.06,
      halfTrack: 0.86,
      connectionY: 0.36,
      restLength: 0.54,
      travel: 0.4,
      stiffness: 62,
      compression: 1.6,
      relaxation: 2.1,
      maxForce: 48000,
    },
    mass: 780,
    engineForce: 8600,
    maxSpeed: 27,
    grip: 1.04,
    rollResist: 1.05,
    frontDrive: 0.42,
    steerRate: 5.2,
    colors: { body: '#4c6b52', accent: '#f0b429', trim: '#252b26', glass: '#c3e2ea', rim: '#b9bfc6' },
    style: 'suv',
  },
};

export const VEHICLE_ORDER: VehicleId[] = ['tumble', 'boulder', 'ridgeback', 'hauly', 'apex'];
