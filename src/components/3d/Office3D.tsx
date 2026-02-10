'use client'
import { Suspense, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, Html } from '@react-three/drei'
import Agent3D from './Agent3D'

interface AgentData {
  id: string
  name: string
  color: string
  position: [number, number, number]
  status: 'idle' | 'thinking' | 'working' | 'talking'
  thought?: string
}

interface Office3DProps {
  agents: AgentData[]
  selectedAgentId?: string
  onAgentSelect?: (id: string) => void
}

const Scene = ({ agents, selectedAgentId, onAgentSelect }: Office3DProps) => {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight 
        position={[10, 20, 10]} 
        intensity={0.8} 
        castShadow 
        shadow-mapSize={[2048, 2048]} 
      />
      <pointLight position={[-5, 8, 5]} intensity={0.3} color="#f59e0b" />
      <pointLight position={[5, 8, -5]} intensity={0.3} color="#22d3ee" />
      <Environment preset="studio" />
      
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#0f172a" metalness={0.1} roughness={0.9} />
      </mesh>
      
      {/* Grid */}
      <Grid 
        args={[30, 30]} 
        cellSize={2}
        cellThickness={0.5}
        cellColor="#1e293b"
        sectionSize={4}
        sectionThickness={1}
        sectionColor="#334155"
        fadeDistance={50}
        fadeStrength={1}
        followCamera={false}
        position={[0, 0.005, 0]}
      />
      
      {/* Office desks - 3 workstations */}
      {[-4, 0, 4].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          {/* Desk */}
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[2, 0.1, 1.2]} />
            <meshStandardMaterial color="#475569" metalness={0.4} roughness={0.6} />
          </mesh>
          {/* Desk legs */}
          <mesh position={[-0.8, 0.2, -0.4]} castShadow>
            <boxGeometry args={[0.08, 0.4, 0.08]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0.8, 0.2, -0.4]} castShadow>
            <boxGeometry args={[0.08, 0.4, 0.08]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[-0.8, 0.2, 0.4]} castShadow>
            <boxGeometry args={[0.08, 0.4, 0.08]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0.8, 0.2, 0.4]} castShadow>
            <boxGeometry args={[0.08, 0.4, 0.08]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          {/* Monitor */}
          <mesh position={[0, 0.75, -0.3]} castShadow>
            <boxGeometry args={[0.8, 0.5, 0.05]} />
            <meshStandardMaterial 
              color="#1e293b"
              emissive="#3b82f6"
              emissiveIntensity={0.3}
            />
          </mesh>
          {/* Monitor stand */}
          <mesh position={[0, 0.52, -0.3]} castShadow>
            <boxGeometry args={[0.1, 0.15, 0.1]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
        </group>
      ))}
      
      {/* Agents */}
      {agents.map((agent) => (
        <Agent3D
          key={agent.id}
          id={agent.id}
          name={agent.name}
          color={agent.color}
          position={agent.position}
          status={agent.status}
          thought={agent.thought}
          isSelected={selectedAgentId === agent.id}
          onSelect={onAgentSelect}
        />
      ))}
      
      {/* Camera controls */}
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={40}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
        target={[0, 0.5, 0]}
      />
    </>
  )
}

const LoadingFallback = () => (
  <Html center>
    <div className="bg-slate-800 px-6 py-4 rounded-xl text-white">
      🏭 Loading Office...
    </div>
  </Html>
)

export default function Office3D({ agents, selectedAgentId, onAgentSelect }: Office3DProps) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  if (!mounted) {
    return (
      <div className="w-full h-full bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading 3D Office...</div>
      </div>
    )
  }
  
  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        camera={{ position: [12, 10, 12], fov: 45 }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <Scene 
            agents={agents} 
            selectedAgentId={selectedAgentId}
            onAgentSelect={onAgentSelect}
          />
        </Suspense>
      </Canvas>
      
      {/* Overlay hints */}
      <div className="absolute bottom-4 left-4 text-slate-400 text-sm font-mono">
        <p>🖱️ Drag to rotate • Scroll to zoom • Click agent to select</p>
      </div>
    </div>
  )
}
