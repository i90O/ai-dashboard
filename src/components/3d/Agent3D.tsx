'use client'
import { memo, useRef, useState } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

interface Agent3DProps {
  id: string
  name: string
  color: string
  position: [number, number, number]
  status: 'idle' | 'thinking' | 'working' | 'talking'
  thought?: string
  isSelected?: boolean
  onSelect?: (id: string) => void
}

const Agent3D = memo(({ 
  id, 
  name, 
  color, 
  position, 
  status, 
  thought,
  isSelected = false,
  onSelect
}: Agent3DProps) => {
  const groupRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<THREE.Mesh>(null)
  const leftArmRef = useRef<THREE.Mesh>(null)
  const rightArmRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  
  const breathCycle = useRef(0)
  const workCycle = useRef(0)
  
  useFrame((state) => {
    if (!groupRef.current) return
    
    // Idle breathing animation
    breathCycle.current += 0.02
    if (bodyRef.current) {
      bodyRef.current.position.y = 0.65 + Math.sin(breathCycle.current) * 0.015
    }
    
    // Working/thinking arm animation
    if (status === 'working' || status === 'thinking') {
      workCycle.current += 0.08
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = Math.sin(workCycle.current) * 0.3
      }
    }
    
    // Talking head bob
    if (status === 'talking') {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 3) * 0.1
    }
  })
  
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect?.(id)
  }
  
  const getStatusColor = () => {
    switch (status) {
      case 'working': return '#22c55e'
      case 'thinking': return '#f59e0b'
      case 'talking': return '#3b82f6'
      default: return '#64748b'
    }
  }
  
  const skinColor = '#e0c4a8'
  
  return (
    <group ref={groupRef} position={position}>
      {/* Clickable hitbox */}
      <mesh 
        position={[0, 0.8, 0]}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <cylinderGeometry args={[0.5, 0.5, 1.6, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      
      {/* Ground shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.6, 32]} />
        <meshBasicMaterial 
          color={isSelected ? color : getStatusColor()} 
          transparent 
          opacity={isSelected ? 0.6 : 0.3} 
        />
      </mesh>
      
      {/* Status ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.5, 0.65, 32]} />
        <meshBasicMaterial 
          color={isSelected ? '#fff' : getStatusColor()} 
          transparent 
          opacity={isSelected ? 1 : 0.7} 
        />
      </mesh>
      
      {/* Legs */}
      <mesh position={[-0.12, 0.25, 0]} castShadow>
        <boxGeometry args={[0.12, 0.4, 0.12]} />
        <meshStandardMaterial color="#1e3a5f" />
      </mesh>
      <mesh position={[0.12, 0.25, 0]} castShadow>
        <boxGeometry args={[0.12, 0.4, 0.12]} />
        <meshStandardMaterial color="#1e3a5f" />
      </mesh>
      
      {/* Body */}
      <mesh ref={bodyRef} position={[0, 0.65, 0]} castShadow>
        <boxGeometry args={[0.4, 0.45, 0.22]} />
        <meshStandardMaterial 
          color={hovered || isSelected ? '#22d3ee' : color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.4 : (status !== 'idle' ? 0.2 : 0.05)}
        />
      </mesh>
      
      {/* Arms */}
      <mesh ref={leftArmRef} position={[-0.28, 0.65, 0]} castShadow>
        <boxGeometry args={[0.1, 0.35, 0.1]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh ref={rightArmRef} position={[0.28, 0.65, 0]} castShadow>
        <boxGeometry args={[0.1, 0.35, 0.1]} />
        <meshStandardMaterial color={color} />
      </mesh>
      
      {/* Head */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>
      
      {/* Hair */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <sphereGeometry args={[0.14, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#2d1810" />
      </mesh>
      
      {/* Thought bubble */}
      {thought && (
        <Html position={[0, 1.6, 0]} center distanceFactor={8}>
          <div 
            className="px-3 py-2 rounded-xl whitespace-nowrap text-center pointer-events-none"
            style={{
              backgroundColor: isSelected ? color : `${color}ee`,
              color: 'white',
              fontSize: '11px',
              fontWeight: 'bold',
              border: isSelected ? '2px solid white' : '1px solid rgba(255,255,255,0.4)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              maxWidth: '180px',
              textOverflow: 'ellipsis',
              overflow: 'hidden'
            }}
          >
            {thought}
          </div>
        </Html>
      )}
      
      {/* Name badge */}
      <Html position={[0, 1.35, 0]} center distanceFactor={10}>
        <div 
          className="px-2 py-1 rounded-lg font-bold text-center pointer-events-none"
          style={{
            backgroundColor: color,
            color: 'white',
            fontSize: '10px',
            border: isSelected ? '2px solid white' : '1px solid rgba(255,255,255,0.5)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
          }}
        >
          {name}
        </div>
      </Html>
      
      {/* Point light for glow */}
      <pointLight 
        position={[0, 1.2, 0]} 
        intensity={isSelected ? 0.6 : 0.3} 
        distance={4} 
        color={getStatusColor()} 
      />
    </group>
  )
})

Agent3D.displayName = 'Agent3D'
export default Agent3D
