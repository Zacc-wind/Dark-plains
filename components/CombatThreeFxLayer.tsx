'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { BattleLogEntry, BattleLogStyle, BattleState, BattleUnit } from '@/lib/battle';

interface CombatThreeFxLayerProps {
  battle: BattleState;
}

interface RuntimeCombatEffect {
  root: THREE.Group;
  life: number;
  maxLife: number;
  update: (delta: number, progress: number) => void;
}

interface RuntimeContext {
  scene: THREE.Scene;
  spawnBattleLog: (battle: BattleState, entry: BattleLogEntry) => void;
  dispose: () => void;
}

interface ParticleRuntime {
  points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  velocity: Float32Array;
}

const COLORS = {
  dust: new THREE.Color(0xd9c7a0),
  melee: new THREE.Color(0xffd9a8),
  damage: new THREE.Color(0xff4250),
  ranged: new THREE.Color(0x65d8ff),
  spell: new THREE.Color(0xb36cff),
  heal: new THREE.Color(0x66f6aa),
  shield: new THREE.Color(0x8fd8ff),
  gold: new THREE.Color(0xffcc45),
  debuff: new THREE.Color(0x9b5cff),
};

function disposeObject(object: THREE.Object3D): void {
  object.traverse(child => {
    const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach(item => item.dispose());
    } else if (material) {
      material.dispose();
    }
  });
}

function setObjectOpacity(object: THREE.Object3D, opacity: number): void {
  object.traverse(child => {
    const maybeMaterial = (child as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>).material;
    const materials = Array.isArray(maybeMaterial) ? maybeMaterial : maybeMaterial ? [maybeMaterial] : [];
    materials.forEach(material => {
      if ('opacity' in material) {
        material.opacity = opacity;
      }
    });
  });
}

function makeMaterial(color: THREE.Color, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

function makeParticleMaterial(size: number, opacity: number): THREE.PointsMaterial {
  return new THREE.PointsMaterial({
    size,
    transparent: true,
    opacity,
    vertexColors: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function addParticles(
  root: THREE.Group,
  origin: THREE.Vector3,
  color: THREE.Color,
  count: number,
  radius: number,
  speed: number,
  size: number
): ParticleRuntime {
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;
    const velocity = speed * (0.35 + Math.random() * 0.9);
    positions[index * 3] = Math.cos(angle) * distance;
    positions[index * 3 + 1] = Math.sin(angle) * distance;
    positions[index * 3 + 2] = 0;
    velocities[index * 3] = Math.cos(angle) * velocity;
    velocities[index * 3 + 1] = Math.sin(angle) * velocity + speed * 0.18;
    velocities[index * 3 + 2] = 0;
    colors[index * 3] = color.r * (0.78 + Math.random() * 0.24);
    colors[index * 3 + 1] = color.g * (0.78 + Math.random() * 0.24);
    colors[index * 3 + 2] = color.b * (0.78 + Math.random() * 0.24);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(geometry, makeParticleMaterial(size, 0.7));
  points.position.copy(origin);
  root.add(points);

  return { points, velocity: velocities };
}

function updateParticles(runtime: ParticleRuntime, delta: number, progress: number, gravity = 8): void {
  const attribute = runtime.points.geometry.getAttribute('position') as THREE.BufferAttribute;
  const positions = attribute.array as Float32Array;

  for (let index = 0; index < positions.length; index += 3) {
    positions[index] += runtime.velocity[index] * delta;
    positions[index + 1] += runtime.velocity[index + 1] * delta;
    runtime.velocity[index] *= 0.985;
    runtime.velocity[index + 1] = runtime.velocity[index + 1] * 0.982 - gravity * delta;
  }

  attribute.needsUpdate = true;
  runtime.points.material.opacity = (1 - progress) * 0.58;
  runtime.points.material.size *= 0.998;
}

function makeRing(color: THREE.Color, inner: number, outer: number, opacity: number): THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 64),
    makeMaterial(color, opacity)
  );
  return ring;
}

function getUnitCenter(unit: BattleUnit, width: number, height: number, boardWidth: number, boardHeight: number): THREE.Vector3 {
  const cellWidth = width / boardWidth;
  const cellHeight = height / boardHeight;
  return new THREE.Vector3(
    (unit.x + 0.5) * cellWidth - width / 2,
    height / 2 - (unit.y + 0.5) * cellHeight,
    0
  );
}

function getBattleLogStyle(entry: BattleLogEntry, actor?: BattleUnit): BattleLogStyle | undefined {
  if (entry.style) return entry.style;
  if (entry.action === 'move') return 'move';
  if (entry.action === 'heal') return 'heal';
  if (entry.action === 'mana') return 'mana-focus';
  if (entry.action === 'wait') return 'guard';
  if (entry.action === 'morale') return 'morale';
  if (entry.action === 'attack') return actor?.range && actor.range > 1 ? 'ranged' : 'melee';
  if (entry.action === 'spell') return 'spell-damage';
  return undefined;
}

function easeOut(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}

function createMoveDust(origin: THREE.Vector3): RuntimeCombatEffect {
  const root = new THREE.Group();
  const particles = addParticles(root, origin, COLORS.dust, 18, 10, 34, 2.2);
  return {
    root,
    life: 0,
    maxLife: 0.85,
    update: (delta, progress) => {
      updateParticles(particles, delta, progress, 4);
    },
  };
}

function createMeleeSlash(origin: THREE.Vector3, direction: THREE.Vector3): RuntimeCombatEffect {
  const root = new THREE.Group();
  root.position.copy(origin);
  const angle = Math.atan2(direction.y, direction.x) || -0.45;

  [0, 1, 2].forEach(index => {
    const blade = new THREE.Mesh(
      new THREE.PlaneGeometry(42 - index * 8, 4 - index * 0.7),
      makeMaterial(index === 0 ? COLORS.melee : COLORS.damage, index === 0 ? 0.74 : 0.48)
    );
    blade.rotation.z = angle + (-0.55 + index * 0.42);
    blade.position.y = -4 + index * 4;
    blade.scale.x = 0.08;
    blade.scale.y = 0.85;
    root.add(blade);
  });

  const particles = addParticles(root, new THREE.Vector3(0, 0, 0), COLORS.damage, 18, 8, 48, 2.2);

  return {
    root,
    life: 0,
    maxLife: 0.82,
    update: (delta, progress) => {
      const scale = Math.sin(Math.min(1, progress * 1.25) * Math.PI);
      root.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          child.scale.x = 0.25 + scale * 1.05;
        }
      });
      setObjectOpacity(root, Math.max(0, 1 - progress) * 0.76);
      updateParticles(particles, delta, progress, 10);
    },
  };
}

function createProjectile(
  start: THREE.Vector3,
  end: THREE.Vector3,
  color: THREE.Color,
  impactColor = color,
  large = false
): RuntimeCombatEffect {
  const root = new THREE.Group();
  const orb = new THREE.Mesh(
    new THREE.CircleGeometry(large ? 8 : 5, 24),
    makeMaterial(color, 0.82)
  );
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(large ? 18 : 12, 32),
    makeMaterial(color, 0.18)
  );
  const impactRing = makeRing(impactColor, large ? 10 : 7, large ? 16 : 12, 0);
  const particles = addParticles(root, end, impactColor, large ? 32 : 22, large ? 14 : 9, large ? 62 : 48, large ? 2.4 : 2);

  orb.position.copy(start);
  glow.position.copy(start);
  impactRing.position.copy(end);
  root.add(glow, orb, impactRing);

  return {
    root,
    life: 0,
    maxLife: large ? 1.25 : 1.05,
    update: (delta, progress) => {
      const flightProgress = Math.min(1, progress / 0.58);
      const easedFlight = easeOut(flightProgress);
      orb.position.lerpVectors(start, end, easedFlight);
      glow.position.copy(orb.position);
      glow.scale.setScalar(0.85 + Math.sin(progress * Math.PI) * 0.3);

      const impactProgress = Math.max(0, (progress - 0.48) / 0.52);
      impactRing.scale.setScalar(0.45 + impactProgress * (large ? 2.4 : 1.8));
      impactRing.material.opacity = Math.sin(Math.min(1, impactProgress) * Math.PI) * (large ? 0.36 : 0.28);
      orb.material.opacity = flightProgress >= 1 ? 0 : 0.86 * (1 - flightProgress * 0.35);
      glow.material.opacity = flightProgress >= 1 ? 0 : 0.18 * (1 - flightProgress * 0.3);
      updateParticles(particles, delta, impactProgress, 12);
    },
  };
}

function createSpellParticleBurst(
  origin: THREE.Vector3,
  color: THREE.Color,
  accent = color,
  gravity = 5
): RuntimeCombatEffect {
  const root = new THREE.Group();
  root.position.copy(origin);
  const embers = addParticles(root, new THREE.Vector3(0, 0, 0), color, 34, 11, 44, 2.3);
  const sparks = addParticles(root, new THREE.Vector3(0, 0, 0), accent, 18, 7, 30, 1.7);

  return {
    root,
    life: 0,
    maxLife: 1.18,
    update: (delta, progress) => {
      root.rotation.z += delta * 0.26;
      updateParticles(embers, delta, progress, gravity);
      updateParticles(sparks, delta, progress, gravity * 0.45);
    },
  };
}

function createHealPulse(origin: THREE.Vector3): RuntimeCombatEffect {
  const root = new THREE.Group();
  root.position.copy(origin);
  const ring = makeRing(COLORS.heal, 12, 17, 0.36);
  const secondRing = makeRing(COLORS.heal, 5, 7, 0.24);
  secondRing.position.y = -3;
  root.add(ring, secondRing);
  const particles = addParticles(root, new THREE.Vector3(0, 0, 0), COLORS.heal, 28, 9, 36, 2.4);

  return {
    root,
    life: 0,
    maxLife: 1.35,
    update: (delta, progress) => {
      const pulse = easeOut(progress);
      ring.scale.setScalar(0.55 + pulse * 1.8);
      secondRing.scale.setScalar(0.85 + Math.sin(progress * Math.PI) * 0.5);
      ring.material.opacity = (1 - progress) * 0.34;
      secondRing.material.opacity = (1 - progress) * 0.28;
      updateParticles(particles, delta, progress, -10);
    },
  };
}

function createShieldPulse(origin: THREE.Vector3, color = COLORS.shield): RuntimeCombatEffect {
  const root = new THREE.Group();
  root.position.copy(origin);
  const shield = makeRing(color, 14, 19, 0.32);
  const shimmer = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 44),
    makeMaterial(color, 0.11)
  );
  shimmer.scale.y = 0.72;
  shimmer.position.y = 2;
  root.add(shimmer, shield);
  const particles = addParticles(root, new THREE.Vector3(0, 0, 0), color, 20, 12, 28, 1.9);

  return {
    root,
    life: 0,
    maxLife: 1.3,
    update: (delta, progress) => {
      const pulse = Math.sin(progress * Math.PI);
      shield.scale.set(0.78 + pulse * 0.7, 0.5 + pulse * 0.42, 1);
      shimmer.scale.set(0.72 + pulse * 0.18, 0.72 + pulse * 0.24, 1);
      shield.material.opacity = (1 - progress) * 0.34;
      shimmer.material.opacity = (1 - progress) * 0.12;
      updateParticles(particles, delta, progress, 2);
    },
  };
}

function createDebuffSwirl(origin: THREE.Vector3): RuntimeCombatEffect {
  const root = new THREE.Group();
  root.position.copy(origin);
  const ring = makeRing(COLORS.debuff, 11, 15, 0.3);
  const haze = new THREE.Mesh(
    new THREE.CircleGeometry(24, 32),
    makeMaterial(COLORS.debuff, 0.16)
  );
  root.add(haze, ring);
  const particles = addParticles(root, new THREE.Vector3(0, 0, 0), COLORS.debuff, 24, 16, 34, 2.2);

  return {
    root,
    life: 0,
    maxLife: 1.25,
    update: (delta, progress) => {
      root.rotation.z += delta * 2.1;
      ring.scale.setScalar(0.68 + progress * 1.25);
      haze.scale.setScalar(0.8 + Math.sin(progress * Math.PI) * 0.35);
      ring.material.opacity = (1 - progress) * 0.32;
      haze.material.opacity = (1 - progress) * 0.16;
      updateParticles(particles, delta, progress, 5);
    },
  };
}

function createMoralePulse(origin: THREE.Vector3): RuntimeCombatEffect {
  const root = new THREE.Group();
  root.position.copy(origin);
  const ring = makeRing(COLORS.gold, 10, 14, 0.3);
  ring.scale.y = 0.46;
  root.add(ring);
  const particles = addParticles(root, new THREE.Vector3(0, 0, 0), COLORS.gold, 22, 12, 30, 2.1);

  return {
    root,
    life: 0,
    maxLife: 1.25,
    update: (delta, progress) => {
      ring.position.y = -2 + progress * 12;
      ring.scale.set(0.6 + progress * 1.4, 0.32 + progress * 0.58, 1);
      ring.material.opacity = (1 - progress) * 0.34;
      updateParticles(particles, delta, progress, -4);
    },
  };
}

function createManaFocus(origin: THREE.Vector3): RuntimeCombatEffect {
  const root = new THREE.Group();
  root.position.copy(origin);
  const outerRing = makeRing(COLORS.spell, 12, 16, 0.34);
  const innerRing = makeRing(COLORS.ranged, 5, 7, 0.24);
  const core = new THREE.Mesh(
    new THREE.CircleGeometry(10, 32),
    makeMaterial(COLORS.spell, 0.14)
  );
  core.scale.y = 0.72;
  root.add(core, outerRing, innerRing);
  const particles = addParticles(root, new THREE.Vector3(0, 0, 0), COLORS.spell, 30, 11, 34, 2.2);

  return {
    root,
    life: 0,
    maxLife: 1.55,
    update: (delta, progress) => {
      const pulse = Math.sin(progress * Math.PI);
      root.rotation.z += delta * 1.4;
      outerRing.scale.set(0.64 + progress * 1.25, 0.4 + progress * 0.72, 1);
      innerRing.scale.setScalar(0.7 + pulse * 0.7);
      core.scale.set(0.78 + pulse * 0.34, 0.54 + pulse * 0.22, 1);
      outerRing.material.opacity = (1 - progress) * 0.34;
      innerRing.material.opacity = (1 - progress) * 0.26;
      core.material.opacity = pulse * 0.15;
      updateParticles(particles, delta, progress, -9);
    },
  };
}

function createRuntime(mount: HTMLDivElement): RuntimeContext {
  let width = Math.max(1, mount.clientWidth);
  let height = Math.max(1, mount.clientHeight);
  let animationFrame = 0;
  let lastTime = performance.now();
  const effects: RuntimeCombatEffect[] = [];
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 0, 0, 0, -10, 10);
  camera.position.z = 5;

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.domElement.className = 'combat-three-fx-canvas';
  mount.appendChild(renderer.domElement);

  const setSize = () => {
    width = Math.max(1, mount.clientWidth);
    height = Math.max(1, mount.clientHeight);
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  setSize();
  const resizeObserver = new ResizeObserver(setSize);
  resizeObserver.observe(mount);

  const addEffect = (effect: RuntimeCombatEffect) => {
    effects.push(effect);
    scene.add(effect.root);
  };

  const spawnAtTargets = (
    targets: BattleUnit[],
    battle: BattleState,
    factory: (origin: THREE.Vector3, target: BattleUnit) => RuntimeCombatEffect
  ) => {
    targets.forEach(target => {
      addEffect(factory(getUnitCenter(target, width, height, battle.boardWidth, battle.boardHeight), target));
    });
  };

  const spawnBattleLog = (battle: BattleState, entry: BattleLogEntry) => {
    const actor = entry.actorId ? battle.units.find(unit => unit.id === entry.actorId) : undefined;
    const targets = (entry.targetIds || [])
      .map(id => battle.units.find(unit => unit.id === id))
      .filter((unit): unit is BattleUnit => Boolean(unit));
    const style = getBattleLogStyle(entry, actor);

    if (!style || entry.action === 'round' || entry.action === 'system') return;

    const actorCenter = actor ? getUnitCenter(actor, width, height, battle.boardWidth, battle.boardHeight) : undefined;

    if (style === 'move' && actorCenter) {
      addEffect(createMoveDust(actorCenter));
      return;
    }

    const resolvedTargets = targets.length > 0 ? targets : actor ? [actor] : [];

    if (style === 'melee') {
      spawnAtTargets(targets, battle, origin => {
        const direction = actorCenter ? new THREE.Vector3().subVectors(origin, actorCenter) : new THREE.Vector3(1, 0, 0);
        return createMeleeSlash(origin, direction);
      });
      return;
    }

    if (style === 'ranged') {
      spawnAtTargets(targets, battle, origin => createProjectile(actorCenter || origin, origin, COLORS.ranged, COLORS.ranged));
      return;
    }

    if (style === 'spell-drain') {
      const drainTargets = actor ? targets.filter(target => target.id !== actor.id) : targets;
      spawnAtTargets(drainTargets, battle, origin => createSpellParticleBurst(origin, COLORS.damage, COLORS.spell, 7));
      if (actorCenter) addEffect(createSpellParticleBurst(actorCenter, COLORS.heal, COLORS.shield, -9));
      return;
    }

    if (entry.action === 'spell' && (style === 'heal' || style === 'spell-support')) {
      spawnAtTargets(targets.length > 0 ? targets : actor ? [actor] : [], battle, origin => createSpellParticleBurst(origin, COLORS.heal, COLORS.shield, -10));
      return;
    }

    if (entry.action === 'spell' && style === 'buff') {
      spawnAtTargets(targets.length > 0 ? targets : actor ? [actor] : [], battle, origin => createSpellParticleBurst(origin, COLORS.shield, COLORS.gold, -5));
      return;
    }

    if (entry.action === 'spell' && (style === 'debuff' || style === 'spell-control')) {
      spawnAtTargets(targets.length > 0 ? targets : actor ? [actor] : [], battle, origin => createSpellParticleBurst(origin, COLORS.debuff, COLORS.spell, 5));
      return;
    }

    if (style === 'heal' || style === 'spell-support') {
      spawnAtTargets(targets.length > 0 ? targets : actor ? [actor] : [], battle, origin => createHealPulse(origin));
      return;
    }

    if (style === 'buff') {
      spawnAtTargets(targets.length > 0 ? targets : actor ? [actor] : [], battle, origin => createShieldPulse(origin, COLORS.shield));
      return;
    }

    if (style === 'debuff' || style === 'spell-control') {
      spawnAtTargets(targets.length > 0 ? targets : actor ? [actor] : [], battle, origin => createDebuffSwirl(origin));
      return;
    }

    if (style === 'morale') {
      spawnAtTargets(targets.length > 0 ? targets : actor ? [actor] : [], battle, origin => createMoralePulse(origin));
      return;
    }

    if (style === 'mana-focus') {
      spawnAtTargets(targets.length > 0 ? targets : actor ? [actor] : [], battle, origin => createManaFocus(origin));
      return;
    }

    if (style === 'guard') {
      spawnAtTargets(targets.length > 0 ? targets : actor ? [actor] : [], battle, origin => createShieldPulse(origin, COLORS.gold));
      return;
    }

    if (style === 'spell-damage') {
      spawnAtTargets(targets, battle, origin => createSpellParticleBurst(origin, COLORS.spell, COLORS.damage, 7));
    }
  };

  const animate = (time: number) => {
    const delta = Math.min(0.04, (time - lastTime) / 1000);
    lastTime = time;

    for (let index = effects.length - 1; index >= 0; index -= 1) {
      const effect = effects[index];
      effect.life += delta;
      const progress = Math.min(1, effect.life / effect.maxLife);
      effect.update(delta, progress);
      if (progress >= 1) {
        scene.remove(effect.root);
        disposeObject(effect.root);
        effects.splice(index, 1);
      }
    }

    renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(animate);
  };

  animationFrame = window.requestAnimationFrame(animate);

  return {
    scene,
    spawnBattleLog,
    dispose: () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      effects.forEach(effect => {
        scene.remove(effect.root);
        disposeObject(effect.root);
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export default function CombatThreeFxLayer({ battle }: CombatThreeFxLayerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<RuntimeContext | null>(null);
  const lastLogIdRef = useRef<string | null>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mount = mountRef.current;
    if (!mount || reducedMotion) return undefined;

    const runtime = createRuntime(mount);
    runtimeRef.current = runtime;

    return () => {
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const entry = battle.log[0];
    const runtime = runtimeRef.current;
    if (!entry || !runtime || entry.id === lastLogIdRef.current) return;
    lastLogIdRef.current = entry.id;
    runtime.spawnBattleLog(battle, entry);
  }, [battle]);

  return <div ref={mountRef} className="combat-three-fx-layer" aria-hidden="true" />;
}
