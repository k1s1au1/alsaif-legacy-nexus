import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import "./legacy-reference-fixes.css";

const SVG_NS = "http://www.w3.org/2000/svg";

function createSvgElement<K extends keyof SVGElementTagNameMap>(tag: K) {
  return document.createElementNS(SVG_NS, tag);
}

function findTreeSvg() {
  const canvas = document.querySelector<HTMLElement>(".family-tree-canvas");
  if (!canvas) return null;

  return (
    Array.from(canvas.querySelectorAll<SVGSVGElement>(".rd3t-tree-container > svg")).find(
      (svg) => !svg.hasAttribute("data-minimap-repaired"),
    ) ?? null
  );
}

function findTreeGroup(svg: SVGSVGElement) {
  return svg.querySelector<SVGGElement>("g.rd3t-g") ?? svg.querySelector<SVGGElement>("g");
}

function compactNodes(treeClone: SVGGElement) {
  let nodeGroups = Array.from(
    treeClone.querySelectorAll<SVGGElement>("g.rd3t-node, g.rd3t-leaf-node"),
  );

  if (nodeGroups.length === 0) {
    nodeGroups = Array.from(treeClone.querySelectorAll<SVGGElement>("g.node-group"));
  }

  nodeGroups.forEach((node, index) => {
    while (node.firstChild) node.removeChild(node.firstChild);
    const card = createSvgElement("rect");
    card.setAttribute("x", "-22");
    card.setAttribute("y", "-14");
    card.setAttribute("width", "44");
    card.setAttribute("height", "28");
    card.setAttribute("rx", "8");
    card.setAttribute("class", index === 0 ? "legacy-mini-root" : "legacy-mini-node");
    node.appendChild(card);
  });
}

function makeMinimap(sourceSvg: SVGSVGElement, target: HTMLElement) {
  const sourceGroup = findTreeGroup(sourceSvg);
  if (!sourceGroup) return null;

  let bbox: DOMRect;
  try {
    bbox = sourceGroup.getBBox();
  } catch {
    return null;
  }

  if (!Number.isFinite(bbox.width) || !Number.isFinite(bbox.height) || bbox.width < 1 || bbox.height < 1) {
    return null;
  }

  const padX = Math.max(70, bbox.width * 0.055);
  const padY = Math.max(60, bbox.height * 0.07);
  const viewBox = {
    x: bbox.x - padX,
    y: bbox.y - padY,
    width: bbox.width + padX * 2,
    height: bbox.height + padY * 2,
  };

  const miniSvg = createSvgElement("svg");
  miniSvg.setAttribute("data-minimap-repaired", "true");
  miniSvg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
  miniSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  miniSvg.setAttribute("role", "img");
  miniSvg.setAttribute("aria-label", "خريطة مصغرة تفاعلية لشجرة العائلة");

  const treeClone = sourceGroup.cloneNode(true) as SVGGElement;
  treeClone.removeAttribute("transform");
  treeClone.removeAttribute("style");
  treeClone.querySelectorAll("foreignObject, text, image").forEach((node) => node.remove());

  treeClone.querySelectorAll<SVGPathElement>("path").forEach((path) => {
    path.removeAttribute("style");
    path.setAttribute("class", "legacy-mini-link");
  });

  compactNodes(treeClone);
  miniSvg.appendChild(treeClone);

  const groupMatrix = sourceGroup.getCTM();
  if (groupMatrix) {
    try {
      const inverse = groupMatrix.inverse();
      const width = sourceSvg.clientWidth || sourceSvg.getBoundingClientRect().width;
      const height = sourceSvg.clientHeight || sourceSvg.getBoundingClientRect().height;
      const topLeft = new DOMPoint(0, 0).matrixTransform(inverse);
      const bottomRight = new DOMPoint(width, height).matrixTransform(inverse);

      const viewport = createSvgElement("rect");
      viewport.setAttribute("x", String(Math.min(topLeft.x, bottomRight.x)));
      viewport.setAttribute("y", String(Math.min(topLeft.y, bottomRight.y)));
      viewport.setAttribute("width", String(Math.abs(bottomRight.x - topLeft.x)));
      viewport.setAttribute("height", String(Math.abs(bottomRight.y - topLeft.y)));
      viewport.setAttribute("class", "legacy-mini-viewport");
      miniSvg.appendChild(viewport);
    } catch {
      // The overview remains usable even when a browser cannot invert the SVG matrix.
    }
  }

  const navigateTo = (clientX: number, clientY: number) => {
    const currentGroup = findTreeGroup(sourceSvg);
    const matrix = currentGroup?.getCTM();
    if (!currentGroup || !matrix) return;

    const miniRect = miniSvg.getBoundingClientRect();
    if (!miniRect.width || !miniRect.height) return;

    const vb = miniSvg.viewBox.baseVal;
    const wantedX = vb.x + ((clientX - miniRect.left) / miniRect.width) * vb.width;
    const wantedY = vb.y + ((clientY - miniRect.top) / miniRect.height) * vb.height;
    const wantedInViewport = new DOMPoint(wantedX, wantedY).matrixTransform(matrix);

    const sourceRect = sourceSvg.getBoundingClientRect();
    const centerX = sourceRect.width / 2;
    const centerY = sourceRect.height / 2;
    const dx = centerX - wantedInViewport.x;
    const dy = centerY - wantedInViewport.y;
    const startClientX = sourceRect.left + centerX;
    const startClientY = sourceRect.top + centerY;

    sourceSvg.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
        buttons: 1,
        clientX: startClientX,
        clientY: startClientY,
      }),
    );

    window.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
        buttons: 1,
        clientX: startClientX + dx,
        clientY: startClientY + dy,
      }),
    );

    window.dispatchEvent(
      new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
        buttons: 0,
        clientX: startClientX + dx,
        clientY: startClientY + dy,
      }),
    );
  };

  let dragging = false;
  let lastMove = 0;

  miniSvg.addEventListener("pointerdown", (event) => {
    dragging = true;
    miniSvg.setPointerCapture?.(event.pointerId);
    navigateTo(event.clientX, event.clientY);
    event.preventDefault();
  });

  miniSvg.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const now = performance.now();
    if (now - lastMove < 70) return;
    lastMove = now;
    navigateTo(event.clientX, event.clientY);
    event.preventDefault();
  });

  const stopDragging = () => {
    dragging = false;
  };
  miniSvg.addEventListener("pointerup", stopDragging);
  miniSvg.addEventListener("pointercancel", stopDragging);

  target.replaceChildren(miniSvg);
  return miniSvg;
}

export function LegacyMiniMapRepair() {
  const pathname = useLocation({ select: (location) => location.pathname });

  useEffect(() => {
    if (pathname !== "/family-tree" && !pathname.startsWith("/family-tree/")) return;

    let stopped = false;
    let animationFrame = 0;
    let sourceObserver: MutationObserver | null = null;
    let targetObserver: MutationObserver | null = null;
    let currentSource: SVGSVGElement | null = null;
    let currentTarget: HTMLElement | null = null;
    let rendering = false;

    const render = () => {
      if (stopped) return;
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        if (stopped) return;
        const sourceSvg = findTreeSvg();
        const target = document.querySelector<HTMLElement>(".legacy-minimap-body");
        if (!sourceSvg || !target) return;

        if (sourceSvg !== currentSource) {
          sourceObserver?.disconnect();
          currentSource = sourceSvg;
          sourceObserver = new MutationObserver(() => render());
          sourceObserver.observe(sourceSvg, {
            attributes: true,
            childList: true,
            subtree: true,
            attributeFilter: ["transform", "d", "x", "y", "style", "class"],
          });
        }

        if (target !== currentTarget) {
          targetObserver?.disconnect();
          currentTarget = target;
          targetObserver = new MutationObserver(() => {
            if (rendering) return;
            if (!target.querySelector("svg[data-minimap-repaired='true']")) render();
          });
          targetObserver.observe(target, { childList: true });
        }

        rendering = true;
        makeMinimap(sourceSvg, target);
        queueMicrotask(() => {
          rendering = false;
        });
      });
    };

    const pageObserver = new MutationObserver(() => {
      const target = document.querySelector<HTMLElement>(".legacy-minimap-body");
      const source = findTreeSvg();
      if (!target || !source || !target.querySelector("svg[data-minimap-repaired='true']")) render();
    });
    pageObserver.observe(document.body, { childList: true, subtree: true });

    const onResize = () => render();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    render();

    return () => {
      stopped = true;
      cancelAnimationFrame(animationFrame);
      sourceObserver?.disconnect();
      targetObserver?.disconnect();
      pageObserver.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [pathname]);

  return null;
}
