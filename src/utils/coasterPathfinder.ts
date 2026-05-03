import type { TrackPieceType } from '../types';

interface StateNode {
    x: number;
    z: number;
    h: number;
    rot: number;
    g: number;
    h_cost: number;
    f: number;
    parent: StateNode | null;
    action: { type: TrackPieceType, rotation: number, slopeAngle: number } | null;
}

export function findCoasterClosurePath(
    startX: number, startZ: number, startH: number,
    targetX: number, targetZ: number, targetH: number, targetRot: number
): { type: TrackPieceType, rotation: number, slopeAngle: number }[] | null {
    
    // We want to find a path from (startX, startZ, startH) to (targetX, targetZ, targetH).
    // The target is actually 1 step BEFORE (targetX, targetZ) because placing a piece 
    // at (x,z) means the NEXT piece is at (targetX, targetZ).
    // Let's frame it as: placing pieces until the NEXT position would be (targetX, targetZ) and height matches.

    const openList: StateNode[] = [];
    const closedSet = new Set<string>();

    const startNode: StateNode = {
        x: startX,
        z: startZ,
        h: startH,
        rot: targetRot, // initial rotation is the rotation of the LAST placed piece
        g: 0,
        h_cost: 0,
        f: 0,
        parent: null,
        action: null
    };

    openList.push(startNode);

    const getStateKey = (n: StateNode) => `${n.x},${n.z},${n.h},${n.rot}`;

    let iterations = 0;
    const MAX_ITERATIONS = 12000;

    while (openList.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;
        
        // Find node with lowest f
        let lowestIdx = 0;
        for (let i = 1; i < openList.length; i++) {
            if (openList[i].f < openList[lowestIdx].f) {
                lowestIdx = i;
            }
        }
        
        const current = openList[lowestIdx];
        openList.splice(lowestIdx, 1);
        
        // Goal check: The NEXT position from `current` matches targetX, targetZ, AND current height == targetH
        const rad = (current.rot * Math.PI) / 180;
        const nx = current.x + Math.round(Math.sin(rad)) * 2;
        const nz = current.z + Math.round(Math.cos(rad)) * 2;
        
        if (nx === targetX && nz === targetZ && current.h === targetH) {
            // Found path
            const path: { type: TrackPieceType, rotation: number, slopeAngle: number }[] = [];
            let curr: StateNode | null = current;
            while (curr && curr.action) {
                path.unshift(curr.action);
                curr = curr.parent;
            }
            return path;
        }

        closedSet.add(getStateKey(current));

        // Generate successors
        // The rotation for the NEXT piece can be current.rot, current.rot - 90, or current.rot + 90
        const possibleRots = [
            current.rot,
            (current.rot - 90 + 360) % 360,
            (current.rot + 90) % 360
        ];

        for (const nextRot of possibleRots) {
            const rRad = (current.rot * Math.PI) / 180;
            const nextX = current.x + Math.round(Math.sin(rRad)) * 2;
            const nextZ = current.z + Math.round(Math.cos(rRad)) * 2;
            
            const types: TrackPieceType[] = ['straight', 'climb', 'dive', 'vertical_climb', 'vertical_dive']; 
            
            for (const type of types) {
                let nextH = current.h;
                if (type === 'climb') nextH += 1;
                else if (type === 'dive') nextH = Math.max(0, nextH - 1);
                else if (type === 'vertical_climb') nextH += 4;
                else if (type === 'vertical_dive') nextH = Math.max(0, nextH - 4);

                if (nextH < 0 || nextH > 50) continue;

                // Penalize turning + climbing/diving at same time to make nicer tracks
                let turnPenalty = (nextRot !== current.rot) ? 1 : 0;
                let elevationPenalty = (type !== 'straight') ? 1 : 0;
                
                const g = current.g + 1 + turnPenalty + elevationPenalty * 0.5;
                const dx = Math.abs(targetX - nextX);
                const dz = Math.abs(targetZ - nextZ);
                const dh = Math.abs(targetH - nextH);
                // Weighted heuristic: height costs are more expensive (4x for vertical)
                const h_cost = (dx + dz) / 2 + dh * 1.5;
                
                const neighbor: StateNode = {
                    x: nextX,
                    z: nextZ,
                    h: nextH,
                    rot: nextRot,
                    g,
                    h_cost,
                    f: g + h_cost,
                    parent: current,
                    action: { type, rotation: nextRot, slopeAngle: 0 }
                };

                const key = getStateKey(neighbor);
                if (closedSet.has(key)) continue;

                // Check if in open list with lower g
                const existing = openList.find(n => getStateKey(n) === key);
                if (existing) {
                    if (g < existing.g) {
                        existing.g = g;
                        existing.f = g + existing.h_cost;
                        existing.parent = current;
                        existing.action = neighbor.action;
                    }
                } else {
                    openList.push(neighbor);
                }
            }
        }
    }

    return null; // No path found
}
