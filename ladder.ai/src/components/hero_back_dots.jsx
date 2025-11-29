import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const ElegantDotsWave = () => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const materialRef = useRef(null);
  const frameIdRef = useRef(null);
  const scrollRef = useRef({ current: 0, target: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      1,
      1000
    );
    camera.position.set(0, 30, 60);
    camera.up.set(0, -1, 0);
    camera.lookAt(0, 15, 0);

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

    // Geometry - High density grid
    const width = 240;
    const height = 120;
    const segmentsX = 240;
    const segmentsY = 120;
    const geometry = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);

    // Calculate Sphere Positions
    const count = geometry.attributes.position.count;
    const spherePositions = new Float32Array(count * 3);
    const sphereRadius = 40;

    for (let i = 0; i < count; i++) {
      // Get UV coordinates (approximate from index since PlaneGeometry is a grid)
      // PlaneGeometry vertices are row by row
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
    }

    geometry.setAttribute('aSpherePosition', new THREE.BufferAttribute(spherePositions, 3));

    // Shader Material with enhanced wave motion
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uColor1: { value: new THREE.Color('#8B0000') },
        uColor2: { value: new THREE.Color('#FF4500') },
        uColor3: { value: new THREE.Color('#FFD700') },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uScroll;
        attribute vec3 aSpherePosition;
        varying float vElevation;
        varying float vDistance;
        
        void main() {
          vec3 pos = position;
          
          // --- WAVE LOGIC (Existing) ---
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
          
          // Apply elevation to Z axis for the plane state
          vec3 planePos = pos;
          planePos.z += elevation;

          // --- SPHERE LOGIC ---
          // Add some subtle movement to the sphere too
          vec3 spherePos = aSpherePosition;
          // Optional: Rotate sphere or pulse it
          float spherePulse = sin(uTime * 2.0 + spherePos.y * 0.1) * 0.5;
          spherePos += normalize(spherePos) * spherePulse;

          // --- MIXING ---
          // Smooth mix based on scroll
          vec3 finalPos = mix(planePos, spherePos, uScroll);
          
          // Pass elevation for coloring (fade out elevation effect as we go to sphere)
          vElevation = mix(elevation, 0.0, uScroll);
          
          vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          // Dynamic particle size
          // In sphere mode, maybe uniform size is better, or keep the depth effect
          float sizeMultiplier = 1.0 + (vElevation / 30.0);
          gl_PointSize = 4.0 * sizeMultiplier * (30.0 / -mvPosition.z);
          
          vDistance = -mvPosition.z;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;
        varying float vElevation;
        varying float vDistance;

        void main() {
          // Circular particle with soft edges
          float strength = distance(gl_PointCoord, vec2(0.5));
          strength = 1.0 - step(0.5, strength);
          if (strength < 0.5) discard;
          
          // Smooth particle edges
          float alpha = smoothstep(0.5, 0.3, distance(gl_PointCoord, vec2(0.5)));

          // Dynamic color mixing based on elevation
          float mixStrength = (vElevation + 25.0) / 50.0;
          mixStrength = clamp(mixStrength, 0.0, 1.0);

          vec3 color = mix(uColor1, uColor2, mixStrength);
          
          // Add golden highlights for peaks
          float highlight = smoothstep(0.75, 1.0, mixStrength);
          color = mix(color, uColor3, highlight * 0.6);

          // Distance fog
          float fog = smoothstep(20.0, 100.0, vDistance);
          
          gl_FragColor = vec4(color, (1.0 - fog * 0.5) * alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    materialRef.current = material;

    const particles = new THREE.Points(geometry, material);
    particles.rotation.x = -Math.PI / 2.2;
    scene.add(particles);

    // Animation loop
    const clock = new THREE.Clock();

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Smooth scroll update
      scrollRef.current.current += (scrollRef.current.target - scrollRef.current.current) * 0.05;
      material.uniforms.uScroll.value = scrollRef.current.current;

      // Faster time progression for more visible motion
      material.uniforms.uTime.value = elapsedTime * 0.8;

      // Enhanced mesh transformations for visible global motion
      // We dampen these global movements as we transition to sphere to keep it centered
      const damp = 1.0 - scrollRef.current.current;

      // Horizontal drift (left-right)
      particles.position.x = Math.sin(elapsedTime * 0.4) * 12 * damp;

      // Vertical breathing (up-down)
      particles.position.y = Math.sin(elapsedTime * 0.5) * 6 * damp;

      // Forward-backward motion
      particles.position.z = Math.sin(elapsedTime * 0.35) * 5 * damp;

      // Rotation waves for organic feel
      particles.rotation.z = Math.sin(elapsedTime * 0.3) * 0.08 * damp;
      particles.rotation.y = (Math.cos(elapsedTime * 0.25) * 0.05 * damp) + (scrollRef.current.current * elapsedTime * 0.1); // Add spin in sphere mode

      // Gentle camera movement for dynamic perspective
      camera.position.x = Math.sin(elapsedTime * 0.2) * 3;
      camera.position.y = 30 + Math.cos(elapsedTime * 0.15) * 2;
      camera.lookAt(0, 15, 0);

      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    // Handle Scroll
    const handleScroll = () => {
      const maxScroll = window.innerHeight * 1.5; // Full transition over 1.5 viewports
      const scrollProgress = Math.min(window.scrollY / maxScroll, 1.0);
      scrollRef.current.target = scrollProgress;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);

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
        zIndex: -1 // Ensure it stays behind content
      }}
    />
  );
};

export default ElegantDotsWave;