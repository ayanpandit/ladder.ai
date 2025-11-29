import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const ElegantDotsWave = () => {
    const containerRef = useRef(null);
    const scrollProgressRef = useRef(0);

    useEffect(() => {
        if (!containerRef.current) return;

        // Scene setup
        const scene = new THREE.Scene();

        // Camera setup
        const camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            1,
            1000
        );
        camera.position.set(0, 0, 80);
        camera.lookAt(0, 0, 0);

        // Renderer setup
        const renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: "high-performance"
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        containerRef.current.appendChild(renderer.domElement);

        // Create SPHERE geometry instead of plane
        const sphereRadius = 35;
        const geometry = new THREE.SphereGeometry(sphereRadius, 120, 120);

        // Store original sphere positions and create flat wave positions
        const positionAttribute = geometry.attributes.position;
        const count = positionAttribute.count;

        const originalPositions = new Float32Array(count * 3);
        const wavePositions = new Float32Array(count * 3);

        // Store original sphere positions
        for (let i = 0; i < count; i++) {
            originalPositions[i * 3] = positionAttribute.getX(i);
            originalPositions[i * 3 + 1] = positionAttribute.getY(i);
            originalPositions[i * 3 + 2] = positionAttribute.getZ(i);
        }

        // Create flat wave positions
        for (let i = 0; i < count; i++) {
            const x = originalPositions[i * 3];
            const y = originalPositions[i * 3 + 1];
            const z = originalPositions[i * 3 + 2];

            // Project sphere to flat plane
            const length = Math.sqrt(x * x + y * y + z * z);
            const scale = 100 / sphereRadius;

            wavePositions[i * 3] = (x / length) * sphereRadius * scale;
            wavePositions[i * 3 + 1] = (y / length) * sphereRadius * scale;
            wavePositions[i * 3 + 2] = 0;
        }

        geometry.setAttribute('originalPosition', new THREE.BufferAttribute(originalPositions, 3));
        geometry.setAttribute('wavePosition', new THREE.BufferAttribute(wavePositions, 3));

        // Shader Material
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uMorphProgress: { value: 0 },
                uColor1: { value: new THREE.Color('#8B0000') },
                uColor2: { value: new THREE.Color('#FF4500') },
                uColor3: { value: new THREE.Color('#FFD700') },
            },
            vertexShader: `
        uniform float uTime;
        uniform float uMorphProgress;
        attribute vec3 originalPosition;
        attribute vec3 wavePosition;
        varying float vElevation;
        varying float vDistance;
        varying vec3 vNormal;
        
        void main() {
          vec3 pos = wavePosition;
          
          // Wave animations (applied when morphProgress is 0, i.e., at top)
          float waveIntensity = 1.0 - uMorphProgress;
          float wave1 = sin(pos.y * 0.02 + uTime * 1.5) * 8.0 * waveIntensity;
          float wave2 = sin(pos.y * 0.04 - uTime * 1.2) * 6.0 * waveIntensity;
          float wave3 = sin(pos.y * 0.08 + uTime * 2.0) * 4.0 * waveIntensity;
          float wave4 = sin(pos.x * 0.03 - uTime * 1.0) * 7.0 * waveIntensity;
          float wave5 = sin((pos.x + pos.y) * 0.025 + uTime * 0.8) * 5.0 * waveIntensity;
          float wave6 = cos(pos.x * 0.035 - pos.y * 0.02 + uTime * 1.3) * 4.5 * waveIntensity;
          float detail1 = sin(pos.x * 0.1 + pos.y * 0.08 + uTime * 2.5) * 2.0 * waveIntensity;
          float detail2 = cos(pos.x * 0.12 - pos.y * 0.1 - uTime * 3.0) * 1.5 * waveIntensity;
          
          float elevation = wave1 + wave2 + wave3 + wave4 + wave5 + wave6 + detail1 + detail2;
          pos.z += elevation;
          
          // Morph from flat wave to sphere
          vec3 spherePos = originalPosition;
          
          // Add subtle wave deformation to sphere surface
          vec3 normal = normalize(spherePos);
          float sphereWave = sin(normal.x * 5.0 + uTime * 1.5) * 0.8 +
                            sin(normal.y * 5.0 - uTime * 1.2) * 0.6 +
                            cos(normal.z * 5.0 + uTime * 1.0) * 0.5;
          spherePos += normal * sphereWave * uMorphProgress;
          
          vec3 finalPos = mix(pos, spherePos, uMorphProgress);
          
          vElevation = elevation + sphereWave * uMorphProgress;
          vNormal = normalize(finalPos);
          
          vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          // Particle size
          float baseSizeMultiplier = 1.0 + (abs(vElevation) / 30.0);
          gl_PointSize = 3.5 * baseSizeMultiplier * (50.0 / -mvPosition.z);
          
          vDistance = -mvPosition.z;
        }
      `,
            fragmentShader: `
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;
        varying float vElevation;
        varying float vDistance;
        varying vec3 vNormal;

        void main() {
          // Circular particle
          float strength = distance(gl_PointCoord, vec2(0.5));
          strength = 1.0 - step(0.5, strength);
          if (strength < 0.5) discard;
          
          float alpha = smoothstep(0.5, 0.2, distance(gl_PointCoord, vec2(0.5)));

          // Color based on elevation and normal
          float mixStrength = (vElevation + 15.0) / 30.0;
          mixStrength = clamp(mixStrength, 0.0, 1.0);

          vec3 color = mix(uColor1, uColor2, mixStrength);
          
          // Rim lighting effect for sphere edges
          float rimLight = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
          color = mix(color, uColor3, rimLight * 0.8);
          
          // Highlight peaks
          float highlight = smoothstep(0.7, 1.0, mixStrength);
          color = mix(color, uColor3, highlight * 0.5);

          // Distance fog
          float fog = smoothstep(30.0, 100.0, vDistance);
          
          gl_FragColor = vec4(color, (1.0 - fog * 0.3) * alpha);
        }
      `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        const particles = new THREE.Points(geometry, material);
        scene.add(particles);

        // Animation loop
        const clock = new THREE.Clock();
        let animationId;

        const animate = () => {
            animationId = requestAnimationFrame(animate);

            const elapsedTime = clock.getElapsedTime();

            material.uniforms.uTime.value = elapsedTime * 0.8;
            material.uniforms.uMorphProgress.value = scrollProgressRef.current;

            // Rotation based on scroll
            if (scrollProgressRef.current < 0.5) {
                // Wave state - keep it tilted
                particles.rotation.x = -Math.PI / 2.2;
                particles.rotation.y = elapsedTime * 0.05;
                particles.rotation.z = Math.sin(elapsedTime * 0.3) * 0.08;

                // Wave movements
                particles.position.x = Math.sin(elapsedTime * 0.4) * 12 * (1.0 - scrollProgressRef.current * 2);
                particles.position.y = Math.sin(elapsedTime * 0.5) * 6 * (1.0 - scrollProgressRef.current * 2);
            } else {
                // Sphere state - rotate freely
                const sphereProgress = (scrollProgressRef.current - 0.5) * 2;
                particles.rotation.x = -Math.PI / 2.2 + (Math.PI / 2.2) * sphereProgress;
                particles.rotation.y = elapsedTime * 0.3;
                particles.rotation.z = elapsedTime * 0.2;

                particles.position.x = 0;
                particles.position.y = 0;
            }

            // Camera adjustment
            const cameraOffset = (1.0 - scrollProgressRef.current) * 30;
            camera.position.y = cameraOffset;
            camera.lookAt(0, 0, 0);

            renderer.render(scene, camera);
        };

        animate();

        // Scroll handler
        const handleScroll = () => {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            const currentScroll = window.scrollY;
            const progress = Math.min(currentScroll / (maxScroll || 1), 1);
            scrollProgressRef.current = progress;
        };

        window.addEventListener('scroll', handleScroll);

        // Handle resize
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationId);
            if (containerRef.current && renderer.domElement) {
                containerRef.current.removeChild(renderer.domElement);
            }
            geometry.dispose();
            material.dispose();
            renderer.dispose();
        };
    }, []);

    return (
        <>
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
                    zIndex: 1
                }}
            />
            {/* Scroll spacer */}
            <div style={{
                height: '300vh',
                position: 'relative',
                zIndex: 10,
                pointerEvents: 'none'
            }} />
        </>
    );
};

export default ElegantDotsWave;