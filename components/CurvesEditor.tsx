
import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';

interface Point {
  x: number;
  y: number;
}

interface CurvesEditorProps {
  onUpdate: (lut: number[]) => void;
  color?: string;
}

const CurvesEditor: React.FC<CurvesEditorProps> = ({ onUpdate, color = '#6366f1' }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [points, setPoints] = useState<Point[]>([
    { x: 0, y: 0 },
    { x: 255, y: 255 }
  ]);

  const width = 200;
  const height = 200;
  const margin = 10;

  const scaleX = useMemo(() => d3.scaleLinear().domain([0, 255]).range([margin, width - margin]), []);
  const scaleY = useMemo(() => d3.scaleLinear().domain([0, 255]).range([height - margin, margin]), []);

  const lineGenerator = d3.line<Point>()
    .x(d => scaleX(d.x))
    .y(d => scaleY(d.y))
    .curve(d3.curveMonotoneX);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Draw Grid
    const gridLines = [0, 64, 128, 192, 255];
    svg.append('g')
      .attr('class', 'grid')
      .selectAll('line.horizontal')
      .data(gridLines)
      .enter()
      .append('line')
      .attr('x1', margin)
      .attr('x2', width - margin)
      .attr('y1', d => scaleY(d))
      .attr('y2', d => scaleY(d))
      .attr('stroke', 'rgba(255,255,255,0.1)')
      .attr('stroke-width', 1);

    svg.append('g')
      .attr('class', 'grid')
      .selectAll('line.vertical')
      .data(gridLines)
      .enter()
      .append('line')
      .attr('y1', margin)
      .attr('y2', height - margin)
      .attr('x1', d => scaleX(d))
      .attr('x2', d => scaleX(d))
      .attr('stroke', 'rgba(255,255,255,0.1)')
      .attr('stroke-width', 1);

    // Draw Curve
    const sortedPoints = [...points].sort((a, b) => a.x - b.x);
    svg.append('path')
      .datum(sortedPoints)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('d', lineGenerator as any);

    // Draw Points
    svg.selectAll('circle')
      .data(points)
      .enter()
      .append('circle')
      .attr('cx', d => scaleX(d.x))
      .attr('cy', d => scaleY(d.y))
      .attr('r', 6)
      .attr('fill', color)
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer')
      .on('dblclick', (event, d) => {
        // Delete point on double click (except start/end)
        if (d.x !== 0 && d.x !== 255) {
          event.stopPropagation();
          setPoints(prev => prev.filter(p => p !== d));
        }
      })
      .call(d3.drag<SVGCircleElement, Point>()
        .on('drag', (event, d) => {
          let newX = scaleX.invert(event.x);
          let newY = scaleY.invert(event.y);
          
          // Snapping logic (snap to 16 unit grid)
          const snapSize = 16;
          if (Math.abs(newX - Math.round(newX / snapSize) * snapSize) < 8) {
            newX = Math.round(newX / snapSize) * snapSize;
          }
          if (Math.abs(newY - Math.round(newY / snapSize) * snapSize) < 8) {
            newY = Math.round(newY / snapSize) * snapSize;
          }

          newX = Math.max(0, Math.min(255, newX));
          newY = Math.max(0, Math.min(255, newY));
          
          const isStart = d.x === 0;
          const isEnd = d.x === 255;

          setPoints(prev => {
            const next = [...prev];
            const idx = prev.indexOf(d);
            if (idx === -1) return prev;
            
            // Ensure points don't cross each other horizontally
            const prevPoint = next[idx - 1];
            const nextPoint = next[idx + 1];
            
            let finalX = isStart || isEnd ? d.x : newX;
            if (prevPoint && finalX <= prevPoint.x) finalX = prevPoint.x + 1;
            if (nextPoint && finalX >= nextPoint.x) finalX = nextPoint.x - 1;

            next[idx] = { x: finalX, y: newY };
            return next;
          });
        })
      );

    // Add point on click
    svg.on('click', (event) => {
      if (event.defaultPrevented) return;
      const [mx, my] = d3.pointer(event);
      const px = scaleX.invert(mx);
      const py = scaleY.invert(my);
      
      // Check if clicking near existing point
      const threshold = 10;
      const nearPoint = points.find(p => Math.abs(scaleX(p.x) - mx) < threshold && Math.abs(scaleY(p.y) - my) < threshold);
      
      if (!nearPoint) {
        setPoints(prev => [...prev, { x: px, y: py }].sort((a, b) => a.x - b.x));
      }
    });

    // Calculate LUT
    const lut = calculateLUT(sortedPoints);
    onUpdate(lut);

  }, [points, color]);

  const calculateLUT = (sortedPoints: Point[]) => {
    const lut = new Array(256);
    const spline = d3.scaleLinear()
      .domain(sortedPoints.map(p => p.x))
      .range(sortedPoints.map(p => p.y));
    
    // For more accurate curves, we could use a monotonic spline interpolator
    // but d3.scaleLinear with many points or a custom interpolator is easier.
    // Let's use d3.curveMonotoneX logic for the LUT
    
    // Simple implementation for now:
    for (let i = 0; i < 256; i++) {
      lut[i] = Math.max(0, Math.min(255, spline(i)));
    }
    return lut;
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <svg 
        ref={svgRef} 
        width={width} 
        height={height} 
        className="bg-black/40 rounded-xl border border-white/10 cursor-crosshair"
      />
      <button 
        onClick={() => setPoints([{ x: 0, y: 0 }, { x: 255, y: 255 }])}
        className="text-[9px] font-black uppercase text-gray-500 hover:text-white transition-colors"
      >
        Reset Curve
      </button>
    </div>
  );
};

export default CurvesEditor;
