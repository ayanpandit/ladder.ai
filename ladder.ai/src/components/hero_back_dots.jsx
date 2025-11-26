import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const ThreeDotsWave = () => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const particlesRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 50;
    camera.position.y = -30;
    camera.lookAt(0, 0, 0);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create particle system
    const particleCount = 8000;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    
    const gridSize = 100;
    const spacing = 1.5;
    let index = 0;

    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        if (index >= particleCount) break;
        
        const posX = (x - gridSize / 2) * spacing;
        const posZ = (z - gridSize / 2) * spacing;
        
        positions[index * 3] = posX;
        positions[index * 3 + 1] = 0;
        positions[index * 3 + 2] = posZ;

        // Bright orange/red colors
        const colorVariation = Math.random() * 0.2;
        colors[index * 3] = 1.0; // R
        colors[index * 3 + 1] = 0.4 + colorVariation; // G - brighter
        colors[index * 3 + 2] = 0.15; // B

        index++;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Create circular dot texture - solid and clear
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.8, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
      map: texture,
      depthWrite: false
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    particlesRef.current = particles;

    // Animation
    let time = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      time += 0.01;

      const positionArray = particles.geometry.attributes.position.array;
      
      for (let i = 0; i < particleCount; i++) {
        const x = positionArray[i * 3];
        const z = positionArray[i * 3 + 2];
        
        // Create multiple distinct wave patterns for 3D depth
        const distance = Math.sqrt(x * x + z * z);
        
        // First wave - main radial wave from center
        const wave1 = Math.sin(distance * 0.15 - time * 3) * 5;
        
        // Second wave - diagonal wave
        const wave2 = Math.sin((x + z) * 0.08 + time * 2) * 3;
        
        // Third wave - opposite diagonal for complexity
        const wave3 = Math.cos((x - z) * 0.08 - time * 1.5) * 3;
        
        // Combine waves with different amplitudes for depth
        positionArray[i * 3 + 1] = wave1 + wave2 + wave3;
      }
      
      particles.geometry.attributes.position.needsUpdate = true;

      // Rotate slightly for dynamic effect
      particles.rotation.y = Math.sin(time * 0.2) * 0.1;

      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
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
        background: 'linear-gradient(to bottom, #1a0a0a 0%, #4a1515 50%, #1a0a0a 100%)',
        zIndex: -1
      }}
    />
  );
};

export default ThreeDotsWave;