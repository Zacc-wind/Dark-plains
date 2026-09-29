'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { MAP_FOG_EVENT_NAME, MAP_FOG_MAX_CAMPFIRES, type MapFogState } from '@/lib/mapFogEvents';
import {
  GRAPHICS_QUALITY_EVENT_NAME,
  getMapFogFrameStride,
  getMapFogPixelRatioCap,
  getMapFogRenderScale,
  isHeavyUiOverlayOpen,
  readGraphicsQualitySetting,
  shouldAnimateMapFogGrain,
  shouldEnableMapFog,
  type GraphicsQuality,
} from '@/lib/graphicsSettings';
import { isMapCoveredByModal } from '@/lib/overlayVisibility';

function setCameraSize(camera: THREE.OrthographicCamera, width: number, height: number): void {
  camera.left = -width / 2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = -height / 2;
  camera.updateProjectionMatrix();
}

function screenToWorld(point: { x: number; y: number }, width: number, height: number): THREE.Vector2 {
  return new THREE.Vector2(point.x - width / 2, height / 2 - point.y);
}

const SETTLED_DISTANCE_PX = 0.5;
const SETTLED_STRENGTH = 0.999;
const SETTLED_ZOOM_DELTA = 0.0005;

export default function MapFogOverlay() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let disposed = false;
    let quality: GraphicsQuality = readGraphicsQualitySetting();
    let width = Math.ceil(window.visualViewport?.width || window.innerWidth || 1);
    let height = Math.ceil(window.visualViewport?.height || window.innerHeight || 1);
    let animationFrame = 0;
    let frameCounter = 0;
    let lastTime = performance.now();
    let pointerTarget: { x: number; y: number } | null = null;
    let playerTarget: { x: number; y: number } | null = null;
    let campfireTargets: Array<{ x: number; y: number }> = [];
    let zoomTarget = 1;
    let pointerPrimed = false;
    let playerPrimed = false;
    let pointerStrength = 0;
    let playerStrength = 0;
    let scene: THREE.Scene | null = null;
    let camera: THREE.OrthographicCamera | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let fogPlane: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null;
    let uniforms: Record<string, { value: unknown }> | null = null;
    const pointerLight = new THREE.Vector2(0, 0);
    const playerLight = new THREE.Vector2(0, 0);
    const campfireLights = Array.from({ length: MAP_FOG_MAX_CAMPFIRES }, () => new THREE.Vector2(0, 0));

    const applyRendererSize = () => {
      if (!renderer || !camera || !uniforms || !fogPlane) return;
      const renderScale = getMapFogRenderScale(quality, width, height);
      const renderWidth = Math.max(1, Math.floor(width * renderScale));
      const renderHeight = Math.max(1, Math.floor(height * renderScale));
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, getMapFogPixelRatioCap(quality)));
      renderer.setSize(renderWidth, renderHeight, false);
      setCameraSize(camera, width, height);
      (uniforms.uResolution.value as THREE.Vector2).set(width, height);
      fogPlane.geometry.dispose();
      fogPlane.geometry = new THREE.PlaneGeometry(width, height);
    };

    const teardownRenderer = () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      if (fogPlane) {
        fogPlane.geometry.dispose();
        fogPlane.material.dispose();
        fogPlane = null;
      }
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
        renderer = null;
      }
      scene = null;
      camera = null;
      uniforms = null;
    };

    const ensureRenderer = () => {
      if (disposed || renderer || !shouldEnableMapFog(quality)) return false;

      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(0, 0, 0, 0, -10, 10);
      setCameraSize(camera, width, height);
      camera.position.z = 2;

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: quality === 'high' ? 'high-performance' : 'low-power',
      });
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.className = 'map-fog-canvas';
      mount.appendChild(renderer.domElement);

      uniforms = {
        uResolution: { value: new THREE.Vector2(width, height) },
        uPointer: { value: pointerLight },
        uPlayer: { value: playerLight },
        uHasPointer: { value: 0 },
        uHasPlayer: { value: 0 },
        uPointerStrength: { value: 0 },
        uPlayerStrength: { value: 0 },
        uCampfires: { value: campfireLights },
        uCampfireCount: { value: 0 },
        uTime: { value: 0 },
        uZoom: { value: 1 },
        uAnimateGrain: { value: shouldAnimateMapFogGrain(quality) ? 1 : 0 },
      };

      const geometry = new THREE.PlaneGeometry(width, height);
      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms,
        vertexShader: `
          varying vec2 vWorld;

          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorld = worldPosition.xy;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          precision mediump float;

          varying vec2 vWorld;
          uniform vec2 uResolution;
          uniform vec2 uPointer;
          uniform vec2 uPlayer;
          uniform int uHasPointer;
          uniform int uHasPlayer;
          uniform float uPointerStrength;
          uniform float uPlayerStrength;
          uniform vec2 uCampfires[8];
          uniform int uCampfireCount;
          uniform float uTime;
          uniform float uZoom;
          uniform float uAnimateGrain;

          float radial(vec2 point, float radius, float feather) {
            float distanceToPoint = distance(vWorld, point);
            return 1.0 - smoothstep(radius, radius + feather, distanceToPoint);
          }

          void main() {
            float veil = 0.46;
            float reveal = 0.0;
            float warmGlow = 0.0;
            float zoomGlow = clamp(uZoom / 1.75, 0.78, 1.48);

            if (uHasPointer == 1) {
              reveal += radial(uPointer, 118.0 * zoomGlow, 135.0 * zoomGlow) * 0.38 * uPointerStrength;
            }

            if (uHasPlayer == 1) {
              reveal += radial(uPlayer, 60.0 * zoomGlow, 76.0 * zoomGlow) * 0.24 * uPlayerStrength;
            }

            for (int i = 0; i < 8; i++) {
              if (i >= uCampfireCount) break;
              float pulse = uAnimateGrain > 0.5
                ? 0.9 + 0.1 * sin(uTime * 1.4 + float(i) * 1.9)
                : 0.95;
              float spot = radial(uCampfires[i], 62.0 * zoomGlow, 88.0 * zoomGlow);
              reveal += spot * 0.18 * pulse;
              warmGlow += spot * 0.24 * pulse;
            }

            float grain = uAnimateGrain > 0.5
              ? sin((vWorld.x + uTime * 11.0) * 0.018) * sin((vWorld.y - uTime * 7.0) * 0.022)
              : 0.0;
            float edge = smoothstep(0.48, 1.0, distance(vWorld / max(uResolution.x, uResolution.y), vec2(0.0)));
            float alpha = clamp(veil + edge * 0.08 + grain * 0.018 - reveal, 0.04, 0.56);
            vec3 fogColor = mix(vec3(0.015, 0.018, 0.018), vec3(0.0, 0.0, 0.0), 0.62);
            fogColor = mix(fogColor, vec3(0.22, 0.09, 0.025), clamp(warmGlow, 0.0, 0.42));

            gl_FragColor = vec4(fogColor, alpha);
          }
        `,
      });

      fogPlane = new THREE.Mesh(geometry, material);
      scene.add(fogPlane);
      applyRendererSize();
      return true;
    };

    const shouldAnimate = () => (
      !disposed
      && shouldEnableMapFog(quality)
      && !isHeavyUiOverlayOpen()
      && !isMapCoveredByModal()
      && !document.hidden
    );

    const animate = (time: number) => {
      animationFrame = 0;
      if (!shouldAnimate()) return;
      if (!renderer || !scene || !camera || !uniforms || !fogPlane) {
        if (!ensureRenderer()) return;
      }
      if (!renderer || !scene || !camera || !uniforms || !fogPlane) return;

      const delta = Math.min(0.04, (time - lastTime) / 1000);
      lastTime = time;
      const animateGrain = shouldAnimateMapFogGrain(quality);
      uniforms.uAnimateGrain.value = animateGrain ? 1 : 0;
      if (animateGrain) {
        (uniforms.uTime.value as number) = time * 0.001;
      }
      (uniforms.uZoom.value as number) += (zoomTarget - (uniforms.uZoom.value as number)) * (1 - Math.pow(0.04, delta));
      let settled = !animateGrain
        && Math.abs(zoomTarget - (uniforms.uZoom.value as number)) < SETTLED_ZOOM_DELTA;

      if (pointerTarget) {
        const target = screenToWorld(pointerTarget, width, height);
        if (!pointerPrimed) {
          pointerLight.copy(target);
          pointerStrength = 0;
          pointerPrimed = true;
        }
        pointerLight.lerp(target, 1 - Math.pow(0.02, delta));
        pointerStrength += (1 - pointerStrength) * (1 - Math.pow(0.02, delta));
        settled = settled
          && pointerStrength > SETTLED_STRENGTH
          && pointerLight.distanceTo(target) < SETTLED_DISTANCE_PX;
        uniforms.uHasPointer.value = 1;
        uniforms.uPointerStrength.value = pointerStrength;
      } else {
        pointerPrimed = false;
        pointerStrength = 0;
        uniforms.uHasPointer.value = 0;
        uniforms.uPointerStrength.value = 0;
      }

      if (playerTarget) {
        const target = screenToWorld(playerTarget, width, height);
        if (!playerPrimed) {
          playerLight.copy(target);
          playerStrength = 0;
          playerPrimed = true;
        }
        playerLight.lerp(target, 1 - Math.pow(0.04, delta));
        playerStrength += (1 - playerStrength) * (1 - Math.pow(0.04, delta));
        settled = settled
          && playerStrength > SETTLED_STRENGTH
          && playerLight.distanceTo(target) < SETTLED_DISTANCE_PX;
        uniforms.uHasPlayer.value = 1;
        uniforms.uPlayerStrength.value = playerStrength;
      } else {
        playerPrimed = false;
        playerStrength = 0;
        uniforms.uHasPlayer.value = 0;
        uniforms.uPlayerStrength.value = 0;
      }

      uniforms.uCampfireCount.value = campfireTargets.length;
      for (let index = 0; index < MAP_FOG_MAX_CAMPFIRES; index += 1) {
        const target = campfireTargets[index];
        if (!target) {
          campfireLights[index].set(0, 0);
          continue;
        }
        campfireLights[index].copy(screenToWorld(target, width, height));
      }

      frameCounter += 1;
      const stride = Math.max(1, getMapFogFrameStride(quality));
      if (settled) {
        // Nothing is moving: draw the final state and idle until the next fog event.
        renderer.render(scene, camera);
        return;
      }
      if (frameCounter % stride === 0) {
        renderer.render(scene, camera);
      }
      animationFrame = window.requestAnimationFrame(animate);
    };

    const requestAnimate = () => {
      if (animationFrame || !shouldAnimate()) return;
      if (!renderer && !ensureRenderer()) return;
      lastTime = performance.now();
      animationFrame = window.requestAnimationFrame(animate);
    };

    const pauseOrResume = () => {
      if (!shouldAnimate()) {
        if (animationFrame) {
          window.cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        }
        if (!shouldEnableMapFog(quality)) {
          teardownRenderer();
        }
        return;
      }
      requestAnimate();
    };

    const handleFogState = (event: Event) => {
      const detail = (event as CustomEvent<MapFogState>).detail;
      if (!detail) return;

      playerTarget = detail.player;
      campfireTargets = Array.isArray(detail.campfires) ? detail.campfires.slice(0, MAP_FOG_MAX_CAMPFIRES) : [];
      zoomTarget = Number.isFinite(detail.zoom) ? detail.zoom : 1;
      pointerTarget = detail.pointer || null;
      requestAnimate();
    };

    const handleResize = () => {
      width = Math.ceil(window.visualViewport?.width || window.innerWidth || 1);
      height = Math.ceil(window.visualViewport?.height || window.innerHeight || 1);
      applyRendererSize();
      requestAnimate();
    };

    const handleQualityChange = () => {
      quality = readGraphicsQualitySetting();
      if (!shouldEnableMapFog(quality)) {
        teardownRenderer();
        return;
      }
      teardownRenderer();
      ensureRenderer();
      pauseOrResume();
    };

    const overlayObserver = new MutationObserver(pauseOrResume);
    overlayObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    window.addEventListener(MAP_FOG_EVENT_NAME, handleFogState);
    window.addEventListener(GRAPHICS_QUALITY_EVENT_NAME, handleQualityChange);
    window.addEventListener('resize', handleResize);
    window.addEventListener('visibilitychange', pauseOrResume);
    window.visualViewport?.addEventListener('resize', handleResize);

    if (shouldEnableMapFog(quality)) {
      ensureRenderer();
      requestAnimate();
    }

    return () => {
      disposed = true;
      overlayObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener(MAP_FOG_EVENT_NAME, handleFogState);
      window.removeEventListener(GRAPHICS_QUALITY_EVENT_NAME, handleQualityChange);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('visibilitychange', pauseOrResume);
      window.visualViewport?.removeEventListener('resize', handleResize);
      teardownRenderer();
    };
  }, []);

  return <div ref={mountRef} className="map-fog-layer" aria-hidden="true" />;
}
