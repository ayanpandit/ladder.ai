import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";

// --- GLSL SHADERS ---

const vertexShader = `
  uniform float uTime;
  varying float vNoise;

  // --- Noise Functions ---
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 = v - i + dot(i, C.xxx) ;

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute( permute( permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                  dot(p2,x2), dot(p3,x3) ) );
  }

  void main() {
    float noise = snoise(position * 1.5 + uTime * 0.2);
    vNoise = noise;
    
    // Smooth displacement
    vec3 newPos = position + (normal * noise * 0.3);

    vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
    
    // Smaller points (8.0) to make them look like distinct dots, not lines
    gl_PointSize = (4.0 / -mvPosition.z) * 8.0; 
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying float vNoise;

  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    if (d > 0.5) discard;

    // --- EXACT COLOR MATCHING ---
    // 1. Base Color: Deep "Blood Red" (for the shadow areas)
    vec3 colorDeep = vec3(0.4, 0.02, 0.02); 
    
    // 2. Mid Color: Standard Red-Orange
    vec3 colorMid = vec3(0.8, 0.1, 0.05);

    // 3. Highlight: Vibrant Orange (Removed Yellow/White completely)
    vec3 colorHighlight = vec3(1.0, 0.4, 0.0); 

    // Normalize noise to 0.0 -> 1.0
    float n = smoothstep(-0.4, 0.4, vNoise);

    vec3 finalColor;

    // Strictly limit the "bright" part to only the very tips
    if (n < 0.6) {
       // Bottom 60% of noise is just Red -> Deep Red
       finalColor = mix(colorDeep, colorMid, n / 0.6);
    } else {
       // Top 40% transitions to Orange
       finalColor = mix(colorMid, colorHighlight, (n - 0.6) / 0.4);
    }

    // Reduce alpha to prevent "blown out" white look when points overlap
    float alpha = 0.8 - smoothstep(0.2, 0.5, d);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// --- REACT COMPONENTS ---

const GlowingSphere = () => {
  const meshRef = useRef();
  const uniforms = useMemo(() => ({ uTime: { value: 0.0 } }), []);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.material.uniforms.uTime.value = state.clock.getElapsedTime();
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.1;
    }
  });

  return (
    <points ref={meshRef}>
      {/* 200 segments for EXTREMELY high density to look like a solid cloud */}
      <sphereGeometry args={[1.7, 200, 200]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        // Additive blending creates the glow, but our dark colors prevent it from turning white
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

const IzumSphere = () => {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        // Darker, more subtle background
        background: "radial-gradient(circle at center, #2e0505 0%, #000000 60%)",
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: -1
      }}
    >
      <Canvas camera={{ position: [0, 0, 4.5], fov: 60 }}>
        <OrbitControls enableZoom={false} enablePan={false} />
        <GlowingSphere />
      </Canvas>
    </div>
  );
};

export default IzumSphere;