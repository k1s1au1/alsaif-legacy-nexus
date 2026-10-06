import { useCallback, useEffect, useRef, useState, type TouchEvent, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Maximize2 } from "lucide-react";
import { MemberDialog } from "./member-dialog";
import {
  carouselIndicators,
  carouselSwipeStep,
  moveCarousel,
  resolveCarouselIndex,
  type CarouselPosition,
} from "@/lib/member-post-carousel";

function usePhotoSwipe(onStep: (step: number) => void) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const lastSwipe = useRef(0);
  return {
    onTouchStart(event: TouchEvent) {
      origin.current =
        event.touches.length === 1
          ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
          : null;
    },
    onTouchMove(event: TouchEvent) {
      if (event.touches.length !== 1) origin.current = null;
    },
    onTouchEnd(event: TouchEvent) {
      const start = origin.current;
      origin.current = null;
      if (!start || event.changedTouches.length !== 1 || event.touches.length > 0) return;
      const touch = event.changedTouches[0];
      const step = carouselSwipeStep(touch.clientX - start.x, touch.clientY - start.y);
      if (step) {
        lastSwipe.current = Date.now();
        onStep(step);
      }
    },
    onTouchCancel() {
      origin.current = null;
    },
    onClickCapture(event: MouseEvent) {
      if (Date.now() - lastSwipe.current < 400) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}

type PostGalleryProps = {
  images: string[];
  title: string;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
};

export function PostGallery({ images, title, expanded, onExpandedChange }: PostGalleryProps) {
  const [position, setPosition] = useState<CarouselPosition>({ index: 0, url: images[0] ?? null });
  const [failed, setFailed] = useState<string[]>([]);
  const index = resolveCarouselIndex(images, position);
  const current = images[index];
  const multiple = images.length > 1;
  const selectStep = useCallback(
    (step: number) => {
      setPosition((previous) => {
        const next = moveCarousel(resolveCarouselIndex(images, previous), step, images.length);
        return { index: next, url: images[next] ?? null };
      });
    },
    [images],
  );
  const swipe = usePhotoSwipe(selectStep);

  useEffect(() => {
    setPosition((previous) => {
      const next = resolveCarouselIndex(images, previous);
      return previous.index === next && previous.url === images[next]
        ? previous
        : { index: next, url: images[next] ?? null };
    });
  }, [images]);

  useEffect(() => {
    if (!expanded || !multiple) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      selectStep(event.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, multiple, selectStep]);

  if (!current) return null;
  const photo = (viewer: boolean) =>
    failed.includes(current) ? (
      <div className="community-photo-error" role="status">
        <ImageOff size={28} />
        <span>تعذر عرض الصورة</span>
        <a href={current} target="_blank" rel="noopener noreferrer">
          فتح الصورة الأصلية
        </a>
      </div>
    ) : (
      <img
        key={current}
        src={current}
        alt={`الصورة ${index + 1} من ${images.length} — ${title}`}
        draggable={false}
        decoding="async"
        loading={viewer ? "eager" : "lazy"}
        onError={() =>
          setFailed((previous) => (previous.includes(current) ? previous : [...previous, current]))
        }
      />
    );
  const arrows = () =>
    multiple && (
      <>
        <button
          type="button"
          className="community-photo-arrow community-photo-prev"
          aria-label="الصورة السابقة"
          onClick={() => selectStep(-1)}
        >
          <ChevronLeft size={22} />
        </button>
        <button
          type="button"
          className="community-photo-arrow community-photo-next"
          aria-label="الصورة التالية"
          onClick={() => selectStep(1)}
        >
          <ChevronRight size={22} />
        </button>
      </>
    );

  return (
    <>
      <div
        className="community-gallery"
        role="group"
        aria-roledescription="عارض صور"
        aria-label={`صور ${title}`}
        {...swipe}
      >
        {failed.includes(current) ? (
          <div className="community-photo-frame">{photo(false)}</div>
        ) : (
          <button
            type="button"
            className="community-photo-frame"
            aria-label="تكبير الصورة المعروضة"
            onClick={() => onExpandedChange(true)}
          >
            {photo(false)}
            <span className="community-photo-zoom" aria-hidden="true">
              <Maximize2 size={16} />
            </span>
          </button>
        )}
        {arrows()}
        <output
          className="community-photo-count"
          dir="ltr"
          aria-live="polite"
          aria-atomic="true"
          aria-label="رقم الصورة"
        >
          {index + 1} / {images.length}
        </output>
        <div className="community-photo-dots" aria-hidden="true" dir="ltr">
          {carouselIndicators(images.length, index).map((dot) => (
            <span key={dot} data-active={dot === index} />
          ))}
        </div>
      </div>
      <p className="community-swipe-hint">
        {multiple ? "اسحب يميناً أو يساراً لاستعراض الصور" : "اضغط على الصورة لعرضها كاملة"}
      </p>
      {expanded && (
        <MemberDialog
          title={title}
          description="الصورة كاملة؛ استخدم الأسهم أو اسحب للتنقل، واضغط إغلاق للعودة للمشاركة."
          onClose={() => onExpandedChange(false)}
          className="community-image-viewer"
          wide
        >
          <div className="community-viewer-stage" {...swipe}>
            {photo(true)}
            {arrows()}
          </div>
          <div className="community-viewer-footer">
            <output dir="ltr" aria-live="polite" aria-atomic="true">
              {index + 1} / {images.length}
            </output>
            <span>{multiple ? "الأسهم أو السحب للتنقل بين الصور" : "الصورة كاملة"}</span>
          </div>
        </MemberDialog>
      )}
    </>
  );
}
