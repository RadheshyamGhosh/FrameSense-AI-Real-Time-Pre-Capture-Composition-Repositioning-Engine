import { useEffect, useRef } from "react";
import { computeAspectCropRect, type AspectRatioPreset } from "@framesense/camera";
import type { CompositionResult, FramingTemplate } from "@framesense/core";

export interface ViewfinderProps {
  readonly videoRef: React.RefObject<HTMLVideoElement | null>;
  readonly composition: CompositionResult | null;
  readonly showGrid?: boolean;
  readonly aspectRatio?: AspectRatioPreset;
  readonly template?: FramingTemplate;
  readonly digitalZoom?: number;
  readonly mirrorPreview?: boolean;
  readonly useSynthetic?: boolean;
  readonly syntheticPreset?: string;
}

export function Viewfinder({
  videoRef,
  composition,
  showGrid = true,
  aspectRatio = "VIEWPORT",
  template = "NONE",
  digitalZoom = 1,
  mirrorPreview = true,
  useSynthetic = false,
  syntheticPreset,
}: ViewfinderProps) {
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

      // Compute active crop rectangle for letterbox/pillarbox preview guides
      const guideRect =
        aspectRatio === "VIEWPORT"
          ? { sx: 0, sy: 0, sw: W, sh: H }
          : computeAspectCropRect(W, H, aspectRatio);

      // Render a calibrated synthetic preview backdrop when running Simulation Mode without live webcam pixels
      if (useSynthetic) {
        ctx.save();
        ctx.fillStyle = "#0b111b";
        ctx.fillRect(0, 0, W, H);
        const angleRad = ((composition?.horizonAngleDegrees ?? 0) * Math.PI) / 180;
        ctx.save();
        ctx.translate(W / 2, H * 0.52);
        ctx.rotate(angleRad);
        ctx.fillStyle = "rgba(30, 58, 95, 0.28)";
        ctx.fillRect(-W, 0, W * 2, H);
        ctx.restore();

        if (composition?.primarySubjectBounds) {
          const box = composition.primarySubjectBounds;
          const scx = guideRect.sx + (box.x + box.width / 2) * guideRect.sw;
          const scy = guideRect.sy + (box.y + box.height / 2) * guideRect.sh;
          const rx = Math.max(16, (box.width * guideRect.sw) / 2);
          const ry = Math.max(22, (box.height * guideRect.sh) / 2);
          ctx.fillStyle = "rgba(148, 163, 184, 0.18)";
          ctx.strokeStyle = "rgba(148, 163, 184, 0.45)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(scx, scy, rx * 0.78, ry * 0.9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        if (syntheticPreset) {
          ctx.fillStyle = "rgba(148, 163, 184, 0.55)";
          ctx.font = "600 11px sans-serif";
          ctx.fillText(`SIM SCENE: ${syntheticPreset}`, guideRect.sx + 14, guideRect.sy + guideRect.sh - 14);
        }
        ctx.restore();
      }

      if (aspectRatio !== "VIEWPORT" && guideRect.sw > 0 && guideRect.sh > 0) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        if (guideRect.sy > 0) {
          ctx.fillRect(0, 0, W, guideRect.sy);
          ctx.fillRect(0, guideRect.sy + guideRect.sh, W, H - (guideRect.sy + guideRect.sh));
        }
        if (guideRect.sx > 0) {
          ctx.fillRect(0, guideRect.sy, guideRect.sx, guideRect.sh);
          ctx.fillRect(guideRect.sx + guideRect.sw, guideRect.sy, W - (guideRect.sx + guideRect.sw), guideRect.sh);
        }
        ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(guideRect.sx, guideRect.sy, guideRect.sw, guideRect.sh);
      }

      const gx = guideRect.sx;
      const gy = guideRect.sy;
      const gw = guideRect.sw;
      const gh = guideRect.sh;

      // 1. Draw Rule of Thirds Grid inside active crop bounds
      if (showGrid) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
        ctx.lineWidth = 1;

        // Vertical third lines
        ctx.beginPath();
        ctx.moveTo(gx + gw * (1 / 3), gy);
        ctx.lineTo(gx + gw * (1 / 3), gy + gh);
        ctx.moveTo(gx + gw * (2 / 3), gy);
        ctx.lineTo(gx + gw * (2 / 3), gy + gh);

        // Horizontal third lines
        ctx.moveTo(gx, gy + gh * (1 / 3));
        ctx.lineTo(gx + gw, gy + gh * (1 / 3));
        ctx.moveTo(gx, gy + gh * (2 / 3));
        ctx.lineTo(gx + gw, gy + gh * (2 / 3));
        ctx.stroke();

        // 4 Power Points (circle reticles)
        const powerPoints = [
          { x: gx + gw * (1 / 3), y: gy + gh * (1 / 3) },
          { x: gx + gw * (2 / 3), y: gy + gh * (1 / 3) },
          { x: gx + gw * (1 / 3), y: gy + gh * (2 / 3) },
          { x: gx + gw * (2 / 3), y: gy + gh * (2 / 3) },
        ];

        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        for (const pt of powerPoints) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2. Draw Headroom Indicator Bracket at top (8% zone inside crop frame)
      ctx.strokeStyle = "rgba(46, 213, 115, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(gx + gw * 0.25, gy + gh * 0.08);
      ctx.lineTo(gx + gw * 0.75, gy + gh * 0.08);
      ctx.stroke();
      ctx.setLineDash([]);

      // 2b. Render Calibrated Studio / Biometric Template Guides
      const templateLocked = Boolean(
        composition && composition.overallScore >= 85 && composition.issues.length === 0,
      );
      const templateStroke = templateLocked
        ? "rgba(46, 213, 115, 0.85)"
        : "rgba(255, 171, 0, 0.85)";

      if (template === "PASSPORT_ID") {
        // Vertical span [0.16..0.70] (height 0.54) matches PASSPORT_ID evaluator (top 0.10..0.25, height 0.36..0.68)
        const cx = gx + gw * 0.5;
        const cy = gy + gh * 0.43;
        const rx = Math.min(gw, gh) * 0.22;
        const ry = gh * 0.27;

        ctx.save();
        ctx.strokeStyle = templateStroke;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Top-of-head and chin alignment ticks
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(cx - 24, cy - ry);
        ctx.lineTo(cx + 24, cy - ry);
        ctx.moveTo(cx - 24, cy + ry);
        ctx.lineTo(cx + 24, cy + ry);
        ctx.stroke();

        ctx.font = "700 11px sans-serif";
        ctx.fillStyle = templateStroke;
        ctx.textAlign = "center";
        ctx.fillText("BIOMETRIC ID OVAL", cx, gy + gh * 0.88);
        ctx.restore();
      } else if (template === "HEADSHOT_PRO") {
        const cx = gx + gw * 0.5;
        const cy = gy + gh * 0.38;
        const rx = Math.min(gw, gh) * 0.2;
        const ry = gh * 0.22;

        ctx.save();
        ctx.strokeStyle = templateStroke;
        ctx.lineWidth = 1.75;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Shoulder baseline & eye line
        ctx.beginPath();
        ctx.moveTo(gx + gw * 0.26, gy + gh * 0.72);
        ctx.lineTo(gx + gw * 0.74, gy + gh * 0.72);
        ctx.stroke();

        ctx.font = "700 11px sans-serif";
        ctx.fillStyle = templateStroke;
        ctx.textAlign = "center";
        ctx.fillText("STUDIO HEADSHOT GUIDE", cx, gy + gh * 0.88);
        ctx.restore();
      } else if (template === "CREATOR_TALKING_HEAD") {
        ctx.save();
        // Eye-line band evaluated by CREATOR_TALKING_HEAD (y in 0.22..0.45)
        ctx.strokeStyle = "rgba(46, 213, 115, 0.45)";
        ctx.lineWidth = 1.25;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(gx + gw * 0.22, gy + gh * 0.33);
        ctx.lineTo(gx + gw * 0.78, gy + gh * 0.33);
        ctx.stroke();

        ctx.strokeStyle = "rgba(56, 189, 248, 0.55)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(gx + gw * 0.08, gy + gh * 0.76, gw * 0.84, gh * 0.16);
        ctx.font = "700 10px sans-serif";
        ctx.fillStyle = "rgba(56, 189, 248, 0.8)";
        ctx.textAlign = "center";
        ctx.fillText("LOWER-THIRD GRAPHICS SAFE ZONE", gx + gw * 0.5, gy + gh * 0.855);
        ctx.restore();
      }

      // 3. Draw Signed Real-Time Horizon Level Bar
      const horizonMetric = composition?.metrics.find((m) => m.type === "HORIZON_ALIGNMENT");
      const isHorizonLevel = horizonMetric ? horizonMetric.score >= 90 : true;
      const angleDeg = composition?.horizonAngleDegrees ?? 0;
      const angleRad = (angleDeg * Math.PI) / 180;

      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(angleRad);

      ctx.strokeStyle = isHorizonLevel ? "rgba(46, 213, 115, 0.75)" : "rgba(255, 171, 0, 0.9)";
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

      if (composition?.horizonAngleDegrees !== undefined) {
        ctx.save();
        ctx.font = "600 11px sans-serif";
        ctx.fillStyle = isHorizonLevel ? "rgba(46, 213, 115, 0.85)" : "rgba(255, 171, 0, 0.95)";
        ctx.textAlign = "center";
        ctx.fillText(`${angleDeg.toFixed(1)}°`, W / 2, H / 2 + 22);
        ctx.restore();
      }

      // 4. Draw Tracked Subject Reticle & Power-Point Alignment Vector inside active crop guideRect
      if (composition?.primarySubjectBounds) {
        const box = composition.primarySubjectBounds;
        const bx = gx + box.x * gw;
        const by = gy + box.y * gh;
        const bw = box.width * gw;
        const bh = box.height * gh;
        const corner = Math.min(22, Math.max(10, Math.min(bw, bh) * 0.2));

        const subjectColor =
          composition.overallScore >= 90
            ? "rgba(46, 213, 115, 0.9)"
            : composition.overallScore >= 70
              ? "rgba(30, 144, 255, 0.85)"
              : "rgba(255, 165, 2, 0.9)";

        ctx.strokeStyle = subjectColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        // Top-left bracket
        ctx.moveTo(bx, by + corner);
        ctx.lineTo(bx, by);
        ctx.lineTo(bx + corner, by);
        // Top-right bracket
        ctx.moveTo(bx + bw - corner, by);
        ctx.lineTo(bx + bw, by);
        ctx.lineTo(bx + bw, by + corner);
        // Bottom-left bracket
        ctx.moveTo(bx, by + bh - corner);
        ctx.lineTo(bx, by + bh);
        ctx.lineTo(bx + corner, by + bh);
        // Bottom-right bracket
        ctx.moveTo(bx + bw - corner, by + bh);
        ctx.lineTo(bx + bw, by + bh);
        ctx.lineTo(bx + bw, by + bh - corner);
        ctx.stroke();

        // Focal eye-line reticle & dashed alignment vector to nearest Rule-of-Thirds target inside active frame
        if (composition.primaryFocalPoint) {
          const fx = gx + composition.primaryFocalPoint.x * gw;
          const fy = gy + composition.primaryFocalPoint.y * gh;

          ctx.fillStyle = subjectColor;
          ctx.beginPath();
          ctx.arc(fx, fy, 4, 0, Math.PI * 2);
          ctx.fill();

          if (composition.overallScore < 90) {
            const candidateTargets =
              composition.profile === "PORTRAIT" || composition.profile === "ARCHITECTURE"
                ? [
                    { x: gx + gw * (1 / 3), y: gy + gh * (1 / 3) },
                    { x: gx + gw * 0.5, y: gy + gh * (1 / 3) },
                    { x: gx + gw * (2 / 3), y: gy + gh * (1 / 3) },
                  ]
                : [
                    { x: gx + gw * (1 / 3), y: gy + gh * (1 / 3) },
                    { x: gx + gw * (2 / 3), y: gy + gh * (1 / 3) },
                    { x: gx + gw * (1 / 3), y: gy + gh * (2 / 3) },
                    { x: gx + gw * (2 / 3), y: gy + gh * (2 / 3) },
                  ];

            let nearest = candidateTargets[0];
            let bestDist = Infinity;
            for (const t of candidateTargets) {
              const d = Math.hypot(t.x - fx, t.y - fy);
              if (d < bestDist) {
                bestDist = d;
                nearest = t;
              }
            }

            if (nearest && bestDist > 12) {
              ctx.save();
              ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
              ctx.lineWidth = 1.5;
              ctx.setLineDash([5, 5]);
              ctx.beginPath();
              ctx.moveTo(fx, fy);
              ctx.lineTo(nearest.x, nearest.y);
              ctx.stroke();

              ctx.beginPath();
              ctx.arc(nearest.x, nearest.y, 7, 0, Math.PI * 2);
              ctx.strokeStyle = subjectColor;
              ctx.setLineDash([]);
              ctx.stroke();
              ctx.restore();
            }
          }
        }
      }

      animId = requestAnimationFrame(renderOverlay);
    };

    animId = requestAnimationFrame(renderOverlay);
    return () => cancelAnimationFrame(animId);
  }, [aspectRatio, composition, showGrid, syntheticPreset, template, useSynthetic, videoRef]);

  const videoTransforms: string[] = [];
  if (mirrorPreview) videoTransforms.push("scaleX(-1)");
  if (digitalZoom > 1) videoTransforms.push(`scale(${digitalZoom})`);

  return (
    <div className="viewfinder-container">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="viewfinder-video"
        style={{
          transform: videoTransforms.length > 0 ? videoTransforms.join(" ") : undefined,
        }}
      />
      <canvas ref={canvasRef} className="viewfinder-overlay" />
    </div>
  );
}
