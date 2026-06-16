"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "@excalidraw/excalidraw/index.css";
import { ensureBoardId } from "../lib/boardId";
import { getOrCreateIdentity } from "../lib/identity";
import { getSocket } from "../lib/socket";
import { detectLanguageFromTimezone, getUserTimezone } from "../lib/geo";
import { loadCachedScene, saveCachedScene } from "../lib/sceneCache";
import GeoClock from "./GeoClock";
import CountdownTimer from "./CountdownTimer";
import VideoCall from "./VideoCall";

const VIEWPORT_PRELOAD_MARGIN = 200;
const CACHE_DEBOUNCE_MS = 1000;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 30;
const ZOOM_WHEEL_SENSITIVITY = 0.002;

function getStateForZoom(
  { viewportX, viewportY, nextZoom }: { viewportX: number; viewportY: number; nextZoom: number },
  appState: any
) {
  const appLayerX = viewportX - appState.offsetLeft;
  const appLayerY = viewportY - appState.offsetTop;
  const currentZoom = appState.zoom.value;
  const baseScrollX = appState.scrollX + (appLayerX - appLayerX / currentZoom);
  const baseScrollY = appState.scrollY + (appLayerY - appLayerY / currentZoom);
  const zoomOffsetScrollX = -(appLayerX - appLayerX / nextZoom);
  const zoomOffsetScrollY = -(appLayerY - appLayerY / nextZoom);
  return {
    scrollX: baseScrollX + zoomOffsetScrollX,
    scrollY: baseScrollY + zoomOffsetScrollY,
    zoom: { value: nextZoom }
  };
}

function getMissingVisibleFileIds(api: any): string[] {
  const appState = api.getAppState();
  const elements = api.getSceneElements();
  const files = api.getFiles();
  const zoomValue = appState.zoom?.value || 1;
  const margin = VIEWPORT_PRELOAD_MARGIN / zoomValue;
  const viewLeft = -appState.scrollX - margin;
  const viewTop = -appState.scrollY - margin;
  const viewRight = viewLeft + appState.width / zoomValue + margin * 2;
  const viewBottom = viewTop + appState.height / zoomValue + margin * 2;

  const missing = new Set<string>();
  for (const element of elements) {
    if (element.type !== "image" || !element.fileId || element.isDeleted) continue;
    if (files[element.fileId]) continue;

    const overlaps =
      element.x < viewRight && element.x + element.width > viewLeft && element.y < viewBottom && element.y + element.height > viewTop;
    if (overlaps) {
      missing.add(element.fileId);
    }
  }

  return Array.from(missing);
}

type ToolType =
  | "selection"
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "arrow"
  | "line"
  | "freedraw"
  | "text"
  | "image"
  | "eraser"
  | "hand"
  | "frame"
  | "magicframe"
  | "embeddable"
  | "laser";

type ActiveToolState = {
  type: ToolType;
  customType: null;
};

let reconcileElementsFn: any = null;
let exportToCanvasFn: any = null;

const Excalidraw = dynamic<any>(
  async () => {
    const mod = await import("@excalidraw/excalidraw");
    reconcileElementsFn = mod.reconcileElements;
    exportToCanvasFn = mod.exportToCanvas;
    return mod.Excalidraw;
  },
  {
    ssr: false
  }
);

const supportedLanguages = ["en", "es", "fr", "de", "ja", "ko", "pt", "ru", "it", "nl"];

function normalizeLanguage(locale: string) {
  const code = locale.split("-")[0];
  return supportedLanguages.includes(code) ? code : "en";
}

function sanitizeScene(scene: any) {
  const safeScene = {
    elements: Array.isArray(scene?.elements) ? scene.elements : [],
    appState: {
      ...scene?.appState,
      theme: scene?.appState?.theme || "light",
      exportBackground: scene?.appState?.exportBackground ?? true,
      viewBackgroundColor: scene?.appState?.viewBackgroundColor || "#ffffff",
      collaborators: Array.isArray(scene?.appState?.collaborators) ? scene.appState.collaborators : []
    },
    files: scene?.files || {}
  };

  if (!Array.isArray(safeScene.appState.collaborators)) {
    safeScene.appState.collaborators = [];
  }

  return safeScene;
}

type IconName =
  | "lock"
  | "hand"
  | "pointer"
  | "square"
  | "diamond"
  | "circle"
  | "arrow"
  | "line"
  | "pencil"
  | "text"
  | "image"
  | "eraser"
  | "frame"
  | "link"
  | "sections"
  | "present"
  | "stop"
  | "video"
  | "pdf"
  | "layerToBack"
  | "layerBackward"
  | "layerForward"
  | "layerToFront";

const iconPaths: Record<IconName, ReactNode> = {
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  hand: (
    <>
      <path d="M18 11V6a2 2 0 0 0-4 0v5" />
      <path d="M14 10V4a2 2 0 0 0-4 0v6" />
      <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </>
  ),
  pointer: <path d="M4.04 4.69a.5.5 0 0 1 .65-.65l16 6.5a.5.5 0 0 1-.06.95l-6.12 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.12a.5.5 0 0 1-.95.06z" />,
  square: <rect x="3" y="3" width="18" height="18" rx="2" />,
  diamond: <path d="M12 2 22 12 12 22 2 12Z" />,
  circle: <circle cx="12" cy="12" r="9" />,
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </>
  ),
  line: <path d="M5 12h14" />,
  pencil: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  text: (
    <>
      <path d="M4 7V4h16v3" />
      <path d="M9 20h6" />
      <path d="M12 4v16" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </>
  ),
  eraser: (
    <>
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.3 5.3c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </>
  ),
  video: (
    <>
      <rect x="2" y="5" width="14" height="14" rx="2" />
      <path d="m16 10 6-4v12l-6-4Z" />
    </>
  ),
  pdf: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M12 18v-5" />
      <path d="m9.5 15.5 2.5 2.5 2.5-2.5" />
    </>
  ),
  frame: (
    <>
      <path d="M3 7V3h4" />
      <path d="M17 3h4v4" />
      <path d="M21 17v4h-4" />
      <path d="M7 21H3v-4" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </>
  ),
  sections: (
    <>
      <rect x="3" y="3" width="18" height="6" rx="1.5" />
      <rect x="3" y="11" width="18" height="4" rx="1.5" />
      <rect x="3" y="17" width="18" height="4" rx="1.5" />
    </>
  ),
  present: <path d="M6 3v18l14-9Z" />,
  stop: <rect x="5" y="5" width="14" height="14" rx="1.5" />,
  layerToBack: (
    <>
      <path d="M12 5v9" />
      <path d="m8 10 4 4 4-4" />
      <path d="M4 19h16" />
    </>
  ),
  layerBackward: (
    <>
      <path d="M12 5v14" />
      <path d="m6 13 6 6 6-6" />
    </>
  ),
  layerForward: (
    <>
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </>
  ),
  layerToFront: (
    <>
      <path d="M4 5h16" />
      <path d="m8 14 4-4 4 4" />
      <path d="M12 10v9" />
    </>
  )
};

function ToolIcon({ name }: { name: IconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  );
}

type ToolOption = {
  label: string;
  tool: ToolType;
  icon: IconName;
  shortcut: string;
};

const toolOptions: ToolOption[] = [
  { label: "Selection", tool: "selection", icon: "pointer", shortcut: "1" },
  { label: "Rectangle", tool: "rectangle", icon: "square", shortcut: "2" },
  { label: "Diamond", tool: "diamond", icon: "diamond", shortcut: "3" },
  { label: "Ellipse", tool: "ellipse", icon: "circle", shortcut: "4" },
  { label: "Arrow", tool: "arrow", icon: "arrow", shortcut: "5" },
  { label: "Line", tool: "line", icon: "line", shortcut: "6" },
  { label: "Draw", tool: "freedraw", icon: "pencil", shortcut: "7" },
  { label: "Text", tool: "text", icon: "text", shortcut: "8" },
  { label: "Image", tool: "image", icon: "image", shortcut: "9" },
  { label: "Eraser", tool: "eraser", icon: "eraser", shortcut: "0" },
  { label: "Embed video", tool: "embeddable", icon: "video", shortcut: "e" }
];

const drawingTools: ToolType[] = ["rectangle", "diamond", "ellipse", "arrow", "line", "freedraw", "text"];

const strokeColors = ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00"];
const backgroundColors = ["transparent", "#ffc9c9", "#b2f2bb", "#a5d8ff", "#ffec99"];
const strokeWidths = [1, 2, 4];

export default function Whiteboard() {
  const [langCode, setLangCode] = useState("en");
  const initialData = useMemo(
    () =>
      sanitizeScene({
        elements: [],
        appState: { theme: "light", exportBackground: true, viewBackgroundColor: "#ffffff", collaborators: [] }
      }),
    []
  );
  const sceneRef = useRef<any>(initialData);
  const [activeTool, setActiveTool] = useState<ToolType>("selection");
  const [toolLocked, setToolLocked] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [currentStrokeColor, setCurrentStrokeColor] = useState("#1e1e1e");
  const [currentBackgroundColor, setCurrentBackgroundColor] = useState("transparent");
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(1);
  const [currentOpacity, setCurrentOpacity] = useState(100);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [isOffline, setIsOffline] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<{ socketId: string; name: string; color: string }[]>([]);
  const [apiReady, setApiReady] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  const [presenter, setPresenter] = useState<{ socketId: string; name: string } | null>(null);
  const [presenterSection, setPresenterSection] = useState<{ id: string; name: string; index: number } | null>(null);
  const [followPresenter, setFollowPresenter] = useState(true);
  const excalidrawAPI = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
  const remoteUpdateRef = useRef(false);
  const sceneUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorThrottleRef = useRef(0);
  const linkCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collaboratorsRef = useRef<Map<string, any>>(new Map());
  const lastSyncedVersionsRef = useRef<Map<string, number>>(new Map());
  const knownFileIdsRef = useRef<Set<string>>(new Set());
  const requestedFileIdsRef = useRef<Set<string>>(new Set());
  const cacheTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPresentingRef = useRef(false);
  const followPresenterRef = useRef(true);
  const sectionsSignatureRef = useRef("");
  const boardId = useMemo(() => ensureBoardId(), []);
  const identity = useMemo(() => getOrCreateIdentity(), []);

  const showStylePanel = drawingTools.includes(activeTool) || (activeTool === "selection" && hasSelection);

  const uiOptions = useMemo(
    () => ({
      canvasActions: {
        loadScene: true,
        saveToActiveFile: true,
        export: {
          saveFileToDisk: true
        },
        saveAsImage: true
      },
      tools: {
        image: true
      }
    }),
    []
  );

  useEffect(() => {
    const geoLanguage = detectLanguageFromTimezone(getUserTimezone());
    if (geoLanguage) {
      setLangCode(geoLanguage);
      return;
    }

    const browserLocale = navigator.language || navigator.languages?.[0] || "en";
    setLangCode(normalizeLanguage(browserLocale));
  }, []);

  useEffect(() => {
    if (!apiReady) return;

    let cancelled = false;
    loadCachedScene(boardId).then((cached) => {
      if (cancelled || !cached) return;

      const api = excalidrawAPI.current;
      if (!api || !reconcileElementsFn) return;

      const localElements = api.getSceneElementsIncludingDeleted();
      const appState = api.getAppState();
      const reconciled = reconcileElementsFn(localElements, cached.elements, appState);

      remoteUpdateRef.current = true;
      api.updateScene({ elements: reconciled });

      const cachedFiles = Object.values(cached.files || {});
      if (cachedFiles.length > 0) {
        api.addFiles(cachedFiles);
        for (const fileId of Object.keys(cached.files)) {
          knownFileIdsRef.current.add(fileId);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [apiReady, boardId]);

  useEffect(() => {
    if (!apiReady) return;

    const socket = getSocket();
    socketRef.current = socket;

    function markSynced(elements: any[]) {
      for (const element of elements) {
        lastSyncedVersionsRef.current.set(element.id, element.version);
      }
    }

    function requestVisibleFiles() {
      const api = excalidrawAPI.current;
      if (!api) return;

      const missing = getMissingVisibleFileIds(api).filter((fileId) => !requestedFileIdsRef.current.has(fileId));
      if (missing.length === 0) return;

      missing.forEach((fileId) => requestedFileIdsRef.current.add(fileId));
      socket.emit("request-files", { fileIds: missing });
    }

    function applyRemoteElements(elements: any[]) {
      const api = excalidrawAPI.current;
      if (!api || !reconcileElementsFn) return null;

      const localElements = api.getSceneElementsIncludingDeleted();
      const appState = api.getAppState();
      const reconciled = reconcileElementsFn(localElements, elements, appState);

      remoteUpdateRef.current = true;
      api.updateScene({ elements: reconciled });
      return reconciled;
    }

    function handleInit({ scene }: any) {
      const api = excalidrawAPI.current;
      if (!api || !reconcileElementsFn) return;

      const sanitized = sanitizeScene(scene);
      const localElements = api.getSceneElementsIncludingDeleted();
      const appState = api.getAppState();
      const reconciled = reconcileElementsFn(localElements, sanitized.elements, appState);

      sceneRef.current = { ...sanitized, elements: reconciled };
      remoteUpdateRef.current = true;
      api.updateScene({ elements: reconciled });

      markSynced(sanitized.elements);
      for (const fileId of Object.keys(sanitized.files || {})) {
        knownFileIdsRef.current.add(fileId);
      }

      // Re-send any locally newer edits the server doesn't know about yet
      // (e.g. made while offline, restored from the local cache, or never acked).
      const unsynced = reconciled.filter((element: any) => lastSyncedVersionsRef.current.get(element.id) !== element.version);
      if (unsynced.length > 0) {
        markSynced(unsynced);
        socket.emit("scene-update", { elements: unsynced });
      }

      requestVisibleFiles();
    }

    function handleSceneUpdate({ elements, socketId }: any) {
      if (socketId === socket.id) return;
      const reconciled = applyRemoteElements(elements);
      if (reconciled) {
        markSynced(elements);
        requestVisibleFiles();
      }
    }

    function handleFileData({ files }: any) {
      const api = excalidrawAPI.current;
      if (!api || !files) return;

      const fileList = Object.values(files) as any[];
      if (fileList.length === 0) return;

      api.addFiles(fileList);
      const scene = sceneRef.current || { elements: [], appState: {}, files: {} };
      scene.files = { ...(scene.files || {}), ...files };
      sceneRef.current = scene;

      for (const fileId of Object.keys(files)) {
        knownFileIdsRef.current.add(fileId);
        requestedFileIdsRef.current.delete(fileId);
      }

      saveCachedScene(boardId, sceneRef.current);
    }

    function handleScrollChange() {
      requestVisibleFiles();
    }

    function handleCursorUpdate({ socketId, pointer, name, color }: any) {
      const api = excalidrawAPI.current;
      if (!api) return;

      collaboratorsRef.current.set(socketId, {
        pointer,
        username: name,
        color: { background: color, stroke: color }
      });
      api.updateScene({ collaborators: new Map(collaboratorsRef.current) });
    }

    function handleCollaboratorLeft({ socketId }: any) {
      const api = excalidrawAPI.current;
      if (!api) return;

      collaboratorsRef.current.delete(socketId);
      api.updateScene({ collaborators: new Map(collaboratorsRef.current) });
    }

    function handleConnect() {
      setIsOffline(false);
      socket.emit("join", { boardId, name: identity.name, color: identity.color });
    }

    function handleDisconnect() {
      setIsOffline(true);
      setOnlineUsers([]);
    }

    function handlePresence({ users }: any) {
      setOnlineUsers(users ?? []);
    }

    function handlePresenterUpdate({ presenter: nextPresenter }: any) {
      setPresenter(nextPresenter ?? null);
      if (!nextPresenter) {
        setPresenterSection(null);
      }
      if (!nextPresenter || nextPresenter.socketId === socket.id) {
        setIsPresenting(Boolean(nextPresenter && nextPresenter.socketId === socket.id));
      } else {
        setIsPresenting(false);
      }
    }

    function handlePresenterSection({ id, name, index }: any) {
      setPresenterSection({ id, name, index });

      const api = excalidrawAPI.current;
      if (!api || isPresentingRef.current || !followPresenterRef.current) return;

      const elements = api.getSceneElements();
      const frame = elements.find((el: any) => el.id === id);
      if (frame) {
        api.scrollToContent(frame, { fitToContent: true, animate: true });
      }
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("init", handleInit);
    socket.on("scene-update", handleSceneUpdate);
    socket.on("file-data", handleFileData);
    socket.on("cursor-update", handleCursorUpdate);
    socket.on("collaborator-left", handleCollaboratorLeft);
    socket.on("presence", handlePresence);
    socket.on("presenter-update", handlePresenterUpdate);
    socket.on("presenter-section", handlePresenterSection);

    const unsubscribeScroll = excalidrawAPI.current?.onScrollChange?.(handleScrollChange);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("init", handleInit);
      socket.off("scene-update", handleSceneUpdate);
      socket.off("file-data", handleFileData);
      socket.off("cursor-update", handleCursorUpdate);
      socket.off("collaborator-left", handleCollaboratorLeft);
      socket.off("presence", handlePresence);
      socket.off("presenter-update", handlePresenterUpdate);
      socket.off("presenter-section", handlePresenterSection);
      unsubscribeScroll?.();
      if (sceneUpdateTimerRef.current) {
        clearTimeout(sceneUpdateTimerRef.current);
      }
      if (cacheTimerRef.current) {
        clearTimeout(cacheTimerRef.current);
      }
      if (linkCopiedTimerRef.current) {
        clearTimeout(linkCopiedTimerRef.current);
      }
    };
  }, [apiReady, boardId, identity]);

  useEffect(() => {
    isPresentingRef.current = isPresenting;
  }, [isPresenting]);

  useEffect(() => {
    followPresenterRef.current = followPresenter;
  }, [followPresenter]);

  const handleToggleSections = () => {
    setSectionsOpen((open) => !open);
  };

  const handleTogglePresent = () => {
    const socket = socketRef.current;
    if (!socket) return;

    if (isPresenting) {
      socket.emit("presenter-stop");
      setIsPresenting(false);
    } else {
      socket.emit("presenter-start", { name: identity.name });
      setIsPresenting(true);
    }
  };

  const handleZoomIn = () => {
    const api = excalidrawAPI.current;
    if (!api) return;
    const appState = api.getAppState();
    const nextZoom = Math.min(MAX_ZOOM, appState.zoom.value * 1.25);
    api.updateScene({
      appState: getStateForZoom(
        { viewportX: appState.width / 2, viewportY: appState.height / 2, nextZoom },
        appState
      )
    });
  };

  const handleZoomOut = () => {
    const api = excalidrawAPI.current;
    if (!api) return;
    const appState = api.getAppState();
    const nextZoom = Math.max(MIN_ZOOM, appState.zoom.value / 1.25);
    api.updateScene({
      appState: getStateForZoom(
        { viewportX: appState.width / 2, viewportY: appState.height / 2, nextZoom },
        appState
      )
    });
  };

  const handleZoomReset = () => {
    const api = excalidrawAPI.current;
    if (!api) return;
    const appState = api.getAppState();
    api.updateScene({
      appState: getStateForZoom(
        { viewportX: appState.width / 2, viewportY: appState.height / 2, nextZoom: 1 },
        appState
      )
    });
  };

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handleWheelZoom = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey) return;

      const api = excalidrawAPI.current;
      if (!api) return;

      event.preventDefault();
      event.stopPropagation();

      const appState = api.getAppState();
      const currentZoom = appState.zoom.value;
      const nextZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, currentZoom * Math.exp(-event.deltaY * ZOOM_WHEEL_SENSITIVITY))
      );
      if (nextZoom === currentZoom) return;

      api.updateScene({
        appState: getStateForZoom(
          { viewportX: event.clientX, viewportY: event.clientY, nextZoom },
          appState
        )
      });
    };

    wrapper.addEventListener("wheel", handleWheelZoom, { passive: false, capture: true });
    return () => wrapper.removeEventListener("wheel", handleWheelZoom, { capture: true });
  }, [apiReady]);

  const handleSectionSelect = (section: any, index: number) => {
    const api = excalidrawAPI.current;
    if (!api) return;

    api.scrollToContent(section, { fitToContent: true, animate: true });

    if (isPresenting) {
      const name = section.name || `Section ${index + 1}`;
      socketRef.current?.emit("presenter-section", { id: section.id, name, index });
      setPresenterSection({ id: section.id, name, index });
    }
  };

  const handleToolSelect = (tool: ToolType) => {
    setActiveTool(tool);
    excalidrawAPI.current?.setActiveTool({ type: tool, customType: null, locked: toolLocked });
  };

  const handleToggleLock = () => {
    const next = !toolLocked;
    setToolLocked(next);
    excalidrawAPI.current?.setActiveTool({ type: activeTool, customType: null, locked: next });
  };

  const handleExportPdf = async () => {
    const api = excalidrawAPI.current;
    if (!api || !exportToCanvasFn) return;

    const elements = api.getSceneElements();
    const files = api.getFiles();
    const appState = api.getAppState();
    const exportAppState = { exportBackground: true, viewBackgroundColor: appState.viewBackgroundColor || "#ffffff" };

    const frames = elements.filter((el: any) => el.type === "frame" || el.type === "magicframe");
    const selectedIds = appState.selectedElementIds || {};
    const selected = elements.filter((el: any) => selectedIds[el.id]);

    let canvases: HTMLCanvasElement[];
    if (frames.length > 0) {
      canvases = [];
      for (const frame of frames) {
        const canvas = await exportToCanvasFn({ elements, appState: exportAppState, files, exportingFrame: frame });
        canvases.push(canvas);
      }
    } else if (selected.length > 0) {
      canvases = [await exportToCanvasFn({ elements: selected, appState: exportAppState, files })];
    } else {
      canvases = [await exportToCanvasFn({ elements, appState: exportAppState, files })];
    }

    const { jsPDF } = await import("jspdf");
    let pdf: any = null;

    for (const canvas of canvases) {
      const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
      const page = pdf
        ? pdf.addPage([canvas.width, canvas.height], orientation)
        : (pdf = new jsPDF({ orientation, unit: "px", format: [canvas.width, canvas.height] }));
      void page;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
    }

    pdf.save(`whiteboard-${boardId}.pdf`);
  };

  const applyStyle = (property: "strokeColor" | "backgroundColor" | "strokeWidth" | "opacity", value: any) => {
    const api = excalidrawAPI.current;
    if (!api) return;

    const appState = api.getAppState();
    const elements = api.getSceneElements();
    const selectedIds = appState.selectedElementIds || {};
    const hasSelected = Object.keys(selectedIds).some((id) => selectedIds[id]);

    const updatedElements = hasSelected
      ? elements.map((el: any) => (selectedIds[el.id] ? { ...el, [property]: value } : el))
      : elements;

    const currentItemKey = `currentItem${property[0].toUpperCase()}${property.slice(1)}`;

    api.updateScene({
      elements: updatedElements,
      appState: { [currentItemKey]: value }
    });

    if (property === "strokeColor") setCurrentStrokeColor(value);
    if (property === "backgroundColor") setCurrentBackgroundColor(value);
    if (property === "strokeWidth") setCurrentStrokeWidth(value);
    if (property === "opacity") setCurrentOpacity(value);
  };

  const moveLayer = (direction: "toBack" | "backward" | "forward" | "toFront") => {
    const api = excalidrawAPI.current;
    if (!api) return;

    const appState = api.getAppState();
    const elements = api.getSceneElements();
    const selectedIds = appState.selectedElementIds || {};
    if (!Object.keys(selectedIds).some((id) => selectedIds[id])) return;

    let newElements;
    if (direction === "toFront") {
      const selected = elements.filter((el: any) => selectedIds[el.id]);
      const rest = elements.filter((el: any) => !selectedIds[el.id]);
      newElements = [...rest, ...selected];
    } else if (direction === "toBack") {
      const selected = elements.filter((el: any) => selectedIds[el.id]);
      const rest = elements.filter((el: any) => !selectedIds[el.id]);
      newElements = [...selected, ...rest];
    } else if (direction === "forward") {
      newElements = [...elements];
      for (let i = newElements.length - 2; i >= 0; i--) {
        if (selectedIds[newElements[i].id] && !selectedIds[newElements[i + 1].id]) {
          [newElements[i], newElements[i + 1]] = [newElements[i + 1], newElements[i]];
        }
      }
    } else {
      newElements = [...elements];
      for (let i = 1; i < newElements.length; i++) {
        if (selectedIds[newElements[i].id] && !selectedIds[newElements[i - 1].id]) {
          [newElements[i], newElements[i - 1]] = [newElements[i - 1], newElements[i]];
        }
      }
    }

    api.updateScene({ elements: newElements });
  };

  return (
    <div className="whiteboard-shell">
      <div className="board-wrapper">
        <div className="right-clock-row">
          <CountdownTimer userName={identity.name} />
          <GeoClock />
        </div>
        <VideoCall identity={identity} />
        {showStylePanel ? (
          <div className="style-panel">
            <div className="panel-section">
              <span className="panel-label">Stroke</span>
              <div className="swatch-row">
                {strokeColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={color === currentStrokeColor ? "swatch active" : "swatch"}
                    style={{ background: color }}
                    onClick={() => applyStyle("strokeColor", color)}
                    aria-label={`Stroke color ${color}`}
                  />
                ))}
              </div>
            </div>

            <div className="panel-section">
              <span className="panel-label">Background</span>
              <div className="swatch-row">
                {backgroundColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={
                      color === currentBackgroundColor
                        ? "swatch active" + (color === "transparent" ? " transparent" : "")
                        : "swatch" + (color === "transparent" ? " transparent" : "")
                    }
                    style={color === "transparent" ? undefined : { background: color }}
                    onClick={() => applyStyle("backgroundColor", color)}
                    aria-label={`Background color ${color}`}
                  />
                ))}
              </div>
            </div>

            <div className="panel-section">
              <span className="panel-label">Stroke width</span>
              <div className="option-row">
                {strokeWidths.map((width) => (
                  <button
                    key={width}
                    type="button"
                    className={width === currentStrokeWidth ? "option-btn active" : "option-btn"}
                    onClick={() => applyStyle("strokeWidth", width)}
                    aria-label={`Stroke width ${width}`}
                  >
                    <div className="width-bar" style={{ height: width }} />
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-section">
              <span className="panel-label">Opacity</span>
              <input
                type="range"
                min={0}
                max={100}
                step={10}
                value={currentOpacity}
                onChange={(event) => applyStyle("opacity", Number(event.target.value))}
                className="opacity-slider"
              />
              <div className="opacity-scale">
                <span>0</span>
                <span>100</span>
              </div>
            </div>

            <div className="panel-section">
              <span className="panel-label">Layers</span>
              <div className="option-row">
                <button type="button" className="option-btn" onClick={() => moveLayer("toBack")} title="Send to back" aria-label="Send to back">
                  <ToolIcon name="layerToBack" />
                </button>
                <button type="button" className="option-btn" onClick={() => moveLayer("backward")} title="Send backward" aria-label="Send backward">
                  <ToolIcon name="layerBackward" />
                </button>
                <button type="button" className="option-btn" onClick={() => moveLayer("forward")} title="Bring forward" aria-label="Bring forward">
                  <ToolIcon name="layerForward" />
                </button>
                <button type="button" className="option-btn" onClick={() => moveLayer("toFront")} title="Bring to front" aria-label="Bring to front">
                  <ToolIcon name="layerToFront" />
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {onlineUsers.length > 0 ? (
          <div className="presence-bar" title={`${onlineUsers.length} online`}>
            <div className="presence-avatars">
              {onlineUsers.map((user) => (
                <span
                  key={user.socketId}
                  className="presence-avatar"
                  style={{ backgroundColor: user.color }}
                  title={user.name}
                >
                  {(user.name || "?").charAt(0).toUpperCase()}
                </span>
              ))}
            </div>
            <span className="presence-count">{onlineUsers.length} online</span>
          </div>
        ) : null}

        <div className="floating-toolbar">
          <div className="toolbar-group">
            <button
              type="button"
              className={toolLocked ? "icon-btn active" : "icon-btn"}
              onClick={handleToggleLock}
              title="Keep selected tool active after drawing"
              aria-label="Toggle tool lock"
            >
              <ToolIcon name="lock" />
            </button>
            <button
              type="button"
              className={activeTool === "hand" ? "icon-btn active" : "icon-btn"}
              onClick={() => handleToolSelect("hand")}
              title="Hand (pan)"
              aria-label="Hand tool"
            >
              <ToolIcon name="hand" />
            </button>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-group">
            {toolOptions.map((option) => (
              <button
                key={option.tool}
                type="button"
                className={option.tool === activeTool ? "icon-btn active" : "icon-btn"}
                onClick={() => handleToolSelect(option.tool)}
                title={`${option.label} (${option.shortcut})`}
                aria-label={option.label}
              >
                <ToolIcon name={option.icon} />
                <span className="shortcut">{option.shortcut}</span>
              </button>
            ))}
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-group">
            <button
              type="button"
              className={activeTool === "frame" ? "icon-btn active" : "icon-btn"}
              onClick={() => handleToolSelect("frame")}
              title="Frame tool (group elements into a frame)"
              aria-label="Frame tool"
            >
              <ToolIcon name="frame" />
            </button>
            <button
              type="button"
              className={sectionsOpen ? "icon-btn active" : "icon-btn"}
              onClick={handleToggleSections}
              title="Sections (slide view)"
              aria-label="Toggle sections panel"
            >
              <ToolIcon name="sections" />
            </button>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-group">
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                const url = `${window.location.origin}${window.location.pathname}?board=${boardId}`;
                navigator.clipboard
                  .writeText(url)
                  .then(() => {
                    setLinkCopied(true);
                    if (linkCopiedTimerRef.current) {
                      clearTimeout(linkCopiedTimerRef.current);
                    }
                    linkCopiedTimerRef.current = setTimeout(() => setLinkCopied(false), 2000);
                  })
                  .catch(() => {
                    console.error("Failed to copy collaboration link");
                  });
              }}
              title="Copy collaboration link"
              aria-label="Copy collaboration link"
            >
              <ToolIcon name="link" />
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={handleExportPdf}
              title="Export to PDF (frames, selection, or whole board)"
              aria-label="Export to PDF"
            >
              <ToolIcon name="pdf" />
            </button>
          </div>

          <div className="toolbar-divider" />

          <span className={isOffline ? "status-dot offline" : "status-dot online"} title={isOffline ? "Offline" : "Connected"} />

          {linkCopied ? <span className="link-toast">Link copied</span> : null}
        </div>

        {presenter && !isPresenting ? (
          <div className="presenter-banner">
            <span className="presenter-banner-text">
              <strong>{presenter.name || "Someone"}</strong> is presenting
              {presenterSection ? ` · ${presenterSection.name}` : ""}
            </span>
            <button
              type="button"
              className={followPresenter ? "presenter-banner-btn active" : "presenter-banner-btn"}
              onClick={() => setFollowPresenter((follow) => !follow)}
            >
              {followPresenter ? "Following" : "Browse freely"}
            </button>
          </div>
        ) : null}

        {sectionsOpen ? (
          <div className="sections-panel">
            <div className="sections-header">
              <span className="sections-title">Sections</span>
              <button
                type="button"
                className={isPresenting ? "present-btn active" : "present-btn"}
                onClick={handleTogglePresent}
                title={isPresenting ? "Stop presenting" : "Start presenting"}
              >
                <ToolIcon name={isPresenting ? "stop" : "present"} />
                {isPresenting ? "Stop" : "Present"}
              </button>
            </div>

            {sections.length === 0 ? (
              <p className="sections-empty">Add frames to the board to create sections.</p>
            ) : (
              <ul className="sections-list">
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <button
                      type="button"
                      className={presenterSection?.id === section.id ? "section-item active" : "section-item"}
                      onClick={() => handleSectionSelect(section, index)}
                    >
                      <span className="section-index">{index + 1}</span>
                      <span className="section-name">{section.name || `Section ${index + 1}`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <div className="zoom-controls">
          <button
            type="button"
            className="zoom-btn"
            onClick={handleZoomOut}
            title="Zoom out"
            aria-label="Zoom out"
            disabled={currentZoom <= MIN_ZOOM}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
            </svg>
          </button>
          <button
            type="button"
            className="zoom-pct"
            onClick={handleZoomReset}
            title="Reset to 100%"
            aria-label="Reset zoom"
          >
            {Math.round(currentZoom * 100)}%
          </button>
          <button
            type="button"
            className="zoom-btn"
            onClick={handleZoomIn}
            title="Zoom in"
            aria-label="Zoom in"
            disabled={currentZoom >= MAX_ZOOM}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        <div className="whiteboard-wrapper" ref={wrapperRef}>
          <Excalidraw
            initialData={initialData}
            langCode={langCode}
            UIOptions={uiOptions}
            excalidrawAPI={(api: any) => {
              excalidrawAPI.current = api;
              setApiReady(true);
            }}
            onPointerDown={(activeTool: any) => {
              if (activeTool?.type) {
                setActiveTool(activeTool.type);
              }
            }}
            onPointerUpdate={(payload: any) => {
              const now = Date.now();
              if (now - cursorThrottleRef.current < 50) return;
              cursorThrottleRef.current = now;

              socketRef.current?.emit("cursor-update", {
                pointer: payload.pointer,
                name: identity.name,
                color: identity.color
              });
            }}
            onChange={(elements: any, appState: any, files: any) => {
              const scene = sanitizeScene({ elements, appState, files });
              sceneRef.current = scene;

              setHasSelection(Object.values(appState.selectedElementIds || {}).some(Boolean));
              setCurrentZoom(appState.zoom?.value ?? 1);
              setCurrentStrokeColor(appState.currentItemStrokeColor ?? "#1e1e1e");
              setCurrentBackgroundColor(appState.currentItemBackgroundColor ?? "transparent");
              setCurrentStrokeWidth(appState.currentItemStrokeWidth ?? 1);
              setCurrentOpacity(appState.currentItemOpacity ?? 100);

              const frames = elements
                .filter((el: any) => (el.type === "frame" || el.type === "magicframe") && !el.isDeleted)
                .sort((a: any, b: any) => a.y - b.y || a.x - b.x);
              const signature = frames.map((f: any) => `${f.id}:${f.name || ""}:${f.x}:${f.y}:${f.width}:${f.height}`).join("|");
              if (signature !== sectionsSignatureRef.current) {
                sectionsSignatureRef.current = signature;
                setSections(frames);
              }

              if (cacheTimerRef.current) {
                clearTimeout(cacheTimerRef.current);
              }
              cacheTimerRef.current = setTimeout(() => {
                saveCachedScene(boardId, scene);
              }, CACHE_DEBOUNCE_MS);

              if (remoteUpdateRef.current) {
                remoteUpdateRef.current = false;
                return;
              }

              const newFileIds = Object.keys(files || {}).filter((fileId) => !knownFileIdsRef.current.has(fileId));
              if (newFileIds.length > 0) {
                const newFiles: Record<string, any> = {};
                for (const fileId of newFileIds) {
                  newFiles[fileId] = files[fileId];
                  knownFileIdsRef.current.add(fileId);
                }
                socketRef.current?.emit("file-upload", { files: newFiles });
              }

              if (sceneUpdateTimerRef.current) {
                clearTimeout(sceneUpdateTimerRef.current);
              }
              sceneUpdateTimerRef.current = setTimeout(() => {
                const changed = elements.filter(
                  (element: any) => lastSyncedVersionsRef.current.get(element.id) !== element.version
                );
                if (changed.length === 0) return;

                for (const element of changed) {
                  lastSyncedVersionsRef.current.set(element.id, element.version);
                }
                socketRef.current?.emit("scene-update", { elements: changed });
              }, 300);
            }}
          />
        </div>
      </div>

      <style jsx>{`
        .style-panel {
          position: absolute;
          top: 16px;
          left: 16px;
          z-index: 10;
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 200px;
          padding: 16px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12), 0 2px 4px rgba(15, 23, 42, 0.08);
        }

        .panel-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .panel-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: #4b5563;
        }

        .swatch-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .swatch {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          padding: 0;
        }

        .swatch.transparent {
          background-image:
            linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%),
            linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%);
          background-size: 8px 8px;
          background-position: 0 0, 4px 4px;
          background-color: #ffffff;
        }

        .swatch.active {
          outline: 2px solid #6965db;
          outline-offset: 1px;
        }

        .option-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .option-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 32px;
          border-radius: 8px;
          background: #f1f3f5;
          border: none;
          color: #1e1e1e;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .option-btn:hover {
          background: #e9ecef;
        }

        .option-btn.active {
          background: #e0dfff;
          color: #6965db;
        }

        .width-bar {
          width: 16px;
          border-radius: 999px;
          background: currentColor;
        }

        .opacity-slider {
          width: 100%;
          accent-color: #6965db;
        }

        .opacity-scale {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .floating-toolbar {
          position: absolute;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12), 0 2px 4px rgba(15, 23, 42, 0.08);
        }

        .toolbar-group {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .icon-btn {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          padding: 0;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: #1e1e1e;
          transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
        }

        .icon-btn:hover {
          background: #f1f0ff;
        }

        .icon-btn.active {
          background: #e0dfff;
          color: #6965db;
          box-shadow: inset 0 0 0 1.5px rgba(105, 101, 219, 0.45);
        }

        .icon-btn.active::after {
          content: "";
          position: absolute;
          bottom: 3px;
          left: 50%;
          transform: translateX(-50%);
          width: 14px;
          height: 2px;
          border-radius: 1px;
          background: #6965db;
        }

        .icon-btn:focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }

        .icon-btn .shortcut {
          position: absolute;
          bottom: 2px;
          right: 4px;
          font-size: 9px;
          line-height: 1;
          color: #9ca3af;
        }

        .icon-btn.active .shortcut {
          color: #6965db;
        }

        .toolbar-divider {
          width: 1px;
          height: 24px;
          margin: 0 2px;
          background: #e5e7eb;
          flex-shrink: 0;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin: 0 6px;
          flex-shrink: 0;
        }

        .status-dot.online {
          background: #2f9e44;
        }

        .status-dot.offline {
          background: #e03131;
        }

        .sections-panel {
          position: absolute;
          top: 72px;
          left: 16px;
          z-index: 10;
          display: flex;
          flex-direction: column;
          width: 220px;
          max-height: calc(100% - 96px);
          padding: 10px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12), 0 2px 4px rgba(15, 23, 42, 0.08);
          overflow: hidden;
        }

        .sections-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 8px;
          margin-bottom: 4px;
          border-bottom: 1px solid #e5e7eb;
        }

        .sections-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: #1e1e1e;
        }

        .present-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #1e1e1e;
          background: #f1f0ff;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        .present-btn :global(svg) {
          width: 14px;
          height: 14px;
        }

        .present-btn.active {
          background: #e03131;
          color: #ffffff;
        }

        .sections-empty {
          margin: 8px 0 0;
          font-size: 0.8rem;
          color: #9ca3af;
        }

        .sections-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin: 4px 0 0;
          padding: 0;
          list-style: none;
          overflow-y: auto;
        }

        .section-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px;
          font-size: 0.85rem;
          color: #1e1e1e;
          text-align: left;
          background: transparent;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .section-item:hover {
          background: #f1f0ff;
        }

        .section-item.active {
          background: #e0dfff;
          color: #6965db;
        }

        .section-index {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          flex-shrink: 0;
          font-size: 0.75rem;
          font-weight: 700;
          border-radius: 50%;
          background: #f1f0ff;
          color: #6965db;
        }

        .section-item.active .section-index {
          background: #6965db;
          color: #ffffff;
        }

        .section-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .presenter-banner {
          position: absolute;
          top: 72px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          background: #1e1e1e;
          color: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.18);
          font-size: 0.85rem;
          white-space: nowrap;
        }

        .presenter-banner-btn {
          padding: 4px 10px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #1e1e1e;
          background: #ffffff;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        .presenter-banner-btn.active {
          background: #6965db;
          color: #ffffff;
        }

        .presence-bar {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12), 0 2px 4px rgba(15, 23, 42, 0.08);
        }

        .presence-avatars {
          display: flex;
        }

        .presence-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          color: #ffffff;
          font-size: 0.75rem;
          font-weight: 600;
          border: 2px solid #ffffff;
          margin-left: -8px;
        }

        .presence-avatar:first-child {
          margin-left: 0;
        }

        .presence-count {
          font-size: 0.8rem;
          color: #1e1e1e;
          white-space: nowrap;
        }

        @media (max-width: 640px) {
          .presence-bar {
            top: 8px;
            right: 8px;
            padding: 4px 8px;
          }

          .presence-count {
            display: none;
          }
        }

        .presenter-banner-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .right-clock-row {
          position: absolute;
          top: 64px;
          right: 16px;
          z-index: 10;
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .zoom-controls {
          position: absolute;
          bottom: 16px;
          left: 16px;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 4px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12), 0 2px 4px rgba(15, 23, 42, 0.08);
        }

        .zoom-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #1e1e1e;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .zoom-btn:hover:not(:disabled) {
          background: #f1f0ff;
          color: #6965db;
        }

        .zoom-btn:disabled {
          opacity: 0.35;
          cursor: default;
        }

        .zoom-pct {
          min-width: 48px;
          height: 32px;
          padding: 0 6px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #1e1e1e;
          font-size: 0.8rem;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .zoom-pct:hover {
          background: #f1f0ff;
          color: #6965db;
        }

        .link-toast {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          padding: 4px 10px;
          font-size: 0.8rem;
          color: #ffffff;
          background: #1e1e1e;
          border-radius: 6px;
          white-space: nowrap;
        }

        @media (max-width: 640px) {
          .floating-toolbar {
            top: auto;
            bottom: 8px;
            max-width: calc(100vw - 16px);
            overflow-x: auto;
          }

          .icon-btn {
            width: 36px;
            height: 36px;
            flex-shrink: 0;
          }

          .icon-btn .shortcut {
            display: none;
          }

          .link-toast {
            top: auto;
            bottom: calc(100% + 8px);
          }

          .style-panel {
            top: auto;
            bottom: 56px;
            left: 8px;
            right: 8px;
            width: auto;
            max-width: none;
            flex-direction: row;
            align-items: center;
            gap: 14px;
            padding: 10px 12px;
            overflow-x: auto;
          }

          .panel-section {
            flex-direction: row;
            align-items: center;
            gap: 6px;
            flex-shrink: 0;
          }

          .panel-label {
            white-space: nowrap;
          }

          .opacity-slider {
            width: 80px;
          }

          .opacity-scale {
            display: none;
          }

          .sections-panel {
            width: calc(100vw - 32px);
            max-width: 280px;
            max-height: calc(100% - 152px);
          }

          .presenter-banner {
            max-width: calc(100vw - 32px);
          }
        }
      `}</style>

      <style jsx global>{`
        .excalidraw .ToolIcon,
        .excalidraw .ToolIcon__icon,
        .excalidraw .ToolIcon__hidden,
        .excalidraw .ToolIcon__keybinding,
        .excalidraw .ToolIcon__overlay {
          display: none !important;
        }

        .excalidraw .App-menu,
        .excalidraw .top-right,
        .excalidraw .top-right .ToolIcon {
          display: none !important;
        }

        .excalidraw .canvas {
          margin-top: 0 !important;
        }
      `}</style>
    </div>
  );
}
