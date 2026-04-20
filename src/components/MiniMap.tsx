import React, { useEffect, useRef } from 'react';
import { CONSTANTS } from '../config/constants';
import { useParkState } from '../store/useParkState';
import { useGameState } from '../store/useGameState';
import './MiniMap.css';

/**
 * MiniMap – a simple 2D overview of the park.
 * Renders a scaled-down grid with facility and visitor markers.
 * Clicking on a marker selects the corresponding entity.
 */
export const MiniMap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const MAP_SIZE = 150; // px

  useEffect(() => {
    const handleRotate = (e: any) => {
      if (canvasRef.current) {
        const r = e.detail.alpha + Math.PI / 2;
        canvasRef.current.style.transform = `scale(0.7) rotate(${r}rad)`;
      }
    };
    window.addEventListener('onCameraRotate', handleRotate);
    return () => window.removeEventListener('onCameraRotate', handleRotate);
  }, []);

  useEffect(() => {
    let animFrameId: number;

    const renderLoop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const gState = useGameState.getState();
      const pState = useParkState.getState();
      const GRID_SIZE = gState.gridSize || 64;

      ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

      ctx.fillStyle = '#555';
      pState.roads.forEach(r => {
        const x = (r.x / GRID_SIZE) * MAP_SIZE;
        const z = MAP_SIZE - (r.z / GRID_SIZE) * MAP_SIZE;
        ctx.fillRect(x, z, 2, 2);
      });

      ctx.fillStyle = '#0f0';
      pState.facilities.forEach(f => {
        const x = (f.x / GRID_SIZE) * MAP_SIZE;
        const z = MAP_SIZE - (f.z / GRID_SIZE) * MAP_SIZE;
        ctx.fillRect(x, z, 3, 3);
      });

      ctx.fillStyle = '#ff0';
      Object.values(pState.visitors).forEach(v => {
        if (v && v.pos) {
          const worldMaxX = GRID_SIZE * CONSTANTS.CELL_SIZE;
          const worldMaxZ = GRID_SIZE * CONSTANTS.CELL_SIZE;
          const x = (v.pos.x / worldMaxX) * MAP_SIZE;
          const z = MAP_SIZE - (v.pos.z / worldMaxZ) * MAP_SIZE;
          ctx.fillRect(x, z, 2, 2);
        }
      });

      animFrameId = requestAnimationFrame(renderLoop);
    };

    animFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animFrameId);
  }, []);

  // Hit detection using local unrotated offsetX/Y
  // Hit detection using local unrotated offsetX/Y
  const handleClick = (e: React.MouseEvent) => {
    const pState = useParkState.getState();
    const GRID_SIZE = useGameState.getState().gridSize || 64;

    const clickX = e.nativeEvent.offsetX;
    const clickZ = e.nativeEvent.offsetY;
    const scale = GRID_SIZE / MAP_SIZE;
    const worldX = Math.floor(clickX * scale);
    const worldZ = Math.floor((MAP_SIZE - clickZ) * scale); // Flip Z mapping back!
    
    // Find nearest facility within 2 cells
    const facility = pState.facilities.find(f => Math.abs(f.x - worldX) <= 2 && Math.abs(f.z - worldZ) <= 2);
    if (facility) {
      pState.selectFacility(facility.instanceId);
      return;
    }
    // Find nearest visitor (convert visitor world pos to grid coordinates first)
    const visitor = Object.values(pState.visitors).find(v => v.pos && Math.abs((v.pos.x / CONSTANTS.CELL_SIZE) - worldX) <= 2 && Math.abs((v.pos.z / CONSTANTS.CELL_SIZE) - worldZ) <= 2);
    if (visitor) {
      pState.selectVisitor(visitor.id);
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
            transform: `scale(0.7) rotate(0rad)`, 
            transformOrigin: '50% 50%',
            transition: 'transform 0.05s linear'
        }}
      />
    </div>
  );
};
