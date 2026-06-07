/**
 * InvestigationOrb.tsx
 *
 * Exports:
 *  - OrbScene3D: Cinematic volumetric energy orb — glowing plasma sphere,
 *    layered shells, equatorial energy disk, dense particle field, surface noise.
 *    Position unchanged: group at [0, -2.8, 0].
 *  - default InvestigationOrb: HTML/CSS ring overlay + mic button.
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mic, MicOff } from 'lucide-react'
import * as THREE from 'three'
import { useVoiceStore } from '../store/voiceStore'
import { useAgentStore } from '../store/agentStore'
import type { AgentState } from '../store/agentStore'

interface Props { state: AgentState }

const STATE_CONFIG = {
  idle:          { core: '#00E5FF', r1: '#00E5FF', r2: '#38BDF8', speed: 1.0, intensity: 1.2 },
  thinking:      { core: '#3B82F6', r1: '#2563EB', r2: '#60a5fa', speed: 2.2, intensity: 1.8 },
  investigating: { core: '#a855f7', r1: '#7C3AED', r2: '#c084fc', speed: 3.5, intensity: 2.5 },
  warning:       { core: '#EF4444', r1: '#EF4444', r2: '#f87171', speed: 5.0, intensity: 3.0 },
  explaining:    { core: '#10B981', r1: '#059669', r2: '#34D399', speed: 1.8, intensity: 1.5 },
}

// ---------------------------------------------------------------------------
// Procedural surface noise texture for the core sphere
// ---------------------------------------------------------------------------
function makeNoiseTexture(color: string): THREE.DataTexture {
  const size = 128
  const data = new Uint8Array(size * size * 4)
  const c = new THREE.Color(color)
  for (let i = 0; i < size * size; i++) {
    const n = Math.random()
    const bright = n > 0.92 ? 1.0 : n * 0.35
    data[i * 4 + 0] = Math.floor(c.r * bright * 255)
    data[i * 4 + 1] = Math.floor(c.g * bright * 255)
    data[i * 4 + 2] = Math.floor(c.b * bright * 255)
    data[i * 4 + 3] = Math.floor(bright * 220)
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.needsUpdate = true
  return tex
}

// ---------------------------------------------------------------------------
// OrbScene3D — volumetric plasma sphere
// ---------------------------------------------------------------------------
export function OrbScene3D() {
  const state = useAgentStore((s) => s.state) || 'idle'
  const config = STATE_CONFIG[state as AgentState] ?? STATE_CONFIG.idle

  const groupRef      = useRef<THREE.Group>(null!)
  const coreRef       = useRef<THREE.Mesh>(null!)
  const shell1Ref     = useRef<THREE.Mesh>(null!)
  const shell2Ref     = useRef<THREE.Mesh>(null!)
  const shell3Ref     = useRef<THREE.Mesh>(null!)
  const diskRef       = useRef<THREE.Mesh>(null!)
  const disk2Ref      = useRef<THREE.Mesh>(null!)
  const particleRef   = useRef<THREE.Points>(null!)
  const particle2Ref  = useRef<THREE.Points>(null!)
  const noiseRef      = useRef<THREE.Mesh>(null!)

  const colors = useMemo(() => ({
    core: new THREE.Color(config.core),
    r1:   new THREE.Color(config.r1),
    r2:   new THREE.Color(config.r2),
  }), [config])

  // Dense inner particle cloud — tight swarm just outside the core
  const innerParticles = useMemo(() => {
    const count = 220
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const u = Math.random(), v = Math.random()
      const theta = u * Math.PI * 2
      const phi   = Math.acos(2 * v - 1)
      const r     = 0.9 + Math.random() * 0.6
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)
    }
    return pos
  }, [])

  // Outer halo — larger sparse cloud
  const outerParticles = useMemo(() => {
    const count = 160
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const u = Math.random(), v = Math.random()
      const theta = u * Math.PI * 2
      const phi   = Math.acos(2 * v - 1)
      const r     = 1.8 + Math.random() * 1.2
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)
    }
    return pos
  }, [])

  // Noise texture for core surface
  const noiseTex = useMemo(() => makeNoiseTexture(config.core), [config.core])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const sp = config.speed

    // Smooth color transitions
    ;(coreRef.current?.material as THREE.MeshBasicMaterial)?.color.lerp(colors.core, 0.08)
    ;(shell1Ref.current?.material as THREE.MeshBasicMaterial)?.color.lerp(colors.r2, 0.06)
    ;(shell2Ref.current?.material as THREE.MeshBasicMaterial)?.color.lerp(colors.r1, 0.06)
    ;(noiseRef.current?.material as THREE.MeshBasicMaterial)?.color.lerp(colors.core, 0.08)

    // Core pulse — breathes in and out
    const pulse  = 1 + Math.sin(t * sp * 1.8) * 0.055
    const pulse2 = 1 + Math.sin(t * sp * 1.8 + 1.2) * 0.08
    const pulse3 = 1 + Math.sin(t * sp * 1.4 + 2.4) * 0.12

    coreRef.current?.scale.setScalar(pulse)
    noiseRef.current?.scale.setScalar(pulse * 1.01)
    shell1Ref.current?.scale.setScalar(pulse2 * 1.22)
    shell2Ref.current?.scale.setScalar(pulse3 * 1.45)
    shell3Ref.current?.scale.setScalar(1 + Math.sin(t * sp * 1.0 + 3.0) * 0.15)

    // Equatorial disk — slow counter-rotation on two axes
    if (diskRef.current) {
      diskRef.current.rotation.z = t * sp * 0.18
      diskRef.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.22) * 0.18
    }
    if (disk2Ref.current) {
      disk2Ref.current.rotation.z = -t * sp * 0.12
      disk2Ref.current.rotation.x = Math.PI / 2 + Math.cos(t * 0.18) * 0.22
      disk2Ref.current.rotation.y = t * sp * 0.08
    }

    // Particle swarm rotation — different axes for depth
    if (particleRef.current) {
      particleRef.current.rotation.y = t * 0.12 * sp
      particleRef.current.rotation.x = Math.sin(t * 0.09) * 0.3
      particleRef.current.rotation.z = t * 0.04 * sp
    }
    if (particle2Ref.current) {
      particle2Ref.current.rotation.y = -t * 0.07 * sp
      particle2Ref.current.rotation.x = Math.cos(t * 0.11) * 0.4
    }

    // Group micro-float — same position as before
    if (groupRef.current) {
      groupRef.current.position.y = -4.6 + Math.sin(t * 1.2) * 0.08
    }
  })

  return (
    <group ref={groupRef} position={[0, -4.6, 0]}>

      {/* ── LAYER 1: Solid core sphere ─────────────────────────────── */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.82, 64, 64]} />
        <meshBasicMaterial
          color={config.core}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* ── LAYER 2: Noise surface overlay ────────────────────────── */}
      <mesh ref={noiseRef}>
        <sphereGeometry args={[0.84, 64, 64]} />
        <meshBasicMaterial
          color={config.core}
          map={noiseTex}
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* ── LAYER 3: Inner plasma shell (soft glow haze) ───────────── */}
      <mesh ref={shell1Ref}>
        <sphereGeometry args={[0.90, 48, 48]} />
        <meshBasicMaterial
          color={config.r2}
          transparent
          opacity={0.28}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* ── LAYER 4: Mid corona shell ──────────────────────────────── */}
      <mesh ref={shell2Ref}>
        <sphereGeometry args={[0.95, 40, 40]} />
        <meshBasicMaterial
          color={config.r1}
          transparent
          opacity={0.14}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* ── LAYER 5: Outer volumetric aura shell ──────────────────── */}
      <mesh ref={shell3Ref}>
        <sphereGeometry args={[1.05, 32, 32]} />
        <meshBasicMaterial
          color={config.core}
          transparent
          opacity={0.06}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* ── LAYER 6: Equatorial energy disk A ────────────────────── */}
      <mesh ref={diskRef}>
        <torusGeometry args={[1.28, 0.055, 3, 128]} />
        <meshBasicMaterial
          color={config.core}
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* ── LAYER 7: Equatorial energy disk B (wider, fainter) ───── */}
      <mesh ref={disk2Ref}>
        <torusGeometry args={[1.55, 0.022, 3, 128]} />
        <meshBasicMaterial
          color={config.r2}
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* ── LAYER 8: Inner particle swarm ─────────────────────────── */}
      <points ref={particleRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[innerParticles, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={config.core}
          size={0.028}
          sizeAttenuation
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* ── LAYER 9: Outer halo particle cloud ───────────────────── */}
      <points ref={particle2Ref}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[outerParticles, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={config.r1}
          size={0.018}
          sizeAttenuation
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

    </group>
  )
}

// ---------------------------------------------------------------------------
// HTML/CSS overlay + mic button
//
// The mic button is `position: fixed` pinned to the exact screen coordinate
// of the 3D orb sphere center. The orb group is at world [0, -4.6, 0].
// Camera: position [0, 1.5, 15], fov 56. The sphere projects to roughly
// bottom: 228px from viewport bottom on a 1080px screen.
// The CSS rings are a separate fixed overlay centered on the same point.
// ---------------------------------------------------------------------------
export default function InvestigationOrb({ state }: Props) {
  const { isMuted, toggleMute } = useVoiceStore()
  const config = STATE_CONFIG[state] || STATE_CONFIG.idle
  const c = config.core

  return (
    <>
      {/* CSS rings — fixed overlay, centered on the 3D orb position */}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 256,
          height: 256,
          pointerEvents: 'none',
          zIndex: 22,
          mixBlendMode: 'screen',
        }}
      >
        {/* Ring A */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${c}40`, boxShadow: `0 0 35px ${c}15, inset 0 0 25px ${c}10`, animation: 'ring1Spin 25s linear infinite' }} />
        {/* Ring B */}
        <div style={{ position: 'absolute', top: '5%', left: '5%', right: '5%', bottom: '5%', borderRadius: '50%', border: `1px dashed ${config.r2}35`, animation: 'ring2Spin 18s linear infinite reverse' }} />
        {/* Ring C */}
        <div style={{ position: 'absolute', top: '-3%', left: '-3%', right: '-3%', bottom: '-3%', borderRadius: '50%', border: `1px solid ${config.r1}20`, boxShadow: `0 0 50px ${c}10`, animation: 'ring3Spin 40s linear infinite' }} />
        {/* Reflection pool */}
        <div style={{ position: 'absolute', bottom: -10, left: '16%', right: '16%', height: 20, borderRadius: '50%', filter: 'blur(16px)', opacity: 0.7, background: `radial-gradient(ellipse at center, ${c}A0 0%, transparent 75%)`, animation: 'poolPulse 4s ease-in-out infinite' }} />
      </div>

      {/* Mic button — fixed at the center of the 3D orb sphere on screen */}
      <button
        onClick={toggleMute}
        style={{
          position: 'fixed',
          bottom: 120,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 30,
          width: 64,
          height: 64,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1px solid ${isMuted ? '#EF444475' : `${c}60`}`,
          background: isMuted ? 'rgba(239,68,68,0.15)' : 'rgba(1,4,18,0.72)',
          boxShadow: isMuted ? '0 0 30px rgba(239,68,68,0.25)' : `0 0 25px ${c}25, inset 0 1px 0 rgba(255,255,255,0.1)`,
          animation: isMuted ? 'none' : 'micIdle 4s ease-in-out infinite',
          cursor: 'pointer',
          pointerEvents: 'auto',
          transition: 'all 0.3s ease',
        }}
      >
        {isMuted
          ? <MicOff style={{ width: 24, height: 24, color: '#f87171' }} />
          : <Mic style={{ width: 24, height: 24, color: c }} />
        }
      </button>

      <style>{`
        @keyframes ring1Spin {
          0%   { transform: rotateX(65deg) rotateZ(0deg); }
          100% { transform: rotateX(65deg) rotateZ(360deg); }
        }
        @keyframes ring2Spin {
          0%   { transform: rotateX(55deg) rotateZ(0deg); }
          100% { transform: rotateX(55deg) rotateZ(360deg); }
        }
        @keyframes ring3Spin {
          0%   { transform: rotateX(70deg) rotateZ(360deg); }
          100% { transform: rotateX(70deg) rotateZ(0deg); }
        }
        @keyframes poolPulse {
          0%, 100% { opacity: 0.5; transform: scaleX(1); }
          50%       { opacity: 0.85; transform: scaleX(1.2); }
        }
        @keyframes micIdle {
          0%, 100% { box-shadow: 0 0 20px ${c}20, inset 0 0 10px ${c}10; }
          50%       { box-shadow: 0 0 35px ${c}45, inset 0 0 16px ${c}20; }
        }
      `}</style>
    </>
  )
}
