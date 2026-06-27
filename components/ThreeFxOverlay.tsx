'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FX_EVENT_NAME, type FxEvent, type FxEventType, type FxTone } from '@/lib/fxEvents';

interface RuntimeBurst {
  points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  velocity: Float32Array;
  life: number;
  maxLife: number;
  baseOpacity: number;
  ringOpacity: number;
  ringScale: number;
  ring?: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
}

interface FxRenderQuality {
  renderScale: number;
  pixelRatio: number;
  ambientCount: number;
  burstScale: number;
  ringSegments: number;
}

const EVENT_TONES: Record<FxEventType, FxTone> = {
  victory: 'gold',
  defeat: 'red',
  quest: 'violet',
  job: 'bone',
  run: 'gold',
  recruit: 'green',
  heal: 'green',
  defense: 'blue',
  attack: 'red',
  status: 'violet',
  spell: 'violet',
  travel: 'blue',
  city: 'gold',
  dungeon: 'violet',
  spawn: 'red',
  daily: 'blue',
  interface: 'bone',
};

const TONE_COLORS: Record<FxTone, [number, number, number]> = {
  gold: [1, 0.76, 0.34],
  blue: [0.32, 0.86, 1],
  green: [0.36, 1, 0.74],
  red: [1, 0.24, 0.28],
  violet: [0.72, 0.42, 1],
  bone: [0.96, 0.86, 0.68],
  neutral: [0.8, 0.78, 0.72],
};

function getTone(event: FxEvent): FxTone {
  return event.tone || EVENT_TONES[event.type] || 'neutral';
}

function getBurstCount(type: FxEventType, intensity = 1): number {
  const base = type === 'victory' || type === 'run' ? 120
    : type === 'defeat' ? 92
      : type === 'city' || type === 'dungeon' || type === 'daily' || type === 'interface' ? 14
        : type === 'spell' ? 42
          : type === 'heal' || type === 'defense' ? 34
            : type === 'attack' || type === 'status' ? 28
              : 44;
  return Math.round(base * Math.max(0.45, Math.min(1.65, intensity)));
}

function getFxRenderQuality(width: number, height: number): FxRenderQuality {
  const area = width * height;
  const deviceRatio = window.devicePixelRatio || 1;

  if (area >= 7_000_000) {
    return {
      renderScale: 0.48,
      pixelRatio: 1,
      ambientCount: 34,
      burstScale: 0.46,
      ringSegments: 32,
    };
  }

  if (area >= 3_600_000) {
    return {
      renderScale: 0.64,
      pixelRatio: Math.min(deviceRatio, 1.05),
      ambientCount: 52,
      burstScale: 0.66,
      ringSegments: 40,
    };
  }

  if (area >= 2_400_000) {
    return {
      renderScale: 0.82,
      pixelRatio: Math.min(deviceRatio, 1.15),
      ambientCount: 68,
      burstScale: 0.82,
      ringSegments: 48,
    };
  }

  return {
    renderScale: 1,
    pixelRatio: Math.min(deviceRatio, 1.35),
    ambientCount: 85,
    burstScale: 1,
    ringSegments: 64,
  };
}

function isRestrainedCombatFx(type: FxEventType): boolean {
  return type === 'attack' || type === 'heal' || type === 'defense' || type === 'status' || type === 'spell';
}

function getEventOrigin(event: FxEvent, width: number, height: number): THREE.Vector3 {
  const safeX = Number.isFinite(event.x) ? Number(event.x) : width / 2;
  const safeY = Number.isFinite(event.y) ? Number(event.y) : height / 2;
  const jitterX = event.x === undefined ? (Math.random() - 0.5) * Math.min(width * 0.2, 240) : 0;
  const jitterY = event.y === undefined ? (Math.random() - 0.5) * Math.min(height * 0.14, 140) : 0;

  return new THREE.Vector3(
    safeX - width / 2 + jitterX,
    height / 2 - safeY + jitterY,
    0
  );
}

function setCameraSize(camera: THREE.OrthographicCamera, width: number, height: number): void {
  camera.left = -width / 2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = -height / 2;
  camera.updateProjectionMatrix();
}

function disposeBurst(scene: THREE.Scene, burst: RuntimeBurst): void {
  scene.remove(burst.points);
  burst.points.geometry.dispose();
  burst.points.material.dispose();

  if (burst.ring) {
    scene.remove(burst.ring);
    burst.ring.geometry.dispose();
    burst.ring.material.dispose();
  }
}

export default function ThreeFxOverlay() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mount = mountRef.current;
    if (!mount || reducedMotion) return undefined;

    let width = Math.ceil(window.visualViewport?.width || window.innerWidth || 1);
    let height = Math.ceil(window.visualViewport?.height || window.innerHeight || 1);
    let renderQuality = getFxRenderQuality(width, height);
    let animationFrame = 0;
    let lastTime = performance.now();
    const bursts: RuntimeBurst[] = [];

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, 0, 0, 0, -10, 10);
    setCameraSize(camera, width, height);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(renderQuality.pixelRatio);
    renderer.setSize(
      Math.max(1, Math.floor(width * renderQuality.renderScale)),
      Math.max(1, Math.floor(height * renderQuality.renderScale)),
      false
    );
    renderer.domElement.className = 'three-fx-canvas';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    mount.appendChild(renderer.domElement);

    const ambientCount = renderQuality.ambientCount;
    const ambientPositions = new Float32Array(ambientCount * 3);
    const ambientColors = new Float32Array(ambientCount * 3);
    for (let index = 0; index < ambientCount; index += 1) {
      ambientPositions[index * 3] = (Math.random() - 0.5) * width;
      ambientPositions[index * 3 + 1] = (Math.random() - 0.5) * height;
      ambientPositions[index * 3 + 2] = 0;
      const color = TONE_COLORS[index % 3 === 0 ? 'bone' : index % 3 === 1 ? 'blue' : 'violet'];
      ambientColors[index * 3] = color[0];
      ambientColors[index * 3 + 1] = color[1];
      ambientColors[index * 3 + 2] = color[2];
    }

    const ambientGeometry = new THREE.BufferGeometry();
    ambientGeometry.setAttribute('position', new THREE.BufferAttribute(ambientPositions, 3));
    ambientGeometry.setAttribute('color', new THREE.BufferAttribute(ambientColors, 3));
    const ambientMaterial = new THREE.PointsMaterial({
      size: 1.9,
      transparent: true,
      opacity: 0.28,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ambientPoints = new THREE.Points(ambientGeometry, ambientMaterial);
    scene.add(ambientPoints);

    const spawnBurst = (event: FxEvent) => {
      const tone = getTone(event);
      const color = TONE_COLORS[tone];
      const count = Math.max(4, Math.round(getBurstCount(event.type, event.intensity) * renderQuality.burstScale));
      if (count <= 0) return;
      const positions = new Float32Array(count * 3);
      const velocities = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const origin = getEventOrigin(event, width, height);
      const major = event.type === 'victory' || event.type === 'run' || event.type === 'defeat';
      const quiet = event.type === 'city' || event.type === 'dungeon' || event.type === 'daily' || event.type === 'interface' || event.type === 'travel';
      const restrained = isRestrainedCombatFx(event.type);
      const speed = major ? 180 : quiet ? 42 : restrained ? 68 : 112;
      const baseOpacity = major ? 0.78 : quiet ? 0.24 : restrained ? 0.46 : 0.62;
      const ringOpacity = major ? 0.34 : restrained ? 0.16 : 0.22;
      const ringScale = major ? 3.2 : restrained ? 2.15 : 2.7;

      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 6 + Math.random() * (major ? 36 : restrained ? 14 : 20);
        const velocity = speed * (0.28 + Math.random() * 0.82);
        positions[index * 3] = Math.cos(angle) * radius;
        positions[index * 3 + 1] = Math.sin(angle) * radius;
        positions[index * 3 + 2] = 0;
        velocities[index * 3] = Math.cos(angle) * velocity;
        velocities[index * 3 + 1] = Math.sin(angle) * velocity + (major ? 24 : 8);
        velocities[index * 3 + 2] = 0;
        colors[index * 3] = color[0] * (0.84 + Math.random() * 0.26);
        colors[index * 3 + 1] = color[1] * (0.84 + Math.random() * 0.26);
        colors[index * 3 + 2] = color[2] * (0.84 + Math.random() * 0.26);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const material = new THREE.PointsMaterial({
        size: major ? 3.2 : restrained ? 2.05 : 2.5,
        transparent: true,
        opacity: baseOpacity,
        vertexColors: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const points = new THREE.Points(geometry, material);
      points.position.copy(origin);
      scene.add(points);

      let ring: RuntimeBurst['ring'];
      if (major || event.type === 'spell') {
        const ringGeometry = new THREE.RingGeometry(18, major ? 26 : 22, renderQuality.ringSegments);
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color(color[0], color[1], color[2]),
          transparent: true,
          opacity: ringOpacity,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        });
        ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.copy(origin);
        scene.add(ring);
      }

      bursts.push({
        points,
        velocity: velocities,
        life: 0,
        maxLife: major ? 1.55 : quiet ? 0.72 : restrained ? 0.82 : 1.05,
        baseOpacity,
        ringOpacity,
        ringScale,
        ring,
      });
    };

    const handleFxEvent = (event: Event) => {
      const detail = (event as CustomEvent<FxEvent>).detail;
      if (!detail?.type) return;
      spawnBurst(detail);
    };

    const handleResize = () => {
      width = Math.ceil(window.visualViewport?.width || window.innerWidth || 1);
      height = Math.ceil(window.visualViewport?.height || window.innerHeight || 1);
      renderQuality = getFxRenderQuality(width, height);
      renderer.setPixelRatio(renderQuality.pixelRatio);
      renderer.setSize(
        Math.max(1, Math.floor(width * renderQuality.renderScale)),
        Math.max(1, Math.floor(height * renderQuality.renderScale)),
        false
      );
      setCameraSize(camera, width, height);

      const positions = ambientGeometry.getAttribute('position') as THREE.BufferAttribute;
      for (let index = 0; index < ambientCount; index += 1) {
        positions.setXYZ(index, (Math.random() - 0.5) * width, (Math.random() - 0.5) * height, 0);
      }
      positions.needsUpdate = true;
    };

    const animate = (time: number) => {
      const delta = Math.min(0.04, (time - lastTime) / 1000);
      lastTime = time;

      const ambientAttribute = ambientGeometry.getAttribute('position') as THREE.BufferAttribute;
      for (let index = 0; index < ambientCount; index += 1) {
        const nextY = ambientAttribute.getY(index) + delta * (6 + (index % 5));
        const nextX = ambientAttribute.getX(index) + Math.sin(time * 0.0003 + index) * delta * 4;
        ambientAttribute.setXY(
          index,
          nextX > width / 2 ? -width / 2 : nextX < -width / 2 ? width / 2 : nextX,
          nextY > height / 2 ? -height / 2 : nextY
        );
      }
      ambientAttribute.needsUpdate = true;

      for (let burstIndex = bursts.length - 1; burstIndex >= 0; burstIndex -= 1) {
        const burst = bursts[burstIndex];
        burst.life += delta;
        const progress = Math.min(1, burst.life / burst.maxLife);
        const positionAttribute = burst.points.geometry.getAttribute('position') as THREE.BufferAttribute;
        const positionArray = positionAttribute.array as Float32Array;

        for (let index = 0; index < positionArray.length; index += 3) {
          positionArray[index] += burst.velocity[index] * delta;
          positionArray[index + 1] += burst.velocity[index + 1] * delta;
          burst.velocity[index] *= 0.985;
          burst.velocity[index + 1] = burst.velocity[index + 1] * 0.982 - delta * 18;
        }
        positionAttribute.needsUpdate = true;
        burst.points.material.opacity = (1 - progress) * burst.baseOpacity;
        burst.points.material.size *= 0.997;

        if (burst.ring) {
          burst.ring.scale.setScalar(0.55 + progress * burst.ringScale);
          burst.ring.rotation.z += delta * 0.38;
          burst.ring.material.opacity = (1 - progress) * burst.ringOpacity;
        }

        if (progress >= 1) {
          disposeBurst(scene, burst);
          bursts.splice(burstIndex, 1);
        }
      }

      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(animate);
    };

    window.addEventListener(FX_EVENT_NAME, handleFxEvent);
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener(FX_EVENT_NAME, handleFxEvent);
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
      bursts.forEach(burst => disposeBurst(scene, burst));
      ambientGeometry.dispose();
      ambientMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mountRef} className="three-fx-layer" aria-hidden="true" />;
}
