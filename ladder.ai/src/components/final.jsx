import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * MorphingWaveToSphere - Elegant particle transition effect
 * 
 * At scroll = 0: Flowing wave dots pattern (hero_back_dots style)
 * On scroll down: Dots smoothly rearrange and converge
 * At full scroll: Forms the glowing sphere with noise displacement
 */
const MorphingWaveToSphere = () => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const materialRef = useRef(null);
  const particlesRef = useRef(null);
  const cameraRef = useRef(null);
  const frameIdRef = useRef(null);
  const scrollRef = useRef({ current: 0, target: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera setup - starts looking at the wave from above
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      1,
      1000
    );
    // Initial position for wave view (from hero_back_dots)
    camera.position.set(0, 30, 60);
    camera.up.set(0, -1, 0);
    camera.lookAt(0, 15, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ========================================
    // GEOMETRY: High-density plane grid (like hero_back_dots)
    // This is the BASE geometry - wave positions are the default
    // ========================================
    const width = 240;
    const height = 120;
    const segmentsX = 240;
    const segmentsY = 120;
    const geometry = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);
    
    const count = geometry.attributes.position.count;
    
    // Calculate sphere positions for each grid point
    const spherePositions = new Float32Array(count * 3);
    const sphereNormals = new Float32Array(count * 3);
    const sphereRadius = 18; // Even smaller = dots very close together
    const randoms = new Float32Array(count);
    const delays = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Get UV coordinates from grid index
      const ix = i % (segmentsX + 1);
      const iy = Math.floor(i / (segmentsX + 1));

      const u = ix / segmentsX;
      const v = iy / segmentsY;

      // Map to sphere (Phi: 0 to PI, Theta: 0 to 2PI)
      const phi = v * Math.PI;
      const theta = u * Math.PI * 2;

      // Spherical to Cartesian
      const x = sphereRadius * Math.sin(phi) * Math.cos(theta);
      const y = sphereRadius * Math.cos(phi);
      const z = sphereRadius * Math.sin(phi) * Math.sin(theta);

      spherePositions[i * 3] = x;
      spherePositions[i * 3 + 1] = y;
      spherePositions[i * 3 + 2] = z;
      
      // Sphere normals (normalized position for a centered sphere)
      const len = Math.sqrt(x*x + y*y + z*z);
      sphereNormals[i * 3] = x / len;
      sphereNormals[i * 3 + 1] = y / len;
      sphereNormals[i * 3 + 2] = z / len;
      
      // Random value for variation
      randoms[i] = Math.random();
      
      // Delay based on distance from center of the grid
      // Center particles transition first, edges last
      const centerX = segmentsX / 2;
      const centerY = segmentsY / 2;
      const distFromCenter = Math.sqrt((ix - centerX) ** 2 + (iy - centerY) ** 2);
      const maxDist = Math.sqrt(centerX ** 2 + centerY ** 2);
      delays[i] = (distFromCenter / maxDist) * 0.4;
    }

    geometry.setAttribute('aSpherePosition', new THREE.BufferAttribute(spherePositions, 3));
    geometry.setAttribute('aSphereNormal', new THREE.BufferAttribute(sphereNormals, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
    geometry.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1));

    // ========================================
    // SHADER MATERIAL
    // Wave -> Sphere transition with ORIGINAL colors from both files
    // ========================================
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0 }, // 0 = wave, 1 = sphere
        // Original colors from hero_back_dots.jsx
        uColor1: { value: new THREE.Color('#8B0000') }, // Dark red
        uColor2: { value: new THREE.Color('#FF4500') }, // Orange red
        uColor3: { value: new THREE.Color('#FFD700') }, // Gold
      },
      vertexShader: `
        uniform float uTime;
        uniform float uScroll;
        
        attribute vec3 aSpherePosition;
        attribute vec3 aSphereNormal;
        attribute float aRandom;
        attribute float aDelay;
        
        varying float vElevation;
        varying float vDistance;
        varying float vMorphProgress;
        varying float vNoise;

        // --- Simplex Noise Functions (from sphere.jsx) ---
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

          vec3 i = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);

          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);

          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;

          i = mod289(i);
          vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                  + i.x + vec4(0.0, i1.x, i2.x, 1.0));

          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;

          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);

          vec4 x = x_ * ns.x + ns.yyyy;
          vec4 y = y_ * ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);

          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);

          vec4 s0 = floor(b0) * 2.0 + 1.0;
          vec4 s1 = floor(b1) * 2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));

          vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);

          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;

          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        void main() {
          vec3 pos = position;
          
          // === WAVE STATE (uScroll = 0) - From hero_back_dots ===
          // Multiple wave layers with different speeds and amplitudes
          float wave1 = sin(pos.y * 0.02 + uTime * 1.5) * 8.0;
          float wave2 = sin(pos.y * 0.04 - uTime * 1.2) * 6.0;
          float wave3 = sin(pos.y * 0.08 + uTime * 2.0) * 4.0;
          float wave4 = sin(pos.x * 0.03 - uTime * 1.0) * 7.0;
          float wave5 = sin((pos.x + pos.y) * 0.025 + uTime * 0.8) * 5.0;
          float wave6 = cos(pos.x * 0.035 - pos.y * 0.02 + uTime * 1.3) * 4.5;
          float detail1 = sin(pos.x * 0.1 + pos.y * 0.08 + uTime * 2.5) * 2.0;
          float detail2 = cos(pos.x * 0.12 - pos.y * 0.1 - uTime * 3.0) * 1.5;
          
          float elevation = wave1 + wave2 + wave3 + wave4 + wave5 + wave6 + detail1 + detail2;
          
          vec3 wavePos = pos;
          wavePos.z += elevation;
          
          // === SPHERE STATE (uScroll = 1) - From sphere.jsx ===
          vec3 spherePos = aSpherePosition;
          
          // Apply noise displacement to sphere (reduced for better circular shape)
          float noise = snoise(aSpherePosition * 0.05 + uTime * 0.2);
          spherePos += aSphereNormal * noise * 2.5; // Reduced displacement for rounder shape
          
          // === STAGGERED TRANSITION ===
          // Each particle transitions at slightly different times
          float adjustedScroll = uScroll * 1.4 - aDelay;
          float localProgress = clamp(adjustedScroll, 0.0, 1.0);
          localProgress = smoothstep(0.0, 1.0, localProgress);
          vMorphProgress = localProgress;
          
          // === SMOOTH MORPH with convergence effect ===
          // Particles converge toward center before forming sphere
          float convergeFactor = sin(localProgress * 3.14159); // Peaks at 0.5
          
          vec3 convergePoint = vec3(0.0, 0.0, 0.0); // Center point
          vec3 toCenter = convergePoint - wavePos;
          
          vec3 intermediatePos = wavePos + toCenter * convergeFactor * 0.3;
          
          // Final blend
          vec3 finalPos = mix(intermediatePos, spherePos, localProgress);
          
          // === PASS VARYINGS ===
          vElevation = mix(elevation, noise * 30.0, localProgress);
          vNoise = noise;
          
          vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          // === POINT SIZE ===
          // Wave: size based on elevation (from hero_back_dots)
          // Sphere: BIGGER dots, closer together
          float waveSize = 4.0 * (1.0 + elevation / 30.0) * (30.0 / -mvPosition.z);
          float sphereSize = (4.0 / -mvPosition.z) * 55.0; // Very big dots
          gl_PointSize = mix(waveSize, sphereSize, localProgress);
          
          vDistance = -mvPosition.z;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;
        
        varying float vElevation;
        varying float vDistance;
        varying float vMorphProgress;
        varying float vNoise;

        void main() {
          // Circular particle with soft edges
          float d = distance(gl_PointCoord, vec2(0.5));
          if (d > 0.5) discard;
          
          float alpha = smoothstep(0.5, 0.3, d);

          // === WAVE COLORS (from hero_back_dots) ===
          float mixStrength = (vElevation + 25.0) / 50.0;
          mixStrength = clamp(mixStrength, 0.0, 1.0);
          
          vec3 waveColor = mix(uColor1, uColor2, mixStrength);
          float highlight = smoothstep(0.75, 1.0, mixStrength);
          waveColor = mix(waveColor, uColor3, highlight * 0.6);
          
          // === SPHERE COLORS (from sphere.jsx) ===
          // Deep blood red (shadows)
          vec3 colorDeep = vec3(0.4, 0.02, 0.02);
          // Standard red-orange (mid)
          vec3 colorMid = vec3(0.8, 0.1, 0.05);
          // Vibrant orange (highlights)
          vec3 colorHighlight = vec3(1.0, 0.4, 0.0);
          
          float n = smoothstep(-0.4, 0.4, vNoise);
          vec3 sphereColor;
          
          if (n < 0.6) {
            sphereColor = mix(colorDeep, colorMid, n / 0.6);
          } else {
            sphereColor = mix(colorMid, colorHighlight, (n - 0.6) / 0.4);
          }
          
          // === BLEND COLORS based on morph progress ===
          vec3 finalColor = mix(waveColor, sphereColor, vMorphProgress);

          // Distance fog
          float fog = smoothstep(20.0, 100.0, vDistance);
          
          gl_FragColor = vec4(finalColor, (1.0 - fog * 0.5) * alpha * 0.85);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    materialRef.current = material;

    const particles = new THREE.Points(geometry, material);
    particles.rotation.x = -Math.PI / 2.2; // Initial rotation for wave view
    particlesRef.current = particles;
    scene.add(particles);

    // ========================================
    // ANIMATION LOOP
    // ========================================
    const clock = new THREE.Clock();

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Smooth scroll interpolation
      scrollRef.current.current += (scrollRef.current.target - scrollRef.current.current) * 0.05;
      const scroll = scrollRef.current.current;
      
      material.uniforms.uTime.value = elapsedTime * 0.5; // Slower wave motion
      material.uniforms.uScroll.value = scroll;

      // === CAMERA TRANSITION ===
      // Wave view (scroll=0): Looking down at the flowing wave
      // Sphere view (scroll=1): Looking at centered sphere (closer like original)
      
      const waveCamPos = new THREE.Vector3(0, 30, 60);
      const sphereCamPos = new THREE.Vector3(0, 0, 55); // Even closer
      
      camera.position.lerpVectors(waveCamPos, sphereCamPos, scroll);
      
      // Smoothly transition lookAt
      const waveLookAt = new THREE.Vector3(0, 15, 0);
      const sphereLookAt = new THREE.Vector3(0, 0, 0);
      const lookAtTarget = new THREE.Vector3();
      lookAtTarget.lerpVectors(waveLookAt, sphereLookAt, scroll);
      camera.lookAt(lookAtTarget);
      
      // Camera up vector transition (wave has inverted up)
      const waveUp = new THREE.Vector3(0, -1, 0);
      const sphereUp = new THREE.Vector3(0, 1, 0);
      camera.up.lerpVectors(waveUp, sphereUp, scroll);

      // === WAVE MODE MOTION (from hero_back_dots) ===
      const waveDamp = 1.0 - scroll;
      
      // Horizontal drift
      particles.position.x = Math.sin(elapsedTime * 0.4) * 12 * waveDamp;
      // Vertical breathing
      particles.position.y = Math.sin(elapsedTime * 0.5) * 6 * waveDamp;
      // Forward-backward
      particles.position.z = Math.sin(elapsedTime * 0.35) * 5 * waveDamp;
      
      // Wave rotation
      const waveRotX = -Math.PI / 2.2;
      const sphereRotX = 0;
      particles.rotation.x = waveRotX + (sphereRotX - waveRotX) * scroll;
      
      particles.rotation.z = Math.sin(elapsedTime * 0.3) * 0.08 * waveDamp;
      particles.rotation.y = (Math.cos(elapsedTime * 0.25) * 0.05 * waveDamp) + (scroll * elapsedTime * 0.1);

      // Gentle camera sway in wave mode
      camera.position.x += Math.sin(elapsedTime * 0.2) * 3 * waveDamp;
      camera.position.y += Math.cos(elapsedTime * 0.15) * 2 * waveDamp;

      renderer.render(scene, camera);
    };

    animate();

    // ========================================
    // EVENT HANDLERS
    // ========================================
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    const handleScroll = () => {
      // Transition over 1.5 viewport heights
      const maxScroll = window.innerHeight * 1.5;
      const scrollProgress = Math.min(window.scrollY / maxScroll, 1.0);
      scrollRef.current.target = scrollProgress;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);

    // ========================================
    // CLEANUP
    // ========================================
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(frameIdRef.current);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'radial-gradient(circle at 50% 50%, #2a0800 0%, #000000 100%)',
        overflow: 'hidden',
        zIndex: -1
      }}
    />
  );
};

export default MorphingWaveToSphere;
