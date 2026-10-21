import { useEffect, useRef } from "react";
import type { CompositionResult } from "@framesense/core";

export interface ViewfinderProps {
  readonly videoRef: React.RefObject<HTMLVideoElement | null>;
  readonly composition: CompositionResult | null;
  readonly showGrid?: boolean;
}

export function Viewfinder({ videoRef, composition, showGrid = true }: ViewfinderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animId: number;

    const renderOverlay = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) {
        animId = requestAnimationFrame(renderOverlay);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animId = requestAnimationFrame(renderOverlay);
        return;
      }

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // 1. Draw Rule of Thirds Grid if enabled
      if (showGrid) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
        ctx.lineWidth = 1;

        // Vertical third lines
        ctx.beginPath();
        ctx.moveTo(W * (1 / 3), 0);
        ctx.lineTo(W * (1 / 3), H);
        ctx.moveTo(W * (2 / 3), 0);
        ctx.lineTo(W * (2 / 3), H);

        // Horizontal third lines
        ctx.moveTo(0, H * (1 / 3));
        ctx.lineTo(W, H * (1 / 3));
        ctx.moveTo(0, H * (2 / 3));
        ctx.lineTo(W, H * (2 / 3));
        ctx.stroke();

        // 4 Power Points (circle reticles)
        const powerPoints = [
          { x: W * (1 / 3), y: H * (1 / 3) },
          { x: W * (2 / 3), y: H * (1 / 3) },
          { x: W * (1 / 3), y: H * (2 / 3) },
          { x: W * (2 / 3), y: H * (2 / 3) },
        ];

        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        for (const pt of powerPoints) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2. Draw Headroom Indicator Bracket at top (8% to 22% zone)
      ctx.strokeStyle = "rgba(46, 213, 115, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(W * 0.25, H * 0.08);
      ctx.lineTo(W * 0.75, H * 0.08);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Draw Horizon Level Bar
      const horizonMetric = composition?.metrics.find((m) => m.type === "HORIZON_ALIGNMENT");
      const isHorizonLevel = horizonMetric ? horizonMetric.score >= 90 : true;

      ctx.save();
      ctx.translate(W / 2, H / 2);
      // Small tilt visualization
      const angleDeg = horizonMetric?.errorMagnitude ?? 0;
      const angleRad = (angleDeg * Math.PI) / 180;
      ctx.rotate(angleRad);

      ctx.strokeStyle = isHorizonLevel ? "rgba(46, 213, 115, 0.7)" : "rgba(255, 171, 0, 0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-W * 0.18, 0);
      ctx.lineTo(-W * 0.06, 0);
      ctx.moveTo(W * 0.06, 0);
      ctx.lineTo(W * 0.18, 0);
      ctx.stroke();

      // Horizon level center notch
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = isHorizonLevel ? "#2ed573" : "#ffab00";
      ctx.fill();
      ctx.restore();

      animId = requestAnimationFrame(renderOverlay);
    };

    animId = requestAnimationFrame(renderOverlay);
    return () => cancelAnimationFrame(animId);
  }, [composition, showGrid, videoRef]);

  return (
    <div className="viewfinder-container">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="viewfinder-video"
      />
      <canvas ref={canvasRef} className="viewfinder-overlay" />
    </div>
  );
}
