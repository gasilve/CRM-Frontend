// @ts-nocheck

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Crop, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PhotoItem } from "@/osint/lib/types";
import { useMarkAsSubjectCrop } from "@/osint/lib/queries";
import { toast } from "sonner";

interface Rect { x: number; y: number; w: number; h: number }

const API_BASE = typeof window!=="undefined" ? (!["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : (window.location.port==="4001" ? "" : "http://localhost:8000")) : "";

export function CropFaceModal({ photo, onClose }: { photo: PhotoItem; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [startPt, setStartPt] = useState<{ x: number; y: number } | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const cropMut = useMarkAsSubjectCrop();

  const imgSrc = `${API_BASE}/api/photos/${photo.id}/full`;

  const draw = useCallback((currentRect: Rect | null) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (currentRect && currentRect.w > 2 && currentRect.h > 2) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, canvas.width, currentRect.y);
      ctx.fillRect(0, currentRect.y, currentRect.x, currentRect.h);
      ctx.fillRect(currentRect.x + currentRect.w, currentRect.y, canvas.width - currentRect.x - currentRect.w, currentRect.h);
      ctx.fillRect(0, currentRect.y + currentRect.h, canvas.width, canvas.height - currentRect.y - currentRect.h);
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);
      ctx.setLineDash([]);
      const hs = 8;
      const corners = [
        [currentRect.x, currentRect.y],
        [currentRect.x + currentRect.w - hs, currentRect.y],
        [currentRect.x, currentRect.y + currentRect.h - hs],
        [currentRect.x + currentRect.w - hs, currentRect.y + currentRect.h - hs],
      ];
      ctx.fillStyle = "#3b82f6";
      corners.forEach(([cx, cy]) => ctx.fillRect(cx, cy, hs, hs));
      const label = `${Math.round(currentRect.w)}x${Math.round(currentRect.h)}px`;
      const tw = ctx.measureText(label).width;
      const lx = Math.min(currentRect.x, canvas.width - tw - 8);
      const ly = Math.max(currentRect.y - 6, 16);
      ctx.fillStyle = "rgba(59,130,246,0.85)";
      ctx.fillRect(lx - 3, ly - 13, tw + 6, 18);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px system-ui";
      ctx.fillText(label, lx, ly);
    }
  }, [imgLoaded]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxW = 680, maxH = 480;
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      setImgLoaded(true);
    };
    img.onerror = () => toast.error("Could not load full image");
    img.src = imgSrc;
  }, [imgSrc]);

  useEffect(() => { draw(rect); }, [imgLoaded, rect, draw]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - r.left, canvasRef.current!.width)),
      y: Math.max(0, Math.min(e.clientY - r.top, canvasRef.current!.height)),
    };
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPos(e); setStartPt(pos); setDrawing(true); setRect(null);
  };
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !startPt) return;
    const pos = getPos(e);
    const r = { x: Math.min(startPt.x, pos.x), y: Math.min(startPt.y, pos.y), w: Math.abs(pos.x - startPt.x), h: Math.abs(pos.y - startPt.y) };
    setRect(r); draw(r);
  };
  const onMouseUp = () => { setDrawing(false); setStartPt(null); };

  const toNatural = (r: Rect): Rect => {
    if (!naturalSize || !canvasRef.current) return r;
    const sx = naturalSize.w / canvasRef.current.width;
    const sy = naturalSize.h / canvasRef.current.height;
    return { x: Math.round(r.x * sx), y: Math.round(r.y * sy), w: Math.round(r.w * sx), h: Math.round(r.h * sy) };
  };

  const handleConfirm = () => {
    if (!rect || rect.w < 20 || rect.h < 20) { toast.error("Draw a box around the face first"); return; }
    const n = toNatural(rect);
    cropMut.mutate(
      { id: photo.id, x: n.x, y: n.y, width: n.w, height: n.h, by: "investigator" },
      {
        onSuccess: () => { toast.success("Face saved — reprocessing started"); onClose(); },
        onError: (err: unknown) => {
          const detail = (err as { response?: { data?: { detail?: { message?: string } } } })?.response?.data?.detail;
          toast.error(typeof detail === "object" && detail?.message ? detail.message : "Failed to save crop");
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h2 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
              <Crop className="h-4 w-4 text-blue-600" />
              Select the face
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Draw a box around the subject&apos;s face.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100"><X className="h-4 w-4 text-slate-500" /></button>
        </div>
        <div className="p-4 flex justify-center bg-slate-900 min-h-32">
          {!imgLoaded && <div className="flex items-center justify-center text-slate-400 text-sm w-full">Loading image...</div>}
          <canvas
            ref={canvasRef}
            className={`cursor-crosshair select-none rounded ${imgLoaded ? "" : "hidden"}`}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50">
          <p className="text-xs text-slate-500">
            {rect && rect.w > 2 ? `Selection: ${Math.round(rect.w)}×${Math.round(rect.h)}px` : "Click and drag to draw a box around the face"}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setRect(null)} disabled={!rect}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />Clear
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleConfirm}
              disabled={!rect || rect.w < 20 || rect.h < 20 || cropMut.isPending}>
              <Check className="h-3.5 w-3.5 mr-1" />
              {cropMut.isPending ? "Processing..." : "Confirm face"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
