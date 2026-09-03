// This file is intentionally NOT "use client" marked at top
// It exports a component that uses react-force-graph directly
import { useEffect, useRef, useCallback } from "react";
import { ForceGraph3D } from "react-force-graph";

interface Props {
  graphData: { nodes: any[]; links: any[] };
  width: number;
  height: number;
  bgColor: string;
  onNodeClick: (n: any) => void;
  fgRef: any;
  nodeColor: (n: any) => string;
  nodeVal: (n: any) => number;
  nodeLabel: (n: any) => string;
}

export function GraphInner({ graphData, width, height, bgColor, onNodeClick, fgRef, nodeColor, nodeVal, nodeLabel }: Props) {
  return (
    <ForceGraph3D
      ref={fgRef}
      graphData={graphData}
      width={width}
      height={height}
      backgroundColor={bgColor}
      nodeLabel={nodeLabel}
      nodeColor={nodeColor}
      nodeVal={nodeVal}
      linkColor={() => "rgba(106,143,255,0.3)"}
      linkWidth={1.5}
      linkOpacity={0.5}
      nodeResolution={16}
      onNodeClick={onNodeClick}
      onBackgroundClick={() => onNodeClick(null)}
      enableNodeDrag={true}
      enableNavigationControls={true}
      showNavInfo={false}
      d3AlphaDecay={0.02}
      d3VelocityDecay={0.3}
    />
  );
}
