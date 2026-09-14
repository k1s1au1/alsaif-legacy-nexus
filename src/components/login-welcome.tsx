import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { User } from "@supabase/supabase-js";
import * as Dialog from "@radix-ui/react-dialog";
import { Sparkles } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-dashboard-data";
import { useTermsReady } from "@/components/terms-gate";
import entrancePortrait from "@/assets/council-entry-portrait-v2.webp";
import entranceLandscape from "@/assets/council-entry-landscape-v2.webp";
import { THEME_COLORS, applyThemeColors } from "@/lib/themes";
import {
  WELCOME_SEEN_METADATA_KEY,
  WELCOME_VERSION_METADATA_KEY,
  WELCOME_VERSION,
  consumeLoginWelcome,
  hasSeenCouncilWelcome,
  readLoginWelcome,
  rememberCouncilWelcome,
} from "@/lib/login-welcome";
import "./login-welcome.css";

export function LoginWelcome({ user }: { user: User }) {
  const ready = useTermsReady();
  const { isLoading: profileLoading } = useProfile();
  const reduceMotion = useReducedMotion();
  const [ticket] = useState(() => readLoginWelcome(user.id));
  const [firstEntrance] = useState(() => !hasSeenCouncilWelcome(user));
  const [identityReady, setIdentityReady] = useState(false);
  const [artReady, setArtReady] = useState<"pending" | "ready" | "failed">("pending");
  const [visible, setVisible] = useState(false);
  const startedAt = useRef<number | null>(null);
  const remembered = useRef(false);
  const dismissed = useRef(false);

  // Sync the member's chosen identity before the entrance, including a new
  // device whose root mounted before sign-in. A slow read never blocks entry.
  useEffect(() => {
    if (!ticket) return;
    let active = true;
    const fallback = window.setTimeout(() => setIdentityReady(true), 750);
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("theme_color")
          .eq("id", user.id)
          .maybeSingle();
        if (!active) return;
        const identity = THEME_COLORS.find((color) => color.id === data?.theme_color);
        if (identity) {
          applyThemeColors(identity);
          try {
            localStorage.setItem("app-theme-color-id", identity.id);
          } catch {
            // The current identity still applies without browser storage.
          }
        }
      } catch {
        // Retain the already active identity while offline.
      } finally {
        if (active) {
          window.clearTimeout(fallback);
          setIdentityReady(true);
        }
      }
    })();
    return () => {
      active = false;
      window.clearTimeout(fallback);
    };
  }, [ticket, user.id]);

  // Decode both orientations before starting the clock. A slow/offline image
  // falls back to the brief greeting and can be tried on a later sign-in.
  useEffect(() => {
    if (!ticket || !firstEntrance || reduceMotion) return;
    let active = true;
    let loaded = 0;
    const images = [entrancePortrait, entranceLandscape].map(() => new Image());
    const deadline = window.setTimeout(() => {
      active = false;
      setArtReady("failed");
    }, 2500);
    const fail = () => {
      if (!active) return;
      active = false;
      window.clearTimeout(deadline);
      setArtReady("failed");
    };
    images.forEach((image, index) => {
      image.onload = async () => {
        try {
          await image.decode();
        } catch {
          // An already loaded image is usable on older WebKit versions.
        }
        if (!active) return;
        loaded += 1;
        if (loaded === images.length) {
          window.clearTimeout(deadline);
          setArtReady("ready");
        }
      };
      image.onerror = fail;
      image.src = index === 0 ? entrancePortrait : entranceLandscape;
    });
    return () => {
      active = false;
      window.clearTimeout(deadline);
      images.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, [ticket, firstEntrance, reduceMotion]);

  useEffect(() => {
    if (!ticket || dismissed.current) return;
    if (startedAt.current === null && (!ready || !identityReady || profileLoading)) return;
    if (startedAt.current === null && firstEntrance && !reduceMotion && artReady === "pending") return;
    consumeLoginWelcome(ticket);
    if (!remembered.current && (!firstEntrance || artReady === "ready" || reduceMotion)) {
      remembered.current = true;
      rememberCouncilWelcome(user.id);
      // This decorative preference belongs to the member's account and does
      // not change their profile fields, role, or permissions.
      const version = user.user_metadata?.[WELCOME_VERSION_METADATA_KEY];
      if (typeof version !== "number" || version < WELCOME_VERSION) {
        void (async () => {
          try {
            const { data } = await supabase.auth.getSession();
            if (data.session?.user.id !== user.id) return;
            await supabase.auth.updateUser({
              data: {
                [WELCOME_SEEN_METADATA_KEY]: new Date().toISOString(),
                [WELCOME_VERSION_METADATA_KEY]: WELCOME_VERSION,
              },
            });
          } catch {
            // Local recall prevents repeats here; a later login can resync.
          }
        })();
      }
    }
    if (reduceMotion) {
      dismissed.current = true;
      setVisible(false);
      return;
    }
    const duration = firstEntrance && artReady === "ready" ? 2800 : 850;
    if (startedAt.current === null) {
      startedAt.current = Date.now();
      setVisible(true);
    }
    const remaining = Math.max(0, duration - (Date.now() - startedAt.current));
    const finish = window.setTimeout(() => {
      dismissed.current = true;
      setVisible(false);
    }, remaining);
    return () => window.clearTimeout(finish);
  }, [ready, identityReady, profileLoading, artReady, ticket, firstEntrance, reduceMotion, user]);

  if (!visible) return null;
  if (!firstEntrance || artReady === "failed") return <DailyLoginWelcome />;

  return (
    <Dialog.Root open={visible} onOpenChange={(open) => {
      if (!open) {
        dismissed.current = true;
        setVisible(false);
      }
    }}>
      <Dialog.Portal>
        <Dialog.Content className="login-welcome-intro" dir="rtl">
          <Dialog.Title className="sr-only">أهلًا بك في مجلس السيف</Dialog.Title>
          <Dialog.Description className="sr-only">تفتح بوابة المجلس لتعبر منها إلى الرئيسية.</Dialog.Description>
          <Dialog.Close className="login-welcome-skip" type="button">تخطي</Dialog.Close>
          <CouncilEntryScene />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CouncilEntryScene() {
  return (
    <div className="council-entry-scene" aria-hidden="true">
      <picture className="council-entry-atmosphere">
        <source media="(min-aspect-ratio: 1/1)" srcSet={entranceLandscape} />
        <img src={entrancePortrait} alt="" />
      </picture>
      <div className="council-entry-world">
        <div className="council-entry-camera">
          <picture className="council-entry-architecture">
            <source media="(min-aspect-ratio: 1/1)" srcSet={entranceLandscape} />
            <img src={entrancePortrait} alt="" />
          </picture>
          <div className="council-entry-gate">
            <span className="council-entry-door council-entry-door-left"><span /></span>
            <span className="council-entry-door council-entry-door-right"><span /></span>
            <span className="council-entry-door-seam" />
          </div>
        </div>
      </div>
      <div className="council-entry-copy">
        <span>إرث يجمعنا</span>
        <strong>أهلًا بك في مجلس السيف</strong>
      </div>
      <span className="council-entry-passage" />
    </div>
  );
}

function DailyLoginWelcome() {
  const [top, setTop] = useState(96);
  useLayoutEffect(() => {
    const position = () => {
      const header = document.querySelector(".app-shell-header");
      const bounds = header?.getBoundingClientRect();
      const bottom = bounds?.height ? bounds.bottom : 80;
      setTop(Math.min(Math.max(16, bottom + 12), window.innerHeight - 64));
    };
    position();
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, []);

  return createPortal(
    <>
      <span className="login-welcome-header-glint" style={{ top: top - 12 }} aria-hidden="true" />
      <div className="login-welcome-daily" style={{ top }} role="status" dir="rtl">
        <Sparkles size={16} aria-hidden="true" />
        <span>حيّاك الله</span>
      </div>
    </>,
    document.body,
  );
}
