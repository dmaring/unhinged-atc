import { useRef, useEffect, useState } from 'react';
import { Aircraft, RADAR_CONFIG, Airport, GameEvent } from 'shared';
import styles from './RadarDisplay.module.css';

interface RadarDisplayProps {
  aircraft: Aircraft[];
  airports?: Airport[];
  events?: GameEvent[];
  selectedAircraftId?: string | null;
  onAircraftSelect?: (id: string) => void;
}

export function RadarDisplay({
  aircraft,
  airports = [],
  events = [],
  selectedAircraftId,
  onAircraftSelect,
}: RadarDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const aircraftRef = useRef<Aircraft[]>(aircraft);
  const airportsRef = useRef<Airport[]>(airports);
  const eventsRef = useRef<GameEvent[]>(events);
  const selectedIdRef = useRef<string | null>(selectedAircraftId || null);

  // Keep refs updated
  useEffect(() => {
    aircraftRef.current = aircraft;
  }, [aircraft]);

  useEffect(() => {
    airportsRef.current = airports;
  }, [airports]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    selectedIdRef.current = selectedAircraftId || null;
  }, [selectedAircraftId]);

  // Handle canvas resize
  useEffect(() => {
    const updateSize = () => {
      if (canvasRef.current?.parentElement) {
        const parent = canvasRef.current.parentElement;
        setCanvasSize({
          width: parent.clientWidth,
          height: parent.clientHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Continuous render loop using requestAnimationFrame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      // Set canvas size
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;

      // Clear canvas
      ctx.fillStyle = RADAR_CONFIG.BACKGROUND_COLOR;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw range rings
      drawRangeRings(ctx, canvas.width, canvas.height);

      // Draw center cross
      drawCenterCross(ctx, canvas.width, canvas.height);

      // Draw airports
      const currentAirports = airportsRef.current;
      if (currentAirports.length > 0) {
        currentAirports.forEach((airport) => {
          drawAirport(ctx, airport, canvas.width, canvas.height);
        });
      }

      // Get conflict aircraft IDs from recent events
      const currentEvents = eventsRef.current;
      const conflictAircraftIds = new Set<string>();
      currentEvents
        .filter((e) => e.type === 'near_miss' || e.type === 'conflict_detected' || e.type === 'collision')
        .forEach((e) => e.aircraftIds.forEach((id) => conflictAircraftIds.add(id)));

      // Draw aircraft using refs (so we always get the latest data)
      const currentAircraft = aircraftRef.current;
      if (currentAircraft.length > 0) {
        console.log('[Render] Drawing', currentAircraft.length, 'aircraft');
        currentAircraft.forEach((ac, idx) => {
          console.log(`[Render] Aircraft ${idx}:`, ac.callsign, 'at', ac.position);
          const isInConflict = conflictAircraftIds.has(ac.id);
          drawAircraft(
            ctx,
            ac,
            canvas.width,
            canvas.height,
            selectedIdRef.current === ac.id,
            isInConflict
          );
        });
      }

      // Continue the loop
      animationFrameId = requestAnimationFrame(render);
    };

    // Start the render loop
    animationFrameId = requestAnimationFrame(render);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [canvasSize]); // Only restart when canvas size changes

  // Handle click
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onAircraftSelect || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if click is near any aircraft (use ref to get current data)
    for (const ac of aircraftRef.current) {
      const screenPos = worldToScreen(ac.position, canvas.width, canvas.height);
      const dist = Math.sqrt((x - screenPos.x) ** 2 + (y - screenPos.y) ** 2);

      if (dist < 15) { // Click tolerance
        onAircraftSelect(ac.id);
        return;
      }
    }

    // Click on empty space deselects
    onAircraftSelect('');
  };

  return (
    <div className={styles.radar}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onClick={handleClick}
      />
      <div className={styles.info}>
        <div>RADAR RANGE: {RADAR_CONFIG.RANGE_RINGS[2]} NM</div>
        <div>AIRCRAFT: {aircraftRef.current.length}</div>
      </div>
      <div className={styles.compass}>
        <div className={`${styles.compassLabel} ${styles.compassN}`}>N</div>
        <div className={`${styles.compassLabel} ${styles.compassE}`}>E</div>
        <div className={`${styles.compassLabel} ${styles.compassS}`}>S</div>
        <div className={`${styles.compassLabel} ${styles.compassW}`}>W</div>
      </div>
    </div>
  );
}

// Helper functions

function worldToScreen(
  worldPos: { x: number; y: number },
  width: number,
  height: number
): { x: number; y: number } {
  // Simple mapping: world coordinates to screen coordinates
  // Assuming world is centered at (0,0) and ranges from -20 to 20 NM
  const scale = Math.min(width, height) / 40; // 40 NM total range
  return {
    x: width / 2 + worldPos.x * scale,
    y: height / 2 - worldPos.y * scale, // Invert Y for screen coordinates
  };
}

function drawRangeRings(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const scale = Math.min(width, height) / 40;

  ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
  ctx.lineWidth = 1;

  RADAR_CONFIG.RANGE_RINGS.forEach((range) => {
    const radius = range * scale;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw range label
    ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.fillText(`${range}NM`, centerX + radius - 25, centerY - 5);
  });
}

function drawCenterCross(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const size = 10;

  ctx.strokeStyle = RADAR_CONFIG.PRIMARY_COLOR;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(centerX - size, centerY);
  ctx.lineTo(centerX + size, centerY);
  ctx.moveTo(centerX, centerY - size);
  ctx.lineTo(centerX, centerY + size);
  ctx.stroke();
}

function drawAirport(
  ctx: CanvasRenderingContext2D,
  airport: Airport,
  width: number,
  height: number
) {
  const screenPos = worldToScreen(airport.position, width, height);

  // Draw airport symbol (square with cross)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;

  const size = 8;
  ctx.fillRect(screenPos.x - size, screenPos.y - size, size * 2, size * 2);
  ctx.strokeRect(screenPos.x - size, screenPos.y - size, size * 2, size * 2);

  // Draw runways
  airport.runways.forEach((runway) => {
    const runwayScreenPos = worldToScreen(runway.position, width, height);
    ctx.save();
    ctx.translate(runwayScreenPos.x, runwayScreenPos.y);
    ctx.rotate((runway.heading * Math.PI) / 180);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 6);
    ctx.stroke();

    ctx.restore();
  });

  // Draw airport code
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = '11px "Share Tech Mono", monospace';
  ctx.fillText(airport.code, screenPos.x + 12, screenPos.y + 4);
}

function drawAircraft(
  ctx: CanvasRenderingContext2D,
  aircraft: Aircraft,
  width: number,
  height: number,
  isSelected: boolean,
  isInConflict: boolean
) {
  const screenPos = worldToScreen(aircraft.position, width, height);

  // Determine color based on state
  let aircraftColor: string = RADAR_CONFIG.PRIMARY_COLOR;
  if (aircraft.hasCollided) {
    aircraftColor = '#FF0000';
  } else if (isSelected) {
    aircraftColor = '#00FFFF';
  } else if (isInConflict) {
    aircraftColor = '#FFAA00'; // Orange for conflicts
  } else if (aircraft.flightPhase === 'approach' || aircraft.flightPhase === 'landing') {
    aircraftColor = '#FFD700'; // Gold for approaching aircraft
  } else if (aircraft.fuel < 30) {
    aircraftColor = '#FF6600'; // Orange-red for low fuel
  }

  // Draw trail
  if (aircraft.trailHistory.length > 1) {
    ctx.strokeStyle = `rgba(0, 255, 0, ${RADAR_CONFIG.TRAIL_OPACITY})`;
    ctx.lineWidth = 1;
    ctx.beginPath();

    aircraft.trailHistory.forEach((pos, i) => {
      const trailPos = worldToScreen(pos, width, height);
      if (i === 0) {
        ctx.moveTo(trailPos.x, trailPos.y);
      } else {
        ctx.lineTo(trailPos.x, trailPos.y);
      }
    });
    ctx.stroke();
  }

  // Draw conflict warning circle
  if (isInConflict && !aircraft.hasCollided) {
    ctx.strokeStyle = '#FFAA00';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, 25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw aircraft icon (triangle)
  ctx.save();
  ctx.translate(screenPos.x, screenPos.y);
  // Aviation heading: 0° = North, 90° = East, 180° = South, 270° = West
  // Triangle nose points up (0, -size), so rotation matches heading directly
  ctx.rotate((aircraft.heading * Math.PI) / 180);

  const size = RADAR_CONFIG.AIRCRAFT_SIZE;
  ctx.fillStyle = aircraftColor;

  ctx.beginPath();
  ctx.moveTo(0, -size); // Nose
  ctx.lineTo(-size * 0.6, size); // Left wing
  ctx.lineTo(size * 0.6, size); // Right wing
  ctx.closePath();
  ctx.fill();

  // Draw selection circle
  if (isSelected) {
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  // Draw callsign and data tag
  ctx.fillStyle = aircraftColor;
  ctx.font = '11px "Share Tech Mono", monospace';
  ctx.fillText(aircraft.callsign, screenPos.x + 12, screenPos.y - 5);

  ctx.font = '10px "Share Tech Mono", monospace';
  ctx.fillText(
    `FL${Math.round(aircraft.altitude / 100).toString().padStart(3, '0')}`,
    screenPos.x + 12,
    screenPos.y + 7
  );

  // Draw phase indicator
  let yOffset = 18;
  if (aircraft.flightPhase === 'approach') {
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 9px "Share Tech Mono", monospace';
    ctx.fillText('APPR', screenPos.x + 12, screenPos.y + yOffset);
    yOffset += 11;
  }

  // Draw emergency indicator
  if (aircraft.emergencyType === 'fuel') {
    ctx.fillStyle = '#FF0000';
    ctx.font = 'bold 10px "Share Tech Mono", monospace';
    ctx.fillText(`FUEL ${aircraft.fuel.toFixed(0)}%`, screenPos.x + 12, screenPos.y + yOffset);
    yOffset += 11;
  } else if (aircraft.emergencyType) {
    ctx.fillStyle = '#FF0000';
    ctx.font = 'bold 10px "Share Tech Mono", monospace';
    ctx.fillText('EMERG', screenPos.x + 12, screenPos.y + yOffset);
    yOffset += 11;
  } else if (aircraft.fuel < 30) {
    ctx.fillStyle = '#FF6600';
    ctx.font = '9px "Share Tech Mono", monospace';
    ctx.fillText(`${aircraft.fuel.toFixed(0)}%`, screenPos.x + 12, screenPos.y + yOffset);
  }
}
