/**
 * NeuralBackground.tsx — Cinematic futuristic command center environment.
 *
 * Visual elements:
 * - Sparse neural network: 3 layers, 15-25 nodes each, large points, minimal connections
 * - Purple energy clouds: overlapping large transparent planes at left/right
 * - Dark reflective room with angled walls, pillars, desk silhouettes
 * - Atmospheric fog for depth
 * - Orb at bottom center
 */

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useAgentStore } from '../store/agentStore'
import type { AgentState } from '../store/agentStore'
import { OrbScene3D } from '../widgets/InvestigationOrb'

export const STATE_COLORS: Record<AgentState, string> = {
  idle:          '#00E5FF',
  thinking:      '#2563EB',
  investigating: '#7C3AED',
  warning:       '#EF4444',
  explaining:    '#10B981',
}

// ── Purple energy cloud — overlapping large transparent planes ──
function EnergyCloud({
  position, color, pulsePhase,
}: {
  position: [number, number, number]
  color: string
  pulsePhase: number
}) {
  const planesRef = useRef<THREE.Group>(null!)

  const planes = useMemo(() => {
    return Array.from({ length: 9 }, (_, i) => ({
      rx: (Math.random() - 0.5) * Math.PI,
      ry: (Math.random() - 0.5) * Math.PI,
      rz: (Math.random() - 0.5) * Math.PI,
      ox: (Math.random() - 0.5) * 3.0,
      oy: (Math.random() - 0.5) * 3.0,
      oz: (Math.random() - 0.5) * 2.0,
      scale: 0.8 + Math.random() * 0.8,
      phase: i * 0.7,
    }))
  }, [])

  const matRefs = useRef<THREE.MeshBasicMaterial[]>([])

  useFrame((s) => {
    const t = s.clock.elapsedTime
    matRefs.current.forEach((mat, i) => {
      if (mat) {
        mat.opacity = 0.05 + Math.sin(t * 0.3 + pulsePhase + planes[i].phase) * 0.035
      }
    })
  })

  const col = useMemo(() => new THREE.Color(color), [color])

  return (
    <group ref={planesRef} position={position}>
      {planes.map((p, i) => (
        <mesh
          key={i}
          rotation={[p.rx, p.ry, p.rz]}
          position={[p.ox, p.oy, p.oz]}
          scale={[p.scale, p.scale, p.scale]}
        >
          <planeGeometry args={[14, 14]} />
          <meshBasicMaterial
            ref={(el) => { if (el) matRefs.current[i] = el }}
            color={col}
            transparent
            opacity={0.06}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* Point light from this energy source */}
      <pointLight intensity={4.5} color={col} distance={20} decay={1.4} />
    </group>
  )
}

// ── Physical room architecture ────────────────────────────────────────────────
function Room({ cyanColor }: { cyanColor: string }) {
  const cyan = useMemo(() => new THREE.Color(cyanColor), [cyanColor])
  const darkBlue = useMemo(() => new THREE.Color('#020814'), [])
  const floorCol = useMemo(() => new THREE.Color('#010407'), [])

  return (
    <>
      {/* Floor — highly reflective dark surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -6, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={floorCol} metalness={0.99} roughness={0.01} />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 10, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={darkBlue} metalness={0.85} roughness={0.15} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 0, -28]}>
        <planeGeometry args={[100, 36]} />
        <meshStandardMaterial color={darkBlue} metalness={0.75} roughness={0.25} />
      </mesh>

      {/* Left wall (angled) */}
      <mesh rotation={[0, Math.PI / 2.3, 0]} position={[-22, 0, -9]}>
        <planeGeometry args={[44, 36]} />
        <meshStandardMaterial color={darkBlue} metalness={0.75} roughness={0.25} />
      </mesh>

      {/* Right wall (angled) */}
      <mesh rotation={[0, -Math.PI / 2.3, 0]} position={[22, 0, -9]}>
        <planeGeometry args={[44, 36]} />
        <meshStandardMaterial color={darkBlue} metalness={0.75} roughness={0.25} />
      </mesh>

      {/* Floor edge light strips — cyan lines along floor */}
      <mesh position={[-9, -5.9, -8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.05, 28]} />
        <meshBasicMaterial color={cyan} transparent opacity={0.45} />
      </mesh>
      <mesh position={[9, -5.9, -8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.05, 28]} />
        <meshBasicMaterial color={cyan} transparent opacity={0.45} />
      </mesh>
      {/* Center line */}
      <mesh position={[0, -5.89, -8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.02, 28]} />
        <meshBasicMaterial color={cyan} transparent opacity={0.2} />
      </mesh>

      {/* Control desk silhouettes */}
      <mesh position={[-17, -4.2, -6]}>
        <boxGeometry args={[9, 0.18, 4]} />
        <meshStandardMaterial color="#04081a" metalness={0.95} roughness={0.05} />
      </mesh>
      <mesh position={[17, -4.2, -6]}>
        <boxGeometry args={[9, 0.18, 4]} />
        <meshStandardMaterial color="#04081a" metalness={0.95} roughness={0.05} />
      </mesh>
      {/* Desk screens/monitors as thin emissive slabs */}
      <mesh position={[-17, -3.2, -7]}>
        <boxGeometry args={[6, 1.8, 0.08]} />
        <meshStandardMaterial color="#000820" emissive={cyan} emissiveIntensity={0.15} metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[17, -3.2, -7]}>
        <boxGeometry args={[6, 1.8, 0.08]} />
        <meshStandardMaterial color="#000820" emissive={cyan} emissiveIntensity={0.15} metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Vertical pillar structures */}
      {([-15, -11, 15, 11] as number[]).map((x, i) => (
        <group key={i} position={[x, -1, -5 - (i % 2) * 5]}>
          <mesh>
            <boxGeometry args={[0.35, 14, 0.35]} />
            <meshStandardMaterial color="#050a1e" metalness={0.98} roughness={0.02} />
          </mesh>
          {/* Glowing edge on pillar */}
          <mesh position={[0.175, 0, 0]}>
            <planeGeometry args={[0.025, 14]} />
            <meshBasicMaterial color={i < 2 ? '#7C3AED' : cyanColor} transparent opacity={0.6} />
          </mesh>
          {/* Pillar top cap glow */}
          <mesh position={[0, 7, 0]}>
            <boxGeometry args={[0.5, 0.08, 0.5]} />
            <meshStandardMaterial color={i < 2 ? '#7C3AED' : cyanColor} emissive={new THREE.Color(i < 2 ? '#7C3AED' : cyanColor)} emissiveIntensity={1.5} />
          </mesh>
        </group>
      ))}

      {/* Ceiling grid lines */}
      {[-6, -3, 0, 3, 6].map((x, i) => (
        <mesh key={`cx-${i}`} position={[x, 9.8, -8]} rotation={[0, 0, 0]}>
          <planeGeometry args={[0.012, 40]} />
          <meshBasicMaterial color={cyanColor} transparent opacity={0.06} />
        </mesh>
      ))}
    </>
  )
}

// ── Sparse neural network layer ───────────────────────────────────────────────
function NeuralLayer({
  color, position, nodeCount, distThreshold,
  nodeOpacity, lineOpacity, nodeSize, rotSpeed,
}: {
  color: string
  position: [number, number, number]
  nodeCount: number
  distThreshold: number
  nodeOpacity: number
  lineOpacity: number
  nodeSize: number
  rotSpeed: number
}) {
  const ptsRef = useRef<THREE.Points>(null!)
  const lnsRef = useRef<THREE.LineSegments>(null!)
  const col = useMemo(() => new THREE.Color(color), [color])

  const { na, la } = useMemo(() => {
    const na = new Float32Array(nodeCount * 3)
    for (let i = 0; i < nodeCount; i++) {
      na[i*3]   = (Math.random() - 0.5) * 20
      na[i*3+1] = (Math.random() - 0.5) * 14
      na[i*3+2] = (Math.random() - 0.5) * 5
    }
    const lines: number[] = []
    const dt2 = distThreshold * distThreshold
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const dx = na[i*3] - na[j*3]
        const dy = na[i*3+1] - na[j*3+1]
        const dz = na[i*3+2] - na[j*3+2]
        if (dx*dx + dy*dy + dz*dz < dt2) {
          lines.push(na[i*3], na[i*3+1], na[i*3+2], na[j*3], na[j*3+1], na[j*3+2])
        }
      }
    }
    return { na, la: new Float32Array(lines) }
  }, [nodeCount, distThreshold])

  useFrame((_, dt) => {
    if (ptsRef.current) ptsRef.current.rotation.y += dt * rotSpeed
    if (lnsRef.current) lnsRef.current.rotation.y += dt * rotSpeed
  })

  return (
    <group position={position}>
      <points ref={ptsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={na} count={na.length / 3} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial color={col} size={nodeSize} sizeAttenuation transparent opacity={nodeOpacity} depthWrite={false} />
      </points>
      {la.length > 0 && (
        <lineSegments ref={lnsRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" array={la} count={la.length / 3} itemSize={3} />
          </bufferGeometry>
          <lineBasicMaterial color={col} transparent opacity={lineOpacity} depthWrite={false} />
        </lineSegments>
      )}
    </group>
  )
}

// ── Floating data particles ────────────────────────────────────────────────────
function FloatingParticles({ color }: { color: string }) {
  const ref = useRef<THREE.Points>(null!)
  const col = useMemo(() => new THREE.Color(color), [color])

  const positions = useMemo(() => {
    const arr = new Float32Array(120 * 3)
    for (let i = 0; i < 120; i++) {
      arr[i*3]   = (Math.random() - 0.5) * 50
      arr[i*3+1] = (Math.random() - 0.5) * 20
      arr[i*3+2] = -20 + Math.random() * 15
    }
    return arr
  }, [])

  useFrame((_s, dt) => {
    if (ref.current) {
      ref.current.rotation.y += dt * 0.005
      // Gentle drift upward
      const pos = ref.current.geometry.attributes.position
      for (let i = 0; i < 120; i++) {
        pos.setY(i, pos.getY(i) + dt * 0.05)
        if (pos.getY(i) > 12) pos.setY(i, -12)
      }
      pos.needsUpdate = true
    }
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={120} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color={col} size={0.04} sizeAttenuation transparent opacity={0.3} depthWrite={false} />
    </points>
  )
}

// ── Complete scene ────────────────────────────────────────────────────────────
function Scene({ agentState }: { agentState: AgentState }) {
  const color = STATE_COLORS[agentState]

  return (
    <>
      <color attach="background" args={['#010209']} />
      {/* Dense fog creates depth corridor */}
      <fog attach="fog" args={['#020614', 10, 36]} />

      {/* ════════════════════ LIGHTING ════════════════════ */}
      <ambientLight intensity={0.03} />

      {/* Primary state-color key light above orb */}
      <pointLight position={[0, 4, 8]}    intensity={5.0} color={color}    distance={30} decay={1.6} />
      <pointLight position={[0, -2, 6]}   intensity={3.5} color={color}    distance={22} decay={1.8} />

      {/* Left purple energy sources */}
      <pointLight position={[-12, 3, -3]} intensity={5.5} color="#7C3AED"  distance={32} decay={1.4} />
      <pointLight position={[-16, 0, -8]} intensity={3.0} color="#9333ea"  distance={26} decay={1.7} />
      <pointLight position={[-8,  2, -1]} intensity={2.0} color="#a855f7"  distance={18} decay={2.0} />

      {/* Right purple energy sources */}
      <pointLight position={[12, 3, -3]}  intensity={5.5} color="#7C3AED"  distance={32} decay={1.4} />
      <pointLight position={[16, 0, -8]}  intensity={3.0} color="#9333ea"  distance={26} decay={1.7} />
      <pointLight position={[8,  2, -1]}  intensity={2.0} color="#a855f7"  distance={18} decay={2.0} />

      {/* Floor bounce light — crucial for reflective floor */}
      <pointLight position={[0, -5.2, 0]} intensity={2.5} color={color}    distance={22} decay={1.8} />
      <pointLight position={[-8, -5.2, -4]} intensity={1.5} color="#7C3AED" distance={18} decay={2.0} />
      <pointLight position={[8,  -5.2, -4]} intensity={1.5} color="#7C3AED" distance={18} decay={2.0} />

      {/* Deep back ambience */}
      <pointLight position={[0, 2, -22]}  intensity={1.5} color="#1e3a8a"  distance={28} decay={1.8} />

      {/* ════════════════════ ROOM ════════════════════ */}
      <Room cyanColor={color} />

      {/* ════════════════════ PURPLE ENERGY CLOUDS ════════════════════ */}
      <EnergyCloud position={[-12, 1, -4]}  color="#7C3AED" pulsePhase={0}   />
      <EnergyCloud position={[-16, 3, -8]}  color="#9333ea" pulsePhase={1.8} />
      <EnergyCloud position={[-10, -1, -2]} color="#6d28d9" pulsePhase={3.2} />

      <EnergyCloud position={[12, 1, -4]}   color="#7C3AED" pulsePhase={0.9} />
      <EnergyCloud position={[16, 3, -8]}   color="#9333ea" pulsePhase={2.7} />
      <EnergyCloud position={[10, -1, -2]}  color="#6d28d9" pulsePhase={4.1} />

      {/* ════════════════════ FLOATING PARTICLES ════════════════════ */}
      <FloatingParticles color={color} />
      <FloatingParticles color="#7C3AED" />

      {/* ════════════════════ SPARSE NEURAL NETWORKS ════════════════════ */}
      {/* Layer 1 — near, left cluster, state color */}
      <NeuralLayer
        color={color}
        position={[-10, 0.5, 0]}
        nodeCount={22}
        distThreshold={3.2}
        nodeOpacity={0.90}
        lineOpacity={0.09}
        nodeSize={0.18}
        rotSpeed={0.022}
      />
      {/* Layer 2 — near, right cluster, light blue */}
      <NeuralLayer
        color="#38BDF8"
        position={[10, 0.5, -1]}
        nodeCount={20}
        distThreshold={3.2}
        nodeOpacity={0.80}
        lineOpacity={0.07}
        nodeSize={0.16}
        rotSpeed={0.018}
      />
      {/* Layer 3 — mid background, purple-tinted */}
      <NeuralLayer
        color="#a78bfa"
        position={[-4, 2, -10]}
        nodeCount={24}
        distThreshold={3.0}
        nodeOpacity={0.45}
        lineOpacity={0.07}
        nodeSize={0.13}
        rotSpeed={0.012}
      />
      {/* Layer 4 — far background, very dim */}
      <NeuralLayer
        color="#818cf8"
        position={[5, -1, -18]}
        nodeCount={18}
        distThreshold={3.5}
        nodeOpacity={0.20}
        lineOpacity={0.04}
        nodeSize={0.10}
        rotSpeed={0.006}
      />

      {/* ════════════════════ ORB ════════════════════ */}
      {/* OrbScene3D reads agentState from the store — no props needed */}
      <OrbScene3D />
    </>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function NeuralBackground() {
  const agentState = useAgentStore((s) => s.state)

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      {/* Vignette — darkens corners */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, rgba(1,2,9,0.72) 100%)',
      }} />

      {/* Bottom fade — grounds the scene */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '22%',
        zIndex: 2, pointerEvents: 'none',
        background: 'linear-gradient(to top, rgba(1,2,9,0.65) 0%, transparent 100%)',
      }} />

      {/* Top subtle darkening */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '15%',
        zIndex: 2, pointerEvents: 'none',
        background: 'linear-gradient(to bottom, rgba(1,2,9,0.4) 0%, transparent 100%)',
      }} />

      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 1.5, 15], fov: 56 }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.25,
          powerPreference: 'high-performance',
        }}
        dpr={[1, 1.5]}
        shadows
      >
        <Scene agentState={agentState} />
      </Canvas>
    </div>
  )
}