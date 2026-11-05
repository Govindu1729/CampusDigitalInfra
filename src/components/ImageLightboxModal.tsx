"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Pen,
  ArrowUpRight,
  Square,
  Circle,
  Highlighter,
  Undo2,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  Send,
  Check,
  Loader2,
} from "lucide-react";

export interface LightboxImageItem {
  url: string;
  name: string;
  sizeBytes?: number;
}

interface ImageLightboxModalProps {
  images: LightboxImageItem[];
  initialIndex?: number;
  startInDrawMode?: boolean;
  onClose: () => void;
  // Direct reply capability: post message with annotated photo directly to ticket/chat
  onDirectReply?: (
    annotatedPhoto: { url: string; name: string },
    replyText?: string
  ) => void | Promise<void>;
  // When editing/annotating an uploaded photo
  onSaveAnnotation?: (annotatedUrl: string) => void;
}

export type MarkupToolType = "arrow" | "pen" | "rect" | "circle" | "highlighter";

export interface Stroke {
  tool: MarkupToolType;
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

const MARKUP_TOOLS = [
  { id: "arrow" as MarkupToolType, name: "Arrow", icon: ArrowUpRight, desc: "Pointer arrow" },
  { id: "pen" as MarkupToolType, name: "Pencil", icon: Pen, desc: "Freehand sketch" },
  { id: "rect" as MarkupToolType, name: "Box", icon: Square, desc: "Frame defect area" },
  { id: "circle" as MarkupToolType, name: "Circle", icon: Circle, desc: "Circle point of interest" },
  { id: "highlighter" as MarkupToolType, name: "Marker", icon: Highlighter, desc: "Highlight area" },
];

const PEN_COLORS = [
  { name: "Fault Red", value: "#ef4444", border: "border-red-500" },
  { name: "Warning Amber", value: "#f97316", border: "border-orange-500" },
  { name: "Attention Yellow", value: "#eab308", border: "border-yellow-400" },
  { name: "Highlight Green", value: "#22c55e", border: "border-emerald-500" },
  { name: "Marker Blue", value: "#3b82f6", border: "border-blue-500" },
  { name: "Clean White", value: "#ffffff", border: "border-white" },
];

const PEN_WIDTHS = [
  { name: "Fine", value: 3, dotSize: "w-1.5 h-1.5" },
  { name: "Med", value: 5, dotSize: "w-2.5 h-2.5" },
  { name: "Thick", value: 8, dotSize: "w-3.5 h-3.5" },
];

const drawSingleStroke = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  scaleX = 1,
  scaleY = 1
) => {
  if (stroke.points.length < 2) return;
  const scaleWidth = (scaleX + scaleY) / 2;

  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;

  if (stroke.tool === "pen") {
    ctx.lineWidth = stroke.width * scaleWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x * scaleX, stroke.points[i].y * scaleY);
    }
    ctx.stroke();
  } else if (stroke.tool === "highlighter") {
    ctx.save();
    ctx.globalAlpha = 0.38;
    ctx.lineWidth = Math.max(stroke.width * 2.8 * scaleWidth, 10 * scaleWidth);
    ctx.lineCap = "square";
    ctx.lineJoin = "bevel";
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x * scaleX, stroke.points[i].y * scaleY);
    }
    ctx.stroke();
    ctx.restore();
  } else if (stroke.tool === "rect") {
    ctx.lineWidth = stroke.width * scaleWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    const x = Math.min(start.x, end.x) * scaleX;
    const y = Math.min(start.y, end.y) * scaleY;
    const w = Math.abs(end.x - start.x) * scaleX;
    const h = Math.abs(end.y - start.y) * scaleY;
    ctx.beginPath();
    ctx.strokeRect(x, y, w, h);
  } else if (stroke.tool === "circle") {
    ctx.lineWidth = stroke.width * scaleWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    const centerX = ((start.x + end.x) / 2) * scaleX;
    const centerY = ((start.y + end.y) / 2) * scaleY;
    const radiusX = (Math.abs(end.x - start.x) / 2) * scaleX;
    const radiusY = (Math.abs(end.y - start.y) / 2) * scaleY;
    ctx.beginPath();
    ctx.ellipse(
      centerX,
      centerY,
      Math.max(radiusX, 1),
      Math.max(radiusY, 1),
      0,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  } else if (stroke.tool === "arrow") {
    ctx.lineWidth = stroke.width * scaleWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const start = {
      x: stroke.points[0].x * scaleX,
      y: stroke.points[0].y * scaleY,
    };
    const end = {
      x: stroke.points[stroke.points.length - 1].x * scaleX,
      y: stroke.points[stroke.points.length - 1].y * scaleY,
    };

    // Main shaft
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLength = Math.max(ctx.lineWidth * 3.5, 16 * scaleWidth);

    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLength * Math.cos(angle - Math.PI / 6),
      end.y - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLength * Math.cos(angle + Math.PI / 6),
      end.y - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  }
};

export default function ImageLightboxModal({
  images,
  initialIndex = 0,
  startInDrawMode = false,
  onClose,
  onDirectReply,
  onSaveAnnotation,
}: ImageLightboxModalProps) {
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(0, Math.min(initialIndex, images.length - 1))
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Zoom and Pan states
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const currentPanRef = useRef({ x: 0, y: 0 });

  // Mobile Touch Gestures (Swipe navigation, Pinch-to-zoom, 1-finger pan, Double-tap)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number>(1);
  const lastTapTimeRef = useRef<number>(0);

  // Drawing / Annotation states
  const [isDrawMode, setIsDrawMode] = useState(startInDrawMode);
  const [activeTool, setActiveTool] = useState<MarkupToolType>("arrow");
  const [activeColor, setActiveColor] = useState("#ef4444");
  const [activeWidth, setActiveWidth] = useState(5);
  // Store strokes per image URL
  const [strokesByUrl, setStrokesByUrl] = useState<Record<string, Stroke[]>>({});

  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<{ x: number; y: number }[]>([]);

  // Direct Reply Dialog State
  const [showDirectReplyDrawer, setShowDirectReplyDrawer] = useState(false);
  const [directReplyText, setDirectReplyText] = useState("");
  const [isSendingDirectReply, setIsSendingDirectReply] = useState(false);
  const [annotatedPreviewUrl, setAnnotatedPreviewUrl] = useState<string | null>(null);

  // DOM Refs
  const modalRootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const hasPoppedHistoryRef = useRef(false);
  const thumbnailTrackRef = useRef<HTMLDivElement | null>(null);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Auto-scroll active thumbnail into view
  useEffect(() => {
    if (thumbnailRefs.current[currentIndex]) {
      thumbnailRefs.current[currentIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentIndex]);

  // Keep a stable ref for onClose to avoid re-triggering effects
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const currentImage = images[currentIndex] || images[0];
  const currentStrokes = currentImage ? strokesByUrl[currentImage.url] || [] : [];

  // Reset zoom & pan when switching images
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    currentPanRef.current = { x: 0, y: 0 };
  }, [currentIndex]);

  // Keep currentPanRef in sync
  useEffect(() => {
    currentPanRef.current = pan;
  }, [pan]);

  // 1. TOTAL BACKGROUND SCROLL LOCK
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyTouchAction = document.body.style.touchAction;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const preventWindowScroll = (e: WheelEvent | TouchEvent) => {
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    window.addEventListener("wheel", preventWindowScroll, { passive: false });
    window.addEventListener("touchmove", preventWindowScroll, { passive: false });

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.touchAction = originalBodyTouchAction;
      document.body.style.paddingRight = "";
      window.removeEventListener("wheel", preventWindowScroll);
      window.removeEventListener("touchmove", preventWindowScroll);
    };
  }, []);

  // 2. BROWSER BACK BUTTON HANDLING (One single push on mount)
  useEffect(() => {
    try {
      window.history.pushState({ imageLightboxModal: true }, "");
    } catch {
      // In case pushState is restricted
    }

    const handlePopState = () => {
      hasPoppedHistoryRef.current = true;
      onCloseRef.current();
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []); // Run strictly once on mount

  // Instant Single-Click Close Handler
  const handleSafeClose = useCallback(() => {
    // 1. Immediately close any open drawer & modal in the UI in 1 single click!
    setShowDirectReplyDrawer(false);
    onClose();

    // 2. Pop the history state if it was pushed and not yet popped
    if (!hasPoppedHistoryRef.current) {
      hasPoppedHistoryRef.current = true;
      try {
        if (window.history.state?.imageLightboxModal) {
          window.history.back();
        }
      } catch {
        // Fallback
      }
    }
  }, [onClose]);

  // Keyboard navigation & Shortcuts (Esc to close, Left/Right for gallery, +/- for zoom)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (showDirectReplyDrawer) {
          setShowDirectReplyDrawer(false);
        } else {
          handleSafeClose();
        }
      } else if (e.key === "ArrowLeft") {
        if (!isDrawMode && !showDirectReplyDrawer && currentIndex > 0) {
          e.preventDefault();
          setCurrentIndex((i) => i - 1);
        }
      } else if (e.key === "ArrowRight") {
        if (!isDrawMode && !showDirectReplyDrawer && currentIndex < images.length - 1) {
          e.preventDefault();
          setCurrentIndex((i) => i + 1);
        }
      } else if ((e.key === "+" || e.key === "=") && !isDrawMode && !showDirectReplyDrawer) {
        e.preventDefault();
        setZoom((z) => Math.min(z + 0.25, 4));
      } else if ((e.key === "-" || e.key === "_") && !isDrawMode && !showDirectReplyDrawer) {
        e.preventDefault();
        setZoom((z) => Math.max(z - 0.25, 0.5));
      } else if (e.key === "0" && !isDrawMode && !showDirectReplyDrawer) {
        e.preventDefault();
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, images.length, isDrawMode, showDirectReplyDrawer, handleSafeClose]);

  // 3. CANVAS REDRAW FUNCTION
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const strokes = currentImage ? strokesByUrl[currentImage.url] || [] : [];
    strokes.forEach((stroke) => {
      drawSingleStroke(ctx, stroke, 1, 1);
    });
  }, [currentImage, strokesByUrl]);

  // Synchronize canvas size with rendered image size
  const syncCanvasSize = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const rect = img.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
        redrawCanvas();
      }
    }
  }, [redrawCanvas]);

  useEffect(() => {
    syncCanvasSize();
    redrawCanvas();
  }, [currentIndex, strokesByUrl, syncCanvasSize, redrawCanvas]);

  // Window resize sync
  useEffect(() => {
    const handleResize = () => {
      syncCanvasSize();
      redrawCanvas();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [syncCanvasSize, redrawCanvas]);

  // 4. MOUSE & TOUCH DRAWING HANDLERS
  const getCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (clientX: number, clientY: number) => {
    if (!isDrawMode || !currentImage) return;
    isDrawingRef.current = true;
    const pt = getCanvasCoords(clientX, clientY);
    currentPointsRef.current = [pt];
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isDrawingRef.current || !isDrawMode || !currentImage) return;
    const pt = getCanvasCoords(clientX, clientY);

    if (activeTool === "pen" || activeTool === "highlighter") {
      currentPointsRef.current.push(pt);
    } else {
      // Shape tools: arrow, rect, circle need start and current point
      currentPointsRef.current = [currentPointsRef.current[0], pt];
    }

    // Live preview
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    redrawCanvas();

    if (currentPointsRef.current.length > 1) {
      drawSingleStroke(
        ctx,
        {
          tool: activeTool,
          color: activeColor,
          width: activeWidth,
          points: currentPointsRef.current,
        },
        1,
        1
      );
    }
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current || !isDrawMode || !currentImage) return;
    isDrawingRef.current = false;

    if (currentPointsRef.current.length > 1) {
      const newStroke: Stroke = {
        tool: activeTool,
        color: activeColor,
        width: activeWidth,
        points: [...currentPointsRef.current],
      };

      setStrokesByUrl((prev) => {
        const existing = prev[currentImage.url] || [];
        return {
          ...prev,
          [currentImage.url]: [...existing, newStroke],
        };
      });
    }

    currentPointsRef.current = [];
  };

  // 5. UNDO & CLEAR
  const handleUndo = () => {
    if (!currentImage) return;
    setStrokesByUrl((prev) => {
      const existing = prev[currentImage.url] || [];
      if (existing.length === 0) return prev;
      return {
        ...prev,
        [currentImage.url]: existing.slice(0, existing.length - 1),
      };
    });
  };

  const handleClearAll = () => {
    if (!currentImage) return;
    setStrokesByUrl((prev) => ({
      ...prev,
      [currentImage.url]: [],
    }));
  };

  // 6. GENERATE MERGED ANNOTATED IMAGE DATA URL
  const getAnnotatedDataUrl = (): string | null => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !currentImage) return null;

    try {
      const offscreen = document.createElement("canvas");
      offscreen.width = img.naturalWidth || canvas.width || 800;
      offscreen.height = img.naturalHeight || canvas.height || 600;
      const ctx = offscreen.getContext("2d");
      if (!ctx) return null;

      // Draw base image
      ctx.drawImage(img, 0, 0, offscreen.width, offscreen.height);

      // Scale canvas annotations to original resolution
      const scaleX = canvas.width > 0 ? offscreen.width / canvas.width : 1;
      const scaleY = canvas.height > 0 ? offscreen.height / canvas.height : 1;

      const strokes = strokesByUrl[currentImage.url] || [];
      strokes.forEach((stroke) => {
        drawSingleStroke(ctx, stroke, scaleX, scaleY);
      });

      return offscreen.toDataURL("image/png");
    } catch (err) {
      console.error("Failed to export annotated canvas:", err);
      return currentImage.url;
    }
  };

  // 7. DOWNLOAD ANNOTATED IMAGE
  const handleDownload = () => {
    const dataUrl = getAnnotatedDataUrl();
    if (!dataUrl || !currentImage) return;

    const link = document.createElement("a");
    link.download = `annotated-${currentImage.name || "evidence-photo"}.png`;
    link.href = dataUrl;
    link.click();
  };

  // 8. DIRECT REPLY HANDLERS
  const handleOpenDirectReply = () => {
    const dataUrl = getAnnotatedDataUrl() || currentImage?.url || null;
    setAnnotatedPreviewUrl(dataUrl);
    setShowDirectReplyDrawer(true);
  };

  const handleSendDirectReply = async () => {
    if (!onDirectReply || !currentImage || isSendingDirectReply) return;
    setIsSendingDirectReply(true);
    try {
      const dataUrl = annotatedPreviewUrl || getAnnotatedDataUrl() || currentImage.url;
      await onDirectReply(
        {
          url: dataUrl,
          name: `annotated-${currentImage.name || "photo.png"}`,
        },
        directReplyText
      );
      setShowDirectReplyDrawer(false);
      handleSafeClose();
    } catch {
      setIsSendingDirectReply(false);
    }
  };

  // 9. SAVE ANNOTATION (For uploaded photos before submitting)
  const handleSaveUploadAnnotation = () => {
    if (!onSaveAnnotation || !currentImage) return;
    const dataUrl = getAnnotatedDataUrl() || currentImage.url;
    onSaveAnnotation(dataUrl);
    handleSafeClose();
  };

  // Complete editing and automatically save markings
  const handleDoneEditing = () => {
    if (onSaveAnnotation) {
      handleSaveUploadAnnotation();
      return;
    }
    if (onDirectReply) {
      handleOpenDirectReply();
      return;
    }
    setIsDrawMode(false);
  };

  // 10. MOUSE WHEEL ZOOM
  const handleWheel = (e: React.WheelEvent) => {
    if (isDrawMode) return;
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setZoom((z) => Math.min(Math.max(Number((z + delta).toFixed(2)), 0.5), 4));
  };

  // 11. DRAGGING / PANNING WHEN ZOOMED
  const handleMouseDownStage = (e: React.MouseEvent) => {
    if (isDrawMode || zoom <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - currentPanRef.current.x, y: e.clientY - currentPanRef.current.y };
  };

  const handleMouseMoveStage = (e: React.MouseEvent) => {
    if (!isDragging || isDrawMode || zoom <= 1) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUpStage = () => {
    setIsDragging(false);
  };

  // Double click toggles between 1x and 2x zoom
  const handleDoubleClick = () => {
    if (isDrawMode) return;
    if (zoom === 1) {
      setZoom(2);
    } else {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  };

  // 12. MOBILE TOUCH GESTURES (Pinch-to-zoom, 1-finger pan, Double-tap, Horizontal swipe)
  const handleTouchStartStage = (e: React.TouchEvent) => {
    if (isDrawMode) return;

    // 2-finger pinch to zoom start
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDistRef.current = dist;
      initialPinchZoomRef.current = zoom;
      return;
    }

    // 1-finger touch
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };

      if (zoom > 1) {
        setIsDragging(true);
        dragStartRef.current = {
          x: touch.clientX - currentPanRef.current.x,
          y: touch.clientY - currentPanRef.current.y,
        };
      }
    }
  };

  const handleTouchMoveStage = (e: React.TouchEvent) => {
    if (isDrawMode) return;

    // Handle 2-finger pinch zoom
    if (e.touches.length === 2 && initialPinchDistRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / initialPinchDistRef.current;
      const targetZoom = Math.min(
        Math.max(Number((initialPinchZoomRef.current * ratio).toFixed(2)), 0.8),
        4
      );
      setZoom(targetZoom);
      return;
    }

    // Handle 1-finger pan when zoomed in
    if (e.touches.length === 1 && zoom > 1 && isDragging) {
      const touch = e.touches[0];
      setPan({
        x: touch.clientX - dragStartRef.current.x,
        y: touch.clientY - dragStartRef.current.y,
      });
    }
  };

  const handleTouchEndStage = (e: React.TouchEvent) => {
    if (isDrawMode) return;

    setIsDragging(false);
    initialPinchDistRef.current = null;

    // Single finger touch ended
    if (touchStartRef.current && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const deltaTime = Date.now() - touchStartRef.current.time;

      // Check double-tap to toggle zoom (within 320ms and small displacement)
      const now = Date.now();
      if (
        Math.abs(deltaX) < 15 &&
        Math.abs(deltaY) < 15 &&
        now - lastTapTimeRef.current < 320
      ) {
        if (zoom === 1) {
          setZoom(2);
        } else {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }
        lastTapTimeRef.current = 0;
        touchStartRef.current = null;
        return;
      }
      lastTapTimeRef.current = now;

      // Check horizontal swipe between photos (at 1x zoom)
      if (
        zoom === 1 &&
        Math.abs(deltaX) > 45 &&
        Math.abs(deltaX) > Math.abs(deltaY) * 1.5 &&
        deltaTime < 450
      ) {
        if (deltaX < 0 && currentIndex < images.length - 1) {
          // Swipe left -> Next image
          setCurrentIndex((i) => i + 1);
        } else if (deltaX > 0 && currentIndex > 0) {
          // Swipe right -> Prev image
          setCurrentIndex((i) => i - 1);
        }
      }

      touchStartRef.current = null;
    }
  };

  if (!mounted || !currentImage || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={modalRootRef}
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[999999] bg-slate-950/98 backdrop-blur-2xl flex flex-col justify-between w-screen h-screen overflow-hidden overscroll-contain touch-none select-none animate-in fade-in duration-150 m-0 p-0"
      style={{ margin: 0, padding: 0, top: 0, left: 0 }}
    >
      {/* TOP DOCKED TOOLBAR: Completely flush to the top edge, zero extra top padding */}
      <header className="w-full bg-slate-900/95 dark:bg-slate-950/95 border-b border-slate-800/80 backdrop-blur-md px-3 sm:px-6 py-2 flex sm:grid sm:grid-cols-[1fr_auto_1fr] items-center justify-between gap-2 shrink-0 z-50 m-0">
        {/* Left (Col 1): Image Info & Counter */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 sm:justify-self-start overflow-hidden max-w-[50%] sm:max-w-full">
          <span
            className="text-xs sm:text-sm font-bold text-white truncate block min-w-0 max-w-[110px] xs:max-w-[150px] sm:max-w-xs md:max-w-sm lg:max-w-md"
            title={currentImage.name}
          >
            {currentImage.name}
          </span>
          {images.length > 1 && (
            <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-indigo-400 border border-slate-700 shrink-0 whitespace-nowrap">
              {currentIndex + 1} / {images.length}
            </span>
          )}
        </div>

        {/* Center (Col 2 - Desktop only): Centered Zoom, Point Out & Reply Controls */}
        <div className="hidden sm:flex items-center justify-center gap-1.5 sm:gap-2 justify-self-center shrink-0">
          {/* Zoom In / Out / Reset Controls */}
          <div className="flex items-center bg-slate-800/80 rounded-xl p-0.5 border border-slate-700 shadow-2xs">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(Number((z - 0.25).toFixed(2)), 0.5))}
              disabled={zoom <= 0.5 || isDrawMode}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              disabled={isDrawMode}
              className="px-2 py-1 text-[11px] sm:text-xs font-mono font-bold text-slate-200 hover:text-white cursor-pointer min-w-[45px] text-center"
              title="Reset Zoom to 100%"
            >
              {Math.round(zoom * 100)}%
            </button>

            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(Number((z + 0.25).toFixed(2)), 4))}
              disabled={zoom >= 4 || isDrawMode}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="p-1.5 rounded-lg text-amber-400 hover:bg-slate-700/60 transition-colors cursor-pointer border-l border-slate-700/80"
                title="Reset View"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Annotate / Edit Mode Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsDrawMode((prev) => !prev);
              if (!isDrawMode) {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }
            }}
            className={`flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              isDrawMode
                ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30"
                : "bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700"
            }`}
            title={isDrawMode ? "Exit Edit Mode" : "Edit Photo (Draw Markings / Arrows)"}
          >
            <Pen className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isDrawMode ? "Editing" : "Edit"}</span>
          </button>

          {/* Save Annotation Button (when annotating an uploaded file) */}
          {onSaveAnnotation && (
            <button
              type="button"
              onClick={handleSaveUploadAnnotation}
              className="flex items-center gap-1.5 p-1.5 sm:px-3.5 sm:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
              title="Save markings to uploaded photo"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Marking</span>
            </button>
          )}

          {/* Direct Reply Button (when viewing ticket photos) */}
          {onDirectReply && !onSaveAnnotation && (
            <button
              type="button"
              onClick={handleOpenDirectReply}
              className="flex items-center gap-1.5 p-1.5 sm:px-3.5 sm:py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
              title="Directly reply to conversation with this annotated photo"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Direct Reply</span>
            </button>
          )}
        </div>

        {/* Right (Col 3 on Desktop, Actions + Close on Mobile) */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2 sm:justify-self-end shrink-0">
          {/* Mobile Quick Action Buttons (< sm screens) */}
          <div className="flex sm:hidden items-center gap-1">
            {/* Mobile Edit Toggle */}
            <button
              type="button"
              onClick={() => {
                setIsDrawMode((prev) => !prev);
                if (!isDrawMode) {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }
              }}
              className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center ${
                isDrawMode
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30"
                  : "bg-slate-800/90 text-slate-300 border-slate-700"
              }`}
              title={isDrawMode ? "Exit Edit Mode" : "Edit Photo (Draw markings)"}
            >
              <Pen className="w-4 h-4 text-indigo-300" />
            </button>

            {/* Mobile Save Annotation Button */}
            {onSaveAnnotation && (
              <button
                type="button"
                onClick={handleSaveUploadAnnotation}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md cursor-pointer"
                title="Save Marking"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            )}

            {/* Mobile Direct Reply Button */}
            {onDirectReply && !onSaveAnnotation && (
              <button
                type="button"
                onClick={handleOpenDirectReply}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-600/30 cursor-pointer"
                title="Direct Reply"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Reply</span>
              </button>
            )}
          </div>

          {/* Close Cross Button - Single-click instant exit */}
          <button
            type="button"
            onClick={handleSafeClose}
            className="p-1.5 sm:p-2 bg-slate-800/80 hover:bg-rose-600 rounded-xl text-slate-300 hover:text-white border border-slate-700 hover:border-rose-500 shadow-xs cursor-pointer transition-colors"
            title="Close Preview (Esc)"
            aria-label="Close Preview"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </header>

      {/* DRAWING SUB-TOOLBAR (Responsive: 2-Tier Mobile Thumb Dock, Streamlined Desktop Sub-bar) */}
      {isDrawMode && (
        <div className="fixed sm:static bottom-0 inset-x-0 sm:inset-auto z-40 bg-slate-900/98 sm:bg-slate-900/95 border-t sm:border-t-0 sm:border-b border-slate-800 sm:border-indigo-900/50 p-2 sm:px-6 sm:py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-xl">
          {/* MOBILE 2-TIER DOCK (< sm) */}
          <div className="flex sm:hidden flex-col gap-1.5 w-full max-w-md mx-auto">
            {/* Mobile Tier 1: Shape Tools + Undo + Clear + Auto-Save Done Button */}
            <div className="flex items-center justify-between gap-1 w-full bg-slate-800/90 p-1 rounded-xl border border-slate-700/80 shadow-md">
              {/* Shape selector pill group */}
              <div className="flex items-center gap-0.5">
                {MARKUP_TOOLS.map((t) => {
                  const Icon = t.icon;
                  const isActive = activeTool === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTool(t.id)}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                        isActive
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/40"
                          : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                      }`}
                      title={t.desc}
                      aria-label={t.name}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>

              <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />

              {/* Undo and Trash */}
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={currentStrokes.length === 0}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
                  title="Undo Last Stroke"
                  aria-label="Undo"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={currentStrokes.length === 0}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-400 disabled:opacity-30 transition-colors cursor-pointer"
                  title="Clear All Markings"
                  aria-label="Clear All"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />

              {/* Done Button: Automatically saves markings */}
              <button
                type="button"
                onClick={handleDoneEditing}
                className="flex items-center gap-1 px-3 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0"
                title={onSaveAnnotation ? "Save markings & done" : "Done editing"}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Done</span>
              </button>

              {/* Direct Reply Button directly inside mobile draw dock */}
              {onDirectReply && !onSaveAnnotation && (
                <button
                  type="button"
                  onClick={() => {
                    handleDoneEditing();
                    handleOpenDirectReply();
                  }}
                  className="flex items-center gap-1 px-3 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs shadow-xs shadow-indigo-600/30 transition-all cursor-pointer shrink-0"
                  title="Done & Reply with annotated photo"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Reply</span>
                </button>
              )}
            </div>

            {/* Mobile Tier 2: Precise Color Palette + Compact Size Selector */}
            <div className="flex items-center justify-between gap-2 w-full px-1">
              {/* 6 High-Contrast Colors */}
              <div className="flex items-center gap-1.5">
                {PEN_COLORS.map((c) => {
                  const isSelected = activeColor === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setActiveColor(c.value)}
                      className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center relative shrink-0 ${
                        isSelected
                          ? "scale-115 ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-900 shadow-md"
                          : "opacity-85 hover:opacity-100"
                      } ${c.border}`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                      aria-label={c.name}
                    >
                      {isSelected && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            c.value === "#ffffff" || c.value === "#eab308"
                              ? "bg-slate-900"
                              : "bg-white"
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Compact Boldness Selector with visual thickness indicators */}
              <div className="flex items-center bg-slate-800/90 rounded-lg p-0.5 border border-slate-700/80 shrink-0">
                {PEN_WIDTHS.map((w) => {
                  const isSelected = activeWidth === w.value;
                  return (
                    <button
                      key={w.value}
                      type="button"
                      onClick={() => setActiveWidth(w.value)}
                      className={`w-7 h-6 flex items-center justify-center rounded-md transition-all cursor-pointer ${
                        isSelected
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-400 hover:text-white"
                      }`}
                      title={`${w.name} stroke (${w.value}px)`}
                      aria-label={`${w.name} stroke (${w.value}px)`}
                    >
                      <span className={`rounded-full bg-current ${w.dotSize}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* DESKTOP INTEGRATED SUB-BAR (sm: and above) */}
          <div className="hidden sm:flex items-center justify-between gap-4 w-full">
            {/* Left: Shape selector */}
            <div className="flex items-center gap-1">
              {MARKUP_TOOLS.map((t) => {
                const Icon = t.icon;
                const isActive = activeTool === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTool(t.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                      isActive
                        ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                        : "bg-slate-800 text-slate-300 hover:text-white border-slate-700"
                    }`}
                    title={t.desc}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Middle: Color Palette */}
            <div className="flex items-center gap-2 px-3 border-x border-slate-800">
              {PEN_COLORS.map((c) => {
                const isSelected = activeColor === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setActiveColor(c.value)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer flex items-center justify-center ${
                      isSelected
                        ? "scale-115 ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900"
                        : "opacity-80 hover:opacity-100"
                    } ${c.border}`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  >
                    {isSelected && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          c.value === "#ffffff" || c.value === "#eab308"
                            ? "bg-slate-900"
                            : "bg-white"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Middle-Right: Boldness selector */}
            <div className="flex items-center bg-slate-800/90 rounded-lg p-0.5 border border-slate-700/80">
              {PEN_WIDTHS.map((w) => {
                const isSelected = activeWidth === w.value;
                return (
                  <button
                    key={w.value}
                    type="button"
                    onClick={() => setActiveWidth(w.value)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-xs font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title={`${w.name} (${w.value}px)`}
                  >
                    <span className={`rounded-full bg-current ${w.dotSize}`} />
                    <span>{w.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Right: Undo, Clear, Download, Done */}
            <div className="flex items-center gap-1 pl-3 border-l border-slate-800">
              <button
                type="button"
                onClick={handleUndo}
                disabled={currentStrokes.length === 0}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
                title="Undo Last Stroke"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={currentStrokes.length === 0}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-900 disabled:opacity-40 transition-colors cursor-pointer"
                title="Clear All Markings"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                title="Download Annotated Image"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
              <button
                type="button"
                onClick={handleDoneEditing}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer ml-1"
                title={onSaveAnnotation ? "Save markings & done" : "Done editing"}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Done</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN VIEWPORT STAGE: Zero awkward top gap, perfectly centered, touch-gesture enabled */}
      <div
        ref={stageRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDownStage}
        onMouseMove={handleMouseMoveStage}
        onMouseUp={handleMouseUpStage}
        onMouseLeave={handleMouseUpStage}
        onTouchStart={handleTouchStartStage}
        onTouchMove={handleTouchMoveStage}
        onTouchEnd={handleTouchEndStage}
        className={`flex-1 relative w-full h-full flex items-center justify-center overflow-hidden p-0 sm:p-2 touch-none ${
          isDrawMode
            ? "pb-24 sm:pb-0 cursor-crosshair"
            : zoom > 1
            ? isDragging
              ? "cursor-grabbing"
              : "cursor-grab"
            : "cursor-default"
        }`}
      >
        {/* Gallery Navigation Left Arrow */}
        {images.length > 1 && currentIndex > 0 && !isDrawMode && !showDirectReplyDrawer && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex((i) => i - 1);
            }}
            className="absolute left-1.5 sm:left-4 z-30 p-2 sm:p-3 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white border border-slate-700/80 shadow-xl backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Previous Photo (Left Arrow / Swipe Right)"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}

        {/* Gallery Navigation Right Arrow */}
        {images.length > 1 && currentIndex < images.length - 1 && !isDrawMode && !showDirectReplyDrawer && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex((i) => i + 1);
            }}
            className="absolute right-1.5 sm:right-4 z-30 p-2 sm:p-3 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white border border-slate-700/80 shadow-xl backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Next Photo (Right Arrow / Swipe Left)"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}

        {/* Zoomable & Pannable Wrapper */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: isDragging ? "none" : "transform 150ms cubic-bezier(0.2, 0, 0, 1)",
            transformOrigin: "center center",
          }}
          onDoubleClick={handleDoubleClick}
          className={`relative max-w-[96vw] sm:max-w-[94vw] flex items-center justify-center shrink-0 ${
            isDrawMode ? "max-h-[62vh] sm:max-h-[82vh]" : "max-h-[82vh]"
          }`}
        >
          {/* Base Image */}
          <img
            ref={imgRef}
            src={currentImage.url}
            alt={currentImage.name}
            crossOrigin="anonymous"
            onLoad={syncCanvasSize}
            draggable={false}
            className={`max-w-[94vw] sm:max-w-[92vw] w-auto h-auto object-contain rounded-xl shadow-2xl border border-slate-800 ring-1 ring-white/10 pointer-events-none select-none ${
              isDrawMode ? "max-h-[58vh] sm:max-h-[80vh]" : "max-h-[75vh] sm:max-h-[80vh]"
            }`}
          />

          {/* HTML5 Canvas Drawing Overlay (Pinned exactly on top of the image) */}
          <canvas
            ref={canvasRef}
            onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
            onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={(e) => {
              if (e.touches[0]) handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
            }}
            onTouchMove={(e) => {
              if (e.touches[0]) handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
            }}
            onTouchEnd={handlePointerUp}
            className={`absolute inset-0 w-full h-full rounded-xl touch-none ${
              isDrawMode ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"
            }`}
          />
        </div>

        {/* Pan Active Indicator & Mobile Zoom Badge */}
        {zoom > 1 && !isDrawMode && !showDirectReplyDrawer && (
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 text-slate-200 text-xs font-semibold backdrop-blur-md flex items-center gap-2 shadow-xl hover:bg-slate-800 transition-all cursor-pointer z-30"
            title="Tap to reset zoom to 100%"
          >
            <span className="font-mono font-bold text-indigo-400">{Math.round(zoom * 100)}%</span>
            <span className="text-slate-400 text-[10px]">•</span>
            <span className="text-[11px] text-slate-300">Tap or double-tap to reset</span>
          </button>
        )}
      </div>

      {/* PROPER FLOATING DIRECT REPLY MODAL DIALOG (Responsive: Pinned Bottom Sheet on Mobile, Centered on Desktop) */}
      {showDirectReplyDrawer && onDirectReply && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setShowDirectReplyDrawer(false)}
        >
          <div
            className="w-full sm:max-w-lg bg-slate-900 border-t sm:border border-slate-700/80 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[90vh] text-white animate-in slide-in-from-bottom sm:zoom-in-95 duration-150 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Pinned Header */}
            <div className="shrink-0 px-4 pt-3.5 pb-3 sm:px-5 sm:pt-4 sm:pb-3.5 border-b border-slate-800">
              {/* Mobile Drag Handle Indicator */}
              <div className="w-10 h-1 bg-slate-700/80 rounded-full mx-auto sm:hidden mb-2.5" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Direct Reply with Photo</h4>
                    <p className="text-[11px] text-slate-400">Post update with your annotated photo to ticket thread</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDirectReplyDrawer(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Cancel reply"
                >
                  <X className="w-5 h-5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Body: Image attachment card + Note text */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-5 space-y-3.5 overscroll-contain">
              {/* Photo Attachment Preview Card */}
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 shrink-0">
                <div className="w-14 h-14 rounded-lg overflow-hidden border border-indigo-500/60 shrink-0 bg-slate-950 relative">
                  <img
                    src={annotatedPreviewUrl || currentImage.url}
                    alt="Annotated preview"
                    className="w-full h-full object-cover"
                  />
                  {currentStrokes.length > 0 && (
                    <span
                      className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900"
                      title="Includes drawn markings"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{currentImage.name}</p>
                  <p className="text-[11px] text-indigo-400 font-medium mt-0.5">
                    {currentStrokes.length > 0
                      ? `✓ Annotated with ${currentStrokes.length} marking${currentStrokes.length > 1 ? "s" : ""}`
                      : "Photo will be attached to your reply"}
                  </p>
                </div>
              </div>

              {/* Reply Note Textarea */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Your Reply Note:
                </label>
                <textarea
                  rows={3}
                  value={directReplyText}
                  onChange={(e) => setDirectReplyText(e.target.value)}
                  placeholder="Type your message (e.g. Check the marked issue with red arrow above, please look into this)..."
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-3 text-base sm:text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium resize-none shadow-inner"
                  autoFocus
                />
              </div>
            </div>

            {/* Pinned Bottom Footer Action Bar: ALWAYS pinned and visible above safe area & keyboard */}
            <div className="shrink-0 p-3 sm:p-4 bg-slate-900/98 border-t border-slate-800 flex items-center justify-end gap-2.5 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg">
              <button
                type="button"
                onClick={() => setShowDirectReplyDrawer(false)}
                className="px-4 py-2.5 sm:py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSendingDirectReply}
                onClick={handleSendDirectReply}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
              >
                {isSendingDirectReply ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Send Reply with Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM GALLERY THUMBNAIL STRIP (When multiple images exist and not in draw mode) */}
      {images.length > 1 && !showDirectReplyDrawer && !isDrawMode && (
        <footer className="w-full bg-slate-900/95 dark:bg-slate-950/95 border-t border-slate-800/80 backdrop-blur-md px-2 sm:px-6 py-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] shrink-0 z-30 pointer-events-auto touch-pan-x select-none">
          <div className="w-full flex items-center justify-between gap-2 max-w-6xl mx-auto">
            {/* Scrollable filmstrip with touch-pan-x and justify-start on mobile to prevent left-side clipping */}
            <div
              ref={thumbnailTrackRef}
              className="flex-1 flex items-center gap-2 overflow-x-auto touch-pan-x overscroll-x-contain py-1 px-1 justify-start sm:justify-center scroll-smooth scrollbar-thin"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {images.map((img, idx) => (
                <button
                  key={idx}
                  ref={(el) => {
                    thumbnailRefs.current[idx] = el;
                  }}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                    currentIndex === idx
                      ? "border-indigo-500 scale-105 shadow-md shadow-indigo-500/30 ring-2 ring-indigo-400/50"
                      : "border-slate-700 hover:border-slate-500 opacity-60 hover:opacity-100"
                  }`}
                  title={img.name}
                >
                  <img src={img.url} alt={img.name} className="w-full h-full object-cover pointer-events-none" />
                  {strokesByUrl[img.url]?.length > 0 && (
                    <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-indigo-500 ring-1 ring-white" />
                  )}
                </button>
              ))}
            </div>

            {/* Mobile quick direct reply button docked at bottom for 1-thumb tap */}
            {onDirectReply && !onSaveAnnotation && (
              <button
                type="button"
                onClick={handleOpenDirectReply}
                className="sm:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 active:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 shrink-0 cursor-pointer"
                title="Reply with this photo"
              >
                <Send className="w-3.5 h-3.5 shrink-0" />
                <span>Reply</span>
              </button>
            )}
          </div>
        </footer>
      )}

      {/* SINGLE IMAGE MOBILE ACTION BAR: When only 1 image exists, provide bottom 1-thumb actions on mobile */}
      {images.length === 1 && onDirectReply && !onSaveAnnotation && !showDirectReplyDrawer && !isDrawMode && (
        <footer className="sm:hidden w-full bg-slate-900/95 dark:bg-slate-950/95 border-t border-slate-800/80 backdrop-blur-md py-2.5 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0 z-30 pointer-events-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setIsDrawMode(true);
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs active:bg-slate-700"
          >
            <Pen className="w-3.5 h-3.5 text-indigo-400" />
            <span>Annotate</span>
          </button>
          <button
            type="button"
            onClick={handleOpenDirectReply}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-600 active:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Reply with Photo</span>
          </button>
        </footer>
      )}
    </div>,
    document.body
  );
}
