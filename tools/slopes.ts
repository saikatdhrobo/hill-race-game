import { TerrainGenerator } from '../src/game/terrain/TerrainGenerator';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../src/game/difficulties';
import { ENVIRONMENTS } from '../src/game/environments';

for (const d of DIFFICULTY_ORDER) {
  const t = new TerrainGenerator(ENVIRONMENTS.highlands, DIFFICULTIES[d], 12345).generate();
  let worst: { x: number; deg: number }[] = [];
  for (let x = 0; x < t.finishX; x += 0.5) {
    const a = t.sampleHeight(x, 0), b = t.sampleHeight(x + 0.5, 0);
    const deg = (Math.atan2(b - a, 0.5) * 180) / Math.PI;
    worst.push({ x, deg });
  }
  worst.sort((p, q) => q.deg - p.deg);
  const steep = worst.slice(0, 5).map((w) => `${w.x.toFixed(0)}m:${w.deg.toFixed(0)}°`).join(' ');
  const descents = [...worst].sort((p, q) => p.deg - q.deg).slice(0, 3).map((w) => `${w.x.toFixed(0)}m:${w.deg.toFixed(0)}°`).join(' ');
  const dist = [0, 20, 40, 60, 80, 100].map((x) => `${x}:${t.sampleHeight(x, 0).toFixed(1)}`).join(' ');
  console.log(`${d.padEnd(7)} steepest climbs ${steep} | descents ${descents}`);
  console.log(`        profile ${dist}`);
}
