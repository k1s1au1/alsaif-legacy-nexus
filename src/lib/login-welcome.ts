export type LoginWelcomeTicket = {
  id: string;
  userId: string;
  createdAt: number;
};

const PENDING_KEY = "council-login-welcome-v1";
const MAX_AGE = 5 * 60 * 1000;
export const WELCOME_SEEN_METADATA_KEY = "council_welcome_seen_at";
let pendingTicket: LoginWelcomeTicket | null = null;

// Only the successful sign-in form queues an entrance. Restored sessions,
// token refreshes, and internal navigation never create one.
export function queueLoginWelcome(userId: string) {
  const createdAt = Date.now();
  pendingTicket = {
    id: `${createdAt}-${Math.random().toString(36).slice(2)}`,
    userId,
    createdAt,
  };
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pendingTicket));
  } catch {
    // The in-memory ticket also works when browser storage is unavailable.
  }
}

export function readLoginWelcome(userId: string): LoginWelcomeTicket | null {
  let ticket: unknown = pendingTicket;
  if (!ticket) {
    try {
      ticket = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
    } catch {
      return null;
    }
  }
  if (!ticket || typeof ticket !== "object") return null;
  const candidate = ticket as Partial<LoginWelcomeTicket>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.userId !== "string" ||
    typeof candidate.createdAt !== "number" ||
    !Number.isFinite(candidate.createdAt)
  ) return null;
  const age = Date.now() - candidate.createdAt;
  if (age < 0 || age > MAX_AGE || candidate.userId !== userId) return null;
  return candidate as LoginWelcomeTicket;
}

export function consumeLoginWelcome(ticket: LoginWelcomeTicket) {
  if (pendingTicket?.id === ticket.id) pendingTicket = null;
  try {
    const stored = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
    if (stored?.id === ticket.id) sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Do not turn a decorative entrance into an access requirement.
  }
}

export function hasSeenCouncilWelcome(user: {
  id: string;
  user_metadata?: Record<string, unknown>;
}) {
  if (user.user_metadata?.[WELCOME_SEEN_METADATA_KEY]) return true;
  try {
    return !!localStorage.getItem(`council-welcome-seen-v1:${user.id}`);
  } catch {
    return false;
  }
}

export function rememberCouncilWelcome(userId: string) {
  try {
    localStorage.setItem(`council-welcome-seen-v1:${userId}`, new Date().toISOString());
  } catch {
    // Account metadata is the cross-device source of truth.
  }
}
