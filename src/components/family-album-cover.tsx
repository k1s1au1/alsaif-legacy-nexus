import { motion } from "framer-motion";
import type { RefObject } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import { useSiteLogo } from "@/hooks/use-site-logo";
import "./family-album-cover.css";

export type AlbumBindingState = "closed" | "opening" | "open" | "closing";

function HeritageCorner({ corner }: { corner: string }) {
  return (
    <svg
      className="album-cover-corner"
      data-corner={corner}
      viewBox="0 0 144 144"
      aria-hidden="true"
    >
      <g transform="translate(24 0) scale(.8 1)">
        <path className="album-cover-relief" d="M8 8h108L96 28H78v18H60v18H42v18H24v18H8z" />
        <path className="album-cover-relief" d="M8 108h18V90h18V72h18V54h18V36h18V18h20L8 128z" />
        <path
          className="album-cover-relief"
          d="M10 14v65l65-65zM15 22v44l44-44z"
          fillRule="evenodd"
        />
        <path
          className="album-cover-emboss-line"
          d="M12 112h18V94h18V76h18V58h18V40h18V22h15M12 11h103"
        />
      </g>
      <path
        className="album-cover-foil"
        d="m9 9 7 7-7 7-7-7zm0 21 7 7-7 7-7-7zm0 21 7 7-7 7-7-7z"
      />
    </svg>
  );
}

export function FamilyAlbumCover({
  state,
  buttonRef,
  onOpen,
  onRest,
}: {
  state: AlbumBindingState;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onOpen: () => void;
  onRest: (state: AlbumBindingState) => void;
}) {
  const logo = useSiteLogo();
  if (state === "open") return null;
  const moving = state === "opening" || state === "closing";
  const opening = state === "opening";
  return (
    <div className="album-cover-stage" aria-hidden={moving || undefined} inert={moving}>
      <div className="album-hardcover-volume">
        <div className="album-hardcover-pages" aria-hidden="true" />
        <motion.button
          ref={buttonRef}
          type="button"
          className="album-hardcover"
          aria-label="فتح ألبوم العائلة"
          aria-controls="family-album-pages"
          aria-expanded={false}
          disabled={moving}
          onClick={onOpen}
          initial={state === "closing" ? { rotateY: 178, opacity: 0 } : false}
          animate={
            moving
              ? {
                  rotateY: opening ? [6, 40, 112, 178] : [178, 112, 40, 6],
                  opacity: opening ? [1, 1, 1, 0] : [0, 1, 1, 1],
                }
              : { rotateY: 6, opacity: 1 }
          }
          transition={
            moving
              ? { duration: 1.12, times: [0, 0.28, 0.72, 1], ease: "easeInOut" }
              : { duration: 0 }
          }
          onAnimationComplete={() => moving && onRest(state)}
        >
          <span className="album-hardcover-front">
            <span className="album-hardcover-grain" aria-hidden="true" />
            <span className="album-cover-border" aria-hidden="true" />
            <HeritageCorner corner="top-left" />
            <HeritageCorner corner="top-right" />
            <HeritageCorner corner="bottom-left" />
            <HeritageCorner corner="bottom-right" />
            <span className="album-cover-seal">
              {logo ? (
                <img
                  className="album-cover-logo"
                  src={logo}
                  alt="شعار العائلة"
                  decoding="async"
                  draggable={false}
                />
              ) : (
                <Sparkles className="album-cover-logo-placeholder" aria-hidden="true" />
              )}
            </span>
            <span className="album-cover-title">ألبوم العائلة</span>
            <span className="album-cover-rule" aria-hidden="true">
              <i />◆<i />
            </span>
            <span className="album-cover-subtitle">حكايتنا بين الصفحات</span>
          </span>
          <span className="album-hardcover-back" aria-hidden="true">
            <span className="album-cover-endpaper-frame">
              <BookOpen />
              <span>ذكريات تجمعنا</span>
            </span>
          </span>
          <span className="album-hardcover-spine" aria-hidden="true" />
        </motion.button>
      </div>
      <p className="album-cover-open-hint" aria-hidden="true">
        <BookOpen size={17} />
        اضغط على الغلاف لفتح الألبوم
      </p>
    </div>
  );
}
