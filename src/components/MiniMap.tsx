import React, { useEffect, useRef, useState } from 'react';
import { useParkState } from '../store/useParkState';
import './MiniMap.css';

/**
 * MiniMap – a simple 2D overview of the park.
 * Renders a scaled-down grid with facility and visitor markers.
 * Clicking on a marker selects the corresponding entity.
 */
export const MiniMap: React.FC = () => {
  const facilities = useParkState(state => state.facilities);
  const visitors = useParkState(state => state.visitors);
  const roads = useParkState(state => state.roads);
  const selectFacility = useParkState(state => state.selectFacility);
  const selectVisitor = useParkState(state => state.selectVisitor);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const MAP_SIZE = 150; // px
  const GRID_SIZE = 64; // assume current grid size (could be from game state)

  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const handleRotate = (e: any) => {
      // Default alpha is -Math.PI / 2 (looking north). Offset to make it 0.
      setRotation(e.detail.alpha + Math.PI / 2);
    };
    window.addEventListener('onCameraRotate', handleRotate);
    return () => window.removeEventListener('onCameraRotate', handleRotate);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Clear
    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    // Draw background
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    // Draw roads
    ctx.fillStyle = '#555';
    roads.forEach(r => {
      const x = (r.x / GRID_SIZE) * MAP_SIZE;
      const z = (r.z / GRID_SIZE) * MAP_SIZE;
      ctx.fillRect(x, z, 2, 2);
    });
    // Draw facilities
    ctx.fillStyle = '#0f0';
    facilities.forEach(f => {
      const x = (f.x / GRID_SIZE) * MAP_SIZE;
      const z = (f.z / GRID_SIZE) * MAP_SIZE;
      ctx.fillRect(x, z, 3, 3);
    });
    // Draw visitors
    ctx.fillStyle = '#ff0';
    Object.values(visitors).forEach(v => {
      if (v && v.pos) {
        const x = (v.pos.x / GRID_SIZE) * MAP_SIZE;
        const z = (v.pos.z / GRID_SIZE) * MAP_SIZE;
        ctx.fillRect(x, z, 2, 2);
      }
    });
  }, [facilities, visitors, roads]);

  // Hit detection using local unrotated offsetX/Y
  const handleClick = (e: React.MouseEvent) => {
    const clickX = e.nativeEvent.offsetX;
    const clickZ = e.nativeEvent.offsetY;
    const scale = GRID_SIZE / MAP_SIZE;
    const worldX = Math.floor(clickX * scale);
    const worldZ = Math.floor(clickZ * scale);
    // Find nearest facility within 2 cells
    const facility = facilities.find(f => Math.abs(f.x - worldX) <= 2 && Math.abs(f.z - worldZ) <= 2);
    if (facility) {
      selectFacility(facility.instanceId);
      return;
    }
    // Find nearest visitor
    const visitor = Object.values(visitors).find(v => v.pos && Math.abs(v.pos.x - worldX) <= 2 && Math.abs(v.pos.z - worldZ) <= 2);
    if (visitor) {
      selectVisitor(visitor.id);
    }
  };

  return (
    <div style={{
      width: MAP_SIZE, height: MAP_SIZE,
      borderRadius: '50%',
      overflow: 'hidden',
      border: '3px solid rgba(255, 255, 255, 0.4)',
      boxShadow: '0 0 15px rgba(0,0,0,0.5)',
      backgroundColor: '#222'
    }}>
      <canvas
        ref={canvasRef}
        width={MAP_SIZE}
        height={MAP_SIZE}
        className="mini-map"
        onClick={handleClick}
        style={{ 
            transform: `rotate(${rotation}rad)`, 
            transformOrigin: '50% 50%',
            transition: 'transform 0.05s linear'
        }}
      />
    </div>
  );
};
