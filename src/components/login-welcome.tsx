import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { User } from "@supabase/supabase-js";
import * as Dialog from "@radix-ui/react-dialog";
import { Sparkles } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-dashboard-data";
import { useTermsReady } from "@/components/terms-gate";
import { HeritagePortal3D } from "@/components/dashboard/heritage-portal-3d";
import { THEME_COLORS, applyThemeColors } from "@/lib/themes";
import {
  WELCOME_SEEN_METADATA_KEY,
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

  useEffect(() => {
    if (!ticket || dismissed.current) return;
    if (startedAt.current === null && (!ready || !identityReady || profileLoading)) return;
    consumeLoginWelcome(ticket);
    if (!remembered.current) {
      remembered.current = true;
      rememberCouncilWelcome(user.id);
      // This decorative preference belongs to the member's account and does
      // not change their profile fields, role, or permissions.
      if (!user.user_metadata?.[WELCOME_SEEN_METADATA_KEY]) {
        void (async () => {
          try {
            const { data } = await supabase.auth.getSession();
            if (data.session?.user.id !== user.id) return;
            await supabase.auth.updateUser({
              data: { [WELCOME_SEEN_METADATA_KEY]: new Date().toISOString() },
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
    const duration = firstEntrance ? 2000 : 850;
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
  }, [ready, identityReady, profileLoading, ticket, firstEntrance, reduceMotion, user]);

  if (!visible) return null;
  if (!firstEntrance) return <DailyLoginWelcome />;

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
          <Dialog.Description className="sr-only">إرث يجمعنا</Dialog.Description>
          <Dialog.Close className="login-welcome-skip" type="button">تخطي</Dialog.Close>
          <HeritagePortal3D
            greeting="إرث يجمعنا"
            name="مجلس السيف"
            message=""
            welcomeIntro
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
