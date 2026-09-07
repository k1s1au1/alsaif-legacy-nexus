import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Clipboard,
  Crown,
  Gavel,
  HelpCircle,
  Link2,
  Loader2,
  LogOut,
  Medal,
  Play,
  RefreshCcw,
  RotateCw,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Trophy,
  UserCheck,
  Users,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TRIVIA_QUESTIONS } from "@/data/trivia-questions";
import { cn } from "@/lib/utils";

type GameKey =
  | "word-duel"
  | "baloot"
  | "wheel"
  | "challenge30"
  | "auction"
  | "judge"
  | "trivia";

type RoomPhase = "lobby" | "playing" | "results";

type Player = {
  id: string;
  name: string;
  avatarUrl: string | null;
  ready: boolean;
  joinedAt: number;
  isHost?: boolean;
};

type RoomState = {
  phase: RoomPhase;
  game: GameKey;
  round: number;
  scores: Record<string, number>;
  data: Record<string, any>;
};

type RoomAction = {
  type: string;
  playerId: string;
  value?: any;
};

type RoomPacket =
  | { kind: "request-state"; senderId: string }
  | { kind: "snapshot"; senderId: string; hostId: string; state: RoomState }
  | { kind: "action"; senderId: string; action: RoomAction }
  | { kind: "room-closed"; senderId: string };

type GameMeta = {
  id: GameKey;
  label: string;
  short: string;
  icon: LucideIcon;
  minPlayers: number;
};

const GAMES: GameMeta[] = [
  {
    id: "word-duel",
    label: "سجال الحروف",
    short: "كلمة تبدأ بآخر حرف، والدور ينتقل بين الجوالات.",
    icon: Zap,
    minPlayers: 2,
  },
  {
    id: "trivia",
    label: "بنك الأسئلة",
    short: "كل لاعب يجيب من جواله وتظهر النتائج للجميع.",
    icon: HelpCircle,
    minPlayers: 2,
  },
  {
    id: "judge",
    label: "قاضي الجماعة",
    short: "تصويت سري من كل جوال ثم كشف النتيجة.",
    icon: UserCheck,
    minPlayers: 3,
  },
  {
    id: "challenge30",
    label: "الـ 30 ثانية",
    short: "الكلمة تظهر لصاحب الدور فقط والبقية يخمّنون.",
    icon: Timer,
    minPlayers: 2,
  },
  {
    id: "auction",
    label: "مزاد المعلومات",
    short: "كل لاعب يرسل مزايدته ويختار المضيف الفائز.",
    icon: Gavel,
    minPlayers: 2,
  },
  {
    id: "wheel",
    label: "القرعة",
    short: "قرعة مباشرة بين جميع الموجودين في الغرفة.",
    icon: RotateCw,
    minPlayers: 2,
  },
  {
    id: "baloot",
    label: "البلوت",
    short: "حاسبة صكّة مشتركة تتحدث عند الجميع لحظيًا.",
    icon: Target,
    minPlayers: 2,
  },
];

const CHALLENGE_WORDS = [
  "القهوة العربية",
  "السيف",
  "الرياض",
  "نخلة",
  "مجلس العائلة",
  "الصقور",
  "رحلة برية",
  "مناسبة عائلية",
  "التراث",
  "الكرم",
  "العيد",
  "الكعبة",
];

const JUDGE_SCENARIOS = [
  "من أكثر شخص يصل متأخرًا للمناسبات؟",
  "من أكثر شخص يحفظ أسرار العائلة؟",
  "من أول شخص تطلب منه المساعدة؟",
  "من أكثر شخص يصنع أجواءً حلوة في المجلس؟",
  "من أكثر شخص يعرف أخبار العائلة؟",
  "من الأنسب لتنظيم الرحلة القادمة؟",
];

const AUCTION_PROMPTS = [
  "كم مدينة في المملكة زرتها؟",
  "كم اسمًا من أسماء الصحابة تستطيع ذكره؟",
  "كم طبقًا شعبيًا سعوديًا تستطيع تسميته؟",
  "كم دولة عربية تستطيع ذكر عاصمتها؟",
  "كم مثلًا شعبيًا تعرفه؟",
];

const LETTERS = ["ا", "ب", "ت", "ج", "ح", "د", "ر", "س", "ع", "ف", "ق", "ك", "م", "ن", "هـ", "و"];
const SESSION_KEY = "alsaif-live-game-room-v1";

function gameMeta(id: GameKey) {
  return GAMES.find((game) => game.id === id) ?? GAMES[0];
}

function makeRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function makeGuestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function cleanCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function scoreFor(scores: Record<string, number>, id: string) {
  return scores[id] ?? 0;
}

function nextIndex(current: number, length: number) {
  return length ? (current + 1) % length : 0;
}

function initialGameData(game: GameKey, players: Player[], round = 0): Record<string, any> {
  switch (game) {
    case "trivia":
      return { questionIndex: round % TRIVIA_QUESTIONS.length, answers: {}, revealed: false };
    case "judge":
      return { scenarioIndex: round % JUDGE_SCENARIOS.length, votes: {}, revealed: false };
    case "challenge30":
      return {
        activeIndex: round % Math.max(players.length, 1),
        wordIndex: Math.floor(Math.random() * CHALLENGE_WORDS.length),
        correct: 0,
        skips: 0,
        endsAt: Date.now() + 30000,
        finished: false,
      };
    case "auction":
      return { promptIndex: round % AUCTION_PROMPTS.length, bids: {}, revealed: false, winnerId: null };
    case "word-duel":
      return {
        currentLetter: LETTERS[Math.floor(Math.random() * LETTERS.length)],
        turnIndex: 0,
        words: [],
      };
    case "wheel":
      return { winnerId: null, spin: 0 };
    case "baloot":
      return { us: 0, them: 0, history: [] };
  }
}

function lobbyState(game: GameKey = "trivia"): RoomState {
  return { phase: "lobby", game, round: 0, scores: {}, data: {} };
}

function startState(previous: RoomState, players: Player[]): RoomState {
  const scores = { ...previous.scores };
  players.forEach((player) => {
    if (scores[player.id] == null) scores[player.id] = 0;
  });
  return {
    ...previous,
    phase: "playing",
    round: 0,
    scores,
    data: initialGameData(previous.game, players),
  };
}

function applyRoomAction(state: RoomState, action: RoomAction, players: Player[]): RoomState {
  if (action.type === "set-game" && state.phase === "lobby") {
    return lobbyState(action.value as GameKey);
  }
  if (action.type === "start" && state.phase === "lobby") return startState(state, players);
  if (action.type === "lobby") return lobbyState(state.game);
  if (action.type === "finish") return { ...state, phase: "results" };
  if (state.phase !== "playing") return state;

  const data = state.data;
  const scores = { ...state.scores };

  if (state.game === "trivia") {
    if (action.type === "answer" && !data.revealed && data.answers[action.playerId] == null) {
      return { ...state, data: { ...data, answers: { ...data.answers, [action.playerId]: action.value } } };
    }
    if (action.type === "reveal" && !data.revealed) {
      const question = TRIVIA_QUESTIONS[data.questionIndex % TRIVIA_QUESTIONS.length];
      Object.entries(data.answers as Record<string, number>).forEach(([id, answer]) => {
        if (answer === question.correct) scores[id] = scoreFor(scores, id) + 1;
      });
      return { ...state, scores, data: { ...data, revealed: true } };
    }
    if (action.type === "next") {
      const round = state.round + 1;
      return { ...state, round, data: initialGameData("trivia", players, round) };
    }
  }

  if (state.game === "judge") {
    if (action.type === "vote" && !data.revealed && data.votes[action.playerId] == null) {
      return { ...state, data: { ...data, votes: { ...data.votes, [action.playerId]: action.value } } };
    }
    if (action.type === "reveal") return { ...state, data: { ...data, revealed: true } };
    if (action.type === "next") {
      const round = state.round + 1;
      return { ...state, round, data: initialGameData("judge", players, round) };
    }
  }

  if (state.game === "challenge30") {
    const active = players[data.activeIndex % Math.max(players.length, 1)];
    if (action.type === "next") {
      const round = state.round + 1;
      return { ...state, round, data: initialGameData("challenge30", players, round) };
    }
    if (active?.id !== action.playerId) return state;
    if (action.type === "correct" && !data.finished) {
      scores[action.playerId] = scoreFor(scores, action.playerId) + 1;
      return {
        ...state,
        scores,
        data: {
          ...data,
          correct: data.correct + 1,
          wordIndex: nextIndex(data.wordIndex, CHALLENGE_WORDS.length),
        },
      };
    }
    if (action.type === "skip" && !data.finished) {
      return {
        ...state,
        data: {
          ...data,
          skips: data.skips + 1,
          wordIndex: nextIndex(data.wordIndex, CHALLENGE_WORDS.length),
        },
      };
    }
    if (action.type === "end-turn") return { ...state, data: { ...data, finished: true } };
  }

  if (state.game === "auction") {
    if (action.type === "bid" && !data.revealed) {
      const bid = Math.max(0, Math.min(999, Number(action.value) || 0));
      return { ...state, data: { ...data, bids: { ...data.bids, [action.playerId]: bid } } };
    }
    if (action.type === "reveal") return { ...state, data: { ...data, revealed: true } };
    if (action.type === "award" && data.revealed && players.some((p) => p.id === action.value)) {
      scores[action.value] = scoreFor(scores, action.value) + 1;
      return { ...state, scores, data: { ...data, winnerId: action.value } };
    }
    if (action.type === "next") {
      const round = state.round + 1;
      return { ...state, round, data: initialGameData("auction", players, round) };
    }
  }

  if (state.game === "word-duel") {
    const active = players[data.turnIndex % Math.max(players.length, 1)];
    if (action.type === "word" && active?.id === action.playerId) {
      const word = String(action.value ?? "").trim();
      if (word.length < 2 || !word.startsWith(data.currentLetter)) return state;
      const words = [...data.words, { playerId: action.playerId, word }];
      scores[action.playerId] = scoreFor(scores, action.playerId) + 1;
      return {
        ...state,
        scores,
        data: {
          ...data,
          words,
          currentLetter: word.slice(-1),
          turnIndex: nextIndex(data.turnIndex, players.length),
        },
      };
    }
    if (action.type === "skip" && active?.id === action.playerId) {
      return {
        ...state,
        data: {
          ...data,
          currentLetter: LETTERS[Math.floor(Math.random() * LETTERS.length)],
          turnIndex: nextIndex(data.turnIndex, players.length),
        },
      };
    }
  }

  if (state.game === "wheel" && action.type === "spin" && players.length) {
    const winner = players[Math.floor(Math.random() * players.length)];
    return { ...state, data: { winnerId: winner.id, spin: (data.spin ?? 0) + 1 } };
  }

  if (state.game === "baloot") {
    if (action.type === "score") {
      const us = Math.max(0, Number(action.value?.us) || 0);
      const them = Math.max(0, Number(action.value?.them) || 0);
      return {
        ...state,
        data: {
          ...data,
          us: data.us + us,
          them: data.them + them,
          history: [{ us, them }, ...(data.history ?? [])].slice(0, 20),
        },
      };
    }
    if (action.type === "undo" && data.history?.length) {
      const [last, ...history] = data.history;
      return {
        ...state,
        data: {
          ...data,
          us: Math.max(0, data.us - last.us),
          them: Math.max(0, data.them - last.them),
          history,
        },
      };
    }
    if (action.type === "reset-score") return { ...state, data: initialGameData("baloot", players) };
  }

  return state;
}

function readDeviceId() {
  if (typeof window === "undefined") return makeGuestId();
  const saved = window.localStorage.getItem("alsaif-game-device-id");
  if (saved) return saved;
  const id = makeGuestId();
  window.localStorage.setItem("alsaif-game-device-id", id);
  return id;
}

export function GameRoomsHub() {
  const [me, setMe] = useState<Player>(() => ({
    id: readDeviceId(),
    name: "عضو العائلة",
    avatarUrl: null,
    ready: false,
    joinedAt: Date.now(),
  }));
  const [booting, setBooting] = useState(true);
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [state, setState] = useState<RoomState>(() => lobbyState());
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(Date.now());

  const channelRef = useRef<any>(null);
  const meRef = useRef(me);
  const playersRef = useRef(players);
  const stateRef = useRef(state);
  const hostRef = useRef(hostId);
  const roomRef = useRef(roomCode);
  const readyRef = useRef(ready);
  const receivedSnapshotRef = useRef(false);
  const reconnectAttemptedRef = useRef(false);
  const electionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const packetHandlerRef = useRef<(packet: RoomPacket) => void>(() => undefined);

  useEffect(() => {
    meRef.current = me;
  }, [me]);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    hostRef.current = hostId;
  }, [hostId]);
  useEffect(() => {
    roomRef.current = roomCode;
  }, [roomCode]);
  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user || !active) {
        if (active) setBooting(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("arabic_name, full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      const name = profile?.arabic_name?.trim() || profile?.full_name?.trim() || "عضو العائلة";
      setMe({
        id: user.id,
        name,
        avatarUrl: profile?.avatar_url ?? null,
        ready: false,
        joinedAt: Date.now(),
      });
      setBooting(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (state.game !== "challenge30" || state.phase !== "playing" || state.data.finished) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [state.game, state.phase, state.data.finished]);

  const clearJoinTimers = useCallback(() => {
    joinTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    joinTimersRef.current = [];
    if (electionTimerRef.current) window.clearTimeout(electionTimerRef.current);
    electionTimerRef.current = null;
  }, []);

  const disconnectChannel = useCallback(async () => {
    clearJoinTimers();
    const channel = channelRef.current;
    channelRef.current = null;
    if (channel) await supabase.removeChannel(channel);
  }, [clearJoinTimers]);

  const sendPacket = useCallback(async (packet: RoomPacket) => {
    const channel = channelRef.current;
    if (!channel) return;
    await channel.send({ type: "broadcast", event: "room", payload: packet });
  }, []);

  const publishSnapshot = useCallback(
    async (nextState: RoomState, nextHostId = hostRef.current) => {
      if (!nextHostId) return;
      await sendPacket({
        kind: "snapshot",
        senderId: meRef.current.id,
        hostId: nextHostId,
        state: nextState,
      });
    },
    [sendPacket],
  );

  const trackPresence = useCallback(async (nextReady: boolean, nextIsHost = hostRef.current === meRef.current.id) => {
    const channel = channelRef.current;
    if (!channel) return;
    await channel.track({
      id: meRef.current.id,
      name: meRef.current.name,
      avatarUrl: meRef.current.avatarUrl,
      ready: nextReady,
      joinedAt: meRef.current.joinedAt,
      isHost: nextIsHost,
    });
  }, []);

  const resetRoomView = useCallback(() => {
    setRoomCode("");
    setPlayers([]);
    setHostId(null);
    setState(lobbyState());
    setConnected(false);
    setConnecting(false);
    setReady(false);
    receivedSnapshotRef.current = false;
    if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY);
  }, []);

  const leaveRoom = useCallback(
    async (announce = true) => {
      const currentHost = hostRef.current;
      const currentPlayers = playersRef.current;
      if (announce && currentHost === meRef.current.id) {
        const successor = currentPlayers
          .filter((player) => player.id !== meRef.current.id)
          .sort((a, b) => a.joinedAt - b.joinedAt)[0];
        if (successor) {
          await publishSnapshot(stateRef.current, successor.id);
        } else {
          await sendPacket({ kind: "room-closed", senderId: meRef.current.id });
        }
      }
      await disconnectChannel();
      resetRoomView();
    },
    [disconnectChannel, publishSnapshot, resetRoomView, sendPacket],
  );

  const hostApply = useCallback(
    async (action: RoomAction) => {
      if (hostRef.current !== meRef.current.id) return;
      const next = applyRoomAction(stateRef.current, action, playersRef.current);
      if (next === stateRef.current) return;
      stateRef.current = next;
      setState(next);
      await publishSnapshot(next, meRef.current.id);
    },
    [publishSnapshot],
  );

  const dispatch = useCallback(
    async (type: string, value?: any) => {
      const action: RoomAction = { type, value, playerId: meRef.current.id };
      if (hostRef.current === meRef.current.id) {
        await hostApply(action);
      } else {
        await sendPacket({ kind: "action", senderId: meRef.current.id, action });
      }
    },
    [hostApply, sendPacket],
  );

  packetHandlerRef.current = (packet) => {
    if (!packet || packet.senderId === meRef.current.id) return;
    if (packet.kind === "request-state") {
      if (hostRef.current === meRef.current.id) void publishSnapshot(stateRef.current, meRef.current.id);
      return;
    }
    if (packet.kind === "snapshot") {
      receivedSnapshotRef.current = true;
      hostRef.current = packet.hostId;
      stateRef.current = packet.state;
      setHostId(packet.hostId);
      setState(packet.state);
      if (packet.hostId === meRef.current.id) void trackPresence(readyRef.current, true);
      return;
    }
    if (packet.kind === "action") {
      if (hostRef.current === meRef.current.id) void hostApply(packet.action);
      return;
    }
    if (packet.kind === "room-closed") {
      toast.info("أغلق المضيف الغرفة");
      void leaveRoom(false);
    }
  };

  const connectRoom = useCallback(
    async (
      requestedCode: string,
      mode: "create" | "join" | "restore",
      restored?: { state?: RoomState; hostId?: string; ready?: boolean },
    ) => {
      const code = cleanCode(requestedCode);
      if (code.length !== 6 || channelRef.current) return;
      setConnecting(true);
      receivedSnapshotRef.current = mode === "create" || Boolean(restored?.state);

      const startingState = restored?.state ?? lobbyState();
      const startingHost = mode === "create" ? meRef.current.id : (restored?.hostId ?? null);
      const startingReady = mode === "create" ? true : Boolean(restored?.ready);
      stateRef.current = startingState;
      hostRef.current = startingHost;
      roomRef.current = code;
      readyRef.current = startingReady;
      setState(startingState);
      setHostId(startingHost);
      setRoomCode(code);
      setReady(startingReady);

      const channel = supabase.channel(`alsaif-game-room:${code}`, {
        config: { broadcast: { self: false }, presence: { key: meRef.current.id } },
      });
      channelRef.current = channel;

      channel
        .on("broadcast", { event: "room" }, ({ payload }: { payload: RoomPacket }) => {
          packetHandlerRef.current(payload);
        })
        .on("presence", { event: "sync" }, () => {
          const raw = channel.presenceState() as Record<string, Player[]>;
          const unique = new Map<string, Player>();
          Object.values(raw)
            .flat()
            .forEach((presence: any) => {
              if (!presence?.id) return;
              unique.set(presence.id, {
                id: presence.id,
                name: presence.name || "عضو العائلة",
                avatarUrl: presence.avatarUrl ?? null,
                ready: Boolean(presence.ready),
                joinedAt: Number(presence.joinedAt) || Date.now(),
                isHost: Boolean(presence.isHost),
              });
            });
          const nextPlayers = [...unique.values()].sort((a, b) => a.joinedAt - b.joinedAt);
          playersRef.current = nextPlayers;
          setPlayers(nextPlayers);

          const announcedHost = nextPlayers.find((player) => player.isHost)?.id;
          if (!hostRef.current && announcedHost) {
            hostRef.current = announcedHost;
            setHostId(announcedHost);
          }

          const knownHost = hostRef.current;
          if (
            knownHost &&
            !nextPlayers.some((player) => player.id === knownHost) &&
            nextPlayers.length &&
            receivedSnapshotRef.current &&
            !electionTimerRef.current
          ) {
            electionTimerRef.current = window.setTimeout(() => {
              electionTimerRef.current = null;
              const remaining = playersRef.current.slice().sort((a, b) => a.joinedAt - b.joinedAt);
              if (remaining.some((player) => player.id === hostRef.current)) return;
              const successor = remaining[0];
              if (!successor) return;
              hostRef.current = successor.id;
              setHostId(successor.id);
              if (successor.id === meRef.current.id) {
                toast.info("أصبحت مضيف الغرفة بعد خروج المضيف السابق");
                void trackPresence(readyRef.current, true);
                void publishSnapshot(stateRef.current, successor.id);
              }
            }, 1200);
          }
        })
        .subscribe(async (status: string) => {
          if (status === "SUBSCRIBED") {
            setConnecting(false);
            setConnected(true);
            await trackPresence(startingReady, startingHost === meRef.current.id);
            if (mode !== "create") {
              await sendPacket({ kind: "request-state", senderId: meRef.current.id });
              joinTimersRef.current.push(
                window.setTimeout(() => {
                  void sendPacket({ kind: "request-state", senderId: meRef.current.id });
                }, 1800),
              );
              joinTimersRef.current.push(
                window.setTimeout(() => {
                  if (!receivedSnapshotRef.current) {
                    toast.error("لم نجد غرفة نشطة بهذا الرمز");
                    void leaveRoom(false);
                  }
                }, 6500),
              );
            } else {
              await publishSnapshot(startingState, meRef.current.id);
            }
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setConnecting(false);
            setConnected(false);
            toast.error("تعذر الاتصال بالغرفة، تحقق من الإنترنت وحاول مجددًا");
          }
        });
    },
    [leaveRoom, publishSnapshot, sendPacket, trackPresence],
  );

  useEffect(() => {
    if (booting || reconnectAttemptedRef.current || typeof window === "undefined") return;
    reconnectAttemptedRef.current = true;
    try {
      const saved = JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null");
      const fresh = saved?.savedAt && Date.now() - saved.savedAt < 8 * 60 * 60 * 1000;
      if (fresh && cleanCode(saved.code).length === 6) {
        void connectRoom(saved.code, "restore", {
          state: saved.state,
          hostId: saved.hostId,
          ready: saved.ready,
        });
      } else {
        window.localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      window.localStorage.removeItem(SESSION_KEY);
    }
  }, [booting, connectRoom]);

  useEffect(() => {
    if (!roomCode || typeof window === "undefined") return;
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ code: roomCode, state, hostId, ready, savedAt: Date.now() }),
    );
  }, [roomCode, state, hostId, ready]);

  useEffect(() => () => {
    const channel = channelRef.current;
    if (channel) void supabase.removeChannel(channel);
  }, []);

  const toggleReady = async () => {
    const next = !ready;
    setReady(next);
    readyRef.current = next;
    await trackPresence(next);
  };

  const shareRoom = async () => {
    const text = `انضم لغرفة ألعاب السيف بالرمز: ${roomCode}`;
    try {
      if (navigator.share) await navigator.share({ title: "غرفة ألعاب السيف", text });
      else {
        await navigator.clipboard.writeText(roomCode);
        toast.success("تم نسخ رمز الغرفة");
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") toast.error("تعذرت المشاركة");
    }
  };

  const isHost = hostId === me.id;
  const selectedMeta = gameMeta(state.game);
  const minimumReached = players.length >= selectedMeta.minPlayers;
  const allReady = minimumReached && players.every((player) => player.ready);

  if (booting) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="size-9 animate-spin text-gold-primary" />
      </div>
    );
  }

  if (!roomCode) {
    return (
      <RoomEntry
        me={me}
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        connecting={connecting}
        onCreate={() => void connectRoom(makeRoomCode(), "create")}
        onJoin={() => void connectRoom(joinCode, "join")}
      />
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5 px-3 sm:px-5" dir="rtl">
      <RoomTopBar
        roomCode={roomCode}
        connected={connected}
        isHost={isHost}
        playersCount={players.length}
        onShare={shareRoom}
        onLeave={() => void leaveRoom()}
      />

      {state.phase === "lobby" ? (
        <Lobby
          state={state}
          players={players}
          me={me}
          isHost={isHost}
          ready={ready}
          allReady={allReady}
          minimumReached={minimumReached}
          onReady={() => void toggleReady()}
          onSelectGame={(game) => void dispatch("set-game", game)}
          onStart={() => void dispatch("start")}
        />
      ) : state.phase === "results" ? (
        <Results
          players={players}
          scores={state.scores}
          isHost={isHost}
          onLobby={() => void dispatch("lobby")}
        />
      ) : (
        <GameBoard
          state={state}
          players={players}
          me={me}
          isHost={isHost}
          now={now}
          dispatch={dispatch}
        />
      )}
    </section>
  );
}

function Surface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-border/60 bg-card shadow-xl shadow-black/5 sm:rounded-[36px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function RoomEntry({
  me,
  joinCode,
  setJoinCode,
  connecting,
  onCreate,
  onJoin,
}: {
  me: Player;
  joinCode: string;
  setJoinCode: (value: string) => void;
  connecting: boolean;
  onCreate: () => void;
  onJoin: () => void;
}) {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 px-3 sm:px-5 lg:grid-cols-[1.05fr_.95fr]" dir="rtl">
      <Surface className="relative overflow-hidden bg-gradient-to-br from-[#073f34] via-[#075744] to-[#0a241e] p-6 text-white sm:p-10">
        <div className="absolute -left-20 -top-20 size-72 rounded-full bg-gold-primary/15 blur-3xl" />
        <div className="relative space-y-7">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-3xl border border-white/15 bg-white/10">
              <Users className="size-8 text-gold-primary" />
            </div>
            <div>
              <p className="text-xs font-black tracking-[.22em] text-gold-primary">ألعاب جماعية مباشرة</p>
              <h3 className="mt-1 text-3xl font-black">غرف ألعاب السيف</h3>
            </div>
          </div>

          <p className="max-w-xl text-base font-bold leading-8 text-white/75 sm:text-lg">
            أنشئ غرفة وشارك رمزها. كل شخص يدخل من جواله، وتتحرك اللعبة والنتائج عند الجميع في نفس اللحظة.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [Wifi, "مزامنة مباشرة"],
              [ShieldCheck, "دخول بحساب العائلة"],
              [Users, "حتى 12 لاعبًا"],
            ].map(([Icon, label]) => {
              const FeatureIcon = Icon as LucideIcon;
              return (
                <div key={label as string} className="flex items-center gap-2 rounded-2xl bg-white/8 px-4 py-3">
                  <FeatureIcon className="size-4 text-gold-primary" />
                  <span className="text-xs font-black">{label as string}</span>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            disabled={connecting}
            onClick={onCreate}
            className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-gold-primary px-6 text-lg font-black text-[#10251e] shadow-xl transition active:scale-[.98] disabled:opacity-60"
          >
            {connecting ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
            إنشاء غرفة جديدة
          </button>
        </div>
      </Surface>

      <Surface className="p-6 sm:p-9">
        <div className="flex h-full flex-col justify-center gap-6">
          <div>
            <p className="text-xs font-black text-gold-primary">مرحبًا {me.name}</p>
            <h3 className="mt-2 text-2xl font-black text-primary">عندك رمز غرفة؟</h3>
            <p className="mt-2 text-sm font-bold leading-7 text-muted-foreground">
              أدخل الأرقام الستة التي أرسلها مضيف اللعبة.
            </p>
          </div>

          <label className="space-y-2">
            <span className="text-xs font-black text-muted-foreground">رمز الغرفة</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={joinCode}
              onChange={(event) => setJoinCode(cleanCode(event.target.value))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && joinCode.length === 6) onJoin();
              }}
              placeholder="••••••"
              className="h-20 w-full rounded-3xl border-2 border-border bg-muted/35 px-5 text-center text-4xl font-black tracking-[.28em] text-primary outline-none transition focus:border-gold-primary"
              dir="ltr"
            />
          </label>

          <button
            type="button"
            disabled={connecting || joinCode.length !== 6}
            onClick={onJoin}
            className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-6 text-lg font-black text-primary-foreground transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-35"
          >
            {connecting ? <Loader2 className="size-5 animate-spin" /> : <LogInIcon />}
            دخول الغرفة
          </button>
        </div>
      </Surface>
    </div>
  );
}

function LogInIcon() {
  return <ArrowRight className="size-5 rotate-180" />;
}

function RoomTopBar({
  roomCode,
  connected,
  isHost,
  playersCount,
  onShare,
  onLeave,
}: {
  roomCode: string;
  connected: boolean;
  isHost: boolean;
  playersCount: number;
  onShare: () => void;
  onLeave: () => void;
}) {
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      toast.success("تم نسخ رمز الغرفة");
    } catch {
      toast.error("تعذر نسخ الرمز");
    }
  };

  return (
    <Surface className="sticky top-2 z-20 overflow-hidden bg-card/95 p-3 backdrop-blur-xl sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onLeave}
            aria-label="مغادرة الغرفة"
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground transition hover:text-destructive"
          >
            <LogOut className="size-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              {connected ? <Wifi className="size-4 text-emerald-500" /> : <WifiOff className="size-4 text-rose-500" />}
              <span className="text-xs font-black text-muted-foreground">
                {connected ? "متصل مباشر" : "جاري الاتصال"} · {playersCount} لاعبين
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xl font-black tracking-[.18em] text-primary" dir="ltr">{roomCode}</span>
              {isHost && (
                <span className="rounded-full bg-gold-primary/15 px-2 py-1 text-[10px] font-black text-gold-primary">المضيف</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyCode}
            className="flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-muted/50 px-3 text-xs font-black text-primary"
          >
            <Clipboard className="size-4" />
            <span className="hidden sm:inline">نسخ الرمز</span>
          </button>
          <button
            type="button"
            onClick={onShare}
            className="flex min-h-11 items-center gap-2 rounded-2xl bg-gold-primary px-4 text-xs font-black text-[#10251e]"
          >
            <Share2 className="size-4" /> مشاركة
          </button>
        </div>
      </div>
    </Surface>
  );
}

function Lobby({
  state,
  players,
  me,
  isHost,
  ready,
  allReady,
  minimumReached,
  onReady,
  onSelectGame,
  onStart,
}: {
  state: RoomState;
  players: Player[];
  me: Player;
  isHost: boolean;
  ready: boolean;
  allReady: boolean;
  minimumReached: boolean;
  onReady: () => void;
  onSelectGame: (game: GameKey) => void;
  onStart: () => void;
}) {
  const selected = gameMeta(state.game);
  const SelectedIcon = selected.icon;
  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
      <Surface className="p-5 sm:p-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-gold-primary">اختر اللعبة</p>
            <h3 className="mt-1 text-2xl font-black text-primary">ما الذي سنلعبه؟</h3>
          </div>
          {!isHost && <span className="text-xs font-bold text-muted-foreground">الاختيار عند المضيف</span>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {GAMES.map((game) => {
            const Icon = game.icon;
            const active = game.id === state.game;
            return (
              <button
                key={game.id}
                type="button"
                disabled={!isHost}
                onClick={() => onSelectGame(game.id)}
                className={cn(
                  "relative min-h-32 rounded-3xl border-2 p-4 text-right transition",
                  active
                    ? "border-gold-primary bg-gold-primary/10 shadow-lg shadow-gold-primary/10"
                    : "border-border/60 bg-muted/25 hover:border-gold-primary/40",
                  !isHost && "cursor-default",
                )}
              >
                {active && (
                  <span className="absolute left-3 top-3 flex size-7 items-center justify-center rounded-full bg-gold-primary text-[#10251e]">
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                )}
                <Icon className={cn("size-7", active ? "text-gold-primary" : "text-primary")} />
                <p className="mt-3 text-base font-black text-primary">{game.label}</p>
                <p className="mt-1 text-[11px] font-bold leading-5 text-muted-foreground">{game.short}</p>
              </button>
            );
          })}
        </div>
      </Surface>

      <div className="space-y-5">
        <Surface className="p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-gold-primary">الموجودون الآن</p>
              <h3 className="mt-1 text-xl font-black text-primary">{players.length} لاعبين</h3>
            </div>
            <Users className="size-7 text-primary" />
          </div>
          <div className="mt-5 space-y-2">
            {players.map((player) => (
              <div key={player.id} className="flex items-center gap-3 rounded-2xl bg-muted/35 p-3">
                <PlayerAvatar player={player} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-primary">
                    {player.name} {player.id === me.id ? "(أنت)" : ""}
                  </p>
                  <p className={cn("text-[11px] font-bold", player.ready ? "text-emerald-600" : "text-muted-foreground")}>
                    {player.ready ? "جاهز" : "بانتظار الجاهزية"}
                  </p>
                </div>
                {player.id === (players.find((item) => item.isHost)?.id ?? "") || player.isHost ? (
                  <Crown className="size-5 text-gold-primary" />
                ) : player.ready ? (
                  <Check className="size-5 text-emerald-500" />
                ) : null}
              </div>
            ))}
          </div>
        </Surface>

        <Surface className="overflow-hidden p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gold-primary/15">
              <SelectedIcon className="size-6 text-gold-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground">اللعبة المختارة</p>
              <p className="text-lg font-black text-primary">{selected.label}</p>
            </div>
          </div>

          {!isHost && (
            <button
              type="button"
              onClick={onReady}
              className={cn(
                "mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-black transition active:scale-[.98]",
                ready ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground",
              )}
            >
              <Check className="size-5" /> {ready ? "أنا جاهز" : "اضغط عندما تكون جاهزًا"}
            </button>
          )}

          {isHost && (
            <button
              type="button"
              disabled={!allReady}
              onClick={onStart}
              className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-black text-primary-foreground transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Play className="size-5 fill-current" /> بدء اللعبة عند الجميع
            </button>
          )}
          <p className="mt-3 text-center text-[11px] font-bold text-muted-foreground">
            {!minimumReached
              ? `تحتاج اللعبة إلى ${selected.minPlayers} لاعبين على الأقل`
              : allReady
                ? "الكل جاهز — يمكن البدء"
                : "بانتظار جاهزية جميع اللاعبين"}
          </p>
        </Surface>
      </div>
    </div>
  );
}

function PlayerAvatar({ player, size = "md" }: { player: Player; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "size-8 text-xs" : size === "lg" ? "size-16 text-xl" : "size-11 text-sm";
  return player.avatarUrl ? (
    <img src={player.avatarUrl} alt="" className={cn(sizeClass, "shrink-0 rounded-full object-cover ring-2 ring-gold-primary/35")} />
  ) : (
    <span className={cn(sizeClass, "flex shrink-0 items-center justify-center rounded-full bg-primary font-black text-primary-foreground ring-2 ring-gold-primary/35")}>
      {player.name.slice(0, 1)}
    </span>
  );
}

function Results({
  players,
  scores,
  isHost,
  onLobby,
}: {
  players: Player[];
  scores: Record<string, number>;
  isHost: boolean;
  onLobby: () => void;
}) {
  const ranked = players.slice().sort((a, b) => scoreFor(scores, b.id) - scoreFor(scores, a.id));
  return (
    <Surface className="mx-auto max-w-2xl overflow-hidden p-6 text-center sm:p-10">
      <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-gold-primary/15">
        <Trophy className="size-10 text-gold-primary" />
      </div>
      <h3 className="mt-4 text-3xl font-black text-primary">النتيجة النهائية</h3>
      <div className="mt-7 space-y-3 text-right">
        {ranked.map((player, index) => (
          <div key={player.id} className={cn("flex items-center gap-3 rounded-3xl p-4", index === 0 ? "bg-gold-primary/15" : "bg-muted/35")}>
            <span className="flex size-9 items-center justify-center rounded-full bg-card text-sm font-black text-primary">{index + 1}</span>
            <PlayerAvatar player={player} />
            <span className="min-w-0 flex-1 truncate font-black text-primary">{player.name}</span>
            <span className="text-2xl font-black text-gold-primary">{scoreFor(scores, player.id)}</span>
          </div>
        ))}
      </div>
      {isHost ? (
        <button type="button" onClick={onLobby} className="mt-7 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-black text-primary-foreground">
          <RefreshCcw className="size-5" /> العودة للغرفة
        </button>
      ) : (
        <p className="mt-7 text-sm font-bold text-muted-foreground">بانتظار المضيف لبدء جولة جديدة</p>
      )}
    </Surface>
  );
}

function GameBoard({
  state,
  players,
  me,
  isHost,
  now,
  dispatch,
}: {
  state: RoomState;
  players: Player[];
  me: Player;
  isHost: boolean;
  now: number;
  dispatch: (type: string, value?: any) => Promise<void>;
}) {
  const meta = gameMeta(state.game);
  const GameIcon = meta.icon;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
      <Surface className="min-h-[520px] overflow-hidden p-5 sm:p-8">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gold-primary/15">
              <GameIcon className="size-6 text-gold-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground">الجولة {state.round + 1}</p>
              <h3 className="text-xl font-black text-primary">{meta.label}</h3>
            </div>
          </div>
          {isHost && state.game !== "baloot" && (
            <button type="button" onClick={() => void dispatch("finish")} className="rounded-xl bg-muted px-4 py-2 text-xs font-black text-muted-foreground">
              إنهاء اللعبة
            </button>
          )}
        </div>

        {state.game === "trivia" && <TriviaGame state={state} players={players} me={me} isHost={isHost} dispatch={dispatch} />}
        {state.game === "judge" && <JudgeGame state={state} players={players} me={me} isHost={isHost} dispatch={dispatch} />}
        {state.game === "challenge30" && <ChallengeGame state={state} players={players} me={me} isHost={isHost} now={now} dispatch={dispatch} />}
        {state.game === "auction" && <AuctionRoom state={state} players={players} me={me} isHost={isHost} dispatch={dispatch} />}
        {state.game === "word-duel" && <WordDuelRoom state={state} players={players} me={me} dispatch={dispatch} />}
        {state.game === "wheel" && <WheelRoom state={state} players={players} isHost={isHost} dispatch={dispatch} />}
        {state.game === "baloot" && <BalootRoom state={state} isHost={isHost} dispatch={dispatch} />}
      </Surface>

      <ScoreRail players={players} scores={state.scores} hostId={players.find((player) => player.isHost)?.id} />
    </div>
  );
}

function ScoreRail({ players, scores, hostId }: { players: Player[]; scores: Record<string, number>; hostId?: string }) {
  const ranked = players.slice().sort((a, b) => scoreFor(scores, b.id) - scoreFor(scores, a.id));
  return (
    <Surface className="h-fit p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Medal className="size-5 text-gold-primary" />
        <h4 className="font-black text-primary">اللاعبون والنتائج</h4>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {ranked.map((player, index) => (
          <div key={player.id} className="flex items-center gap-2 rounded-2xl bg-muted/35 p-2.5">
            <span className="w-5 text-center text-xs font-black text-muted-foreground">{index + 1}</span>
            <PlayerAvatar player={player} size="sm" />
            <span className="min-w-0 flex-1 truncate text-xs font-black text-primary">{player.name}</span>
            {player.id === hostId && <Crown className="size-3.5 text-gold-primary" />}
            <span className="rounded-xl bg-card px-2 py-1 text-xs font-black text-gold-primary">{scoreFor(scores, player.id)}</span>
          </div>
        ))}
      </div>
    </Surface>
  );
}

function PrimaryAction({
  children,
  onClick,
  disabled,
  tone = "primary",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "primary" | "gold" | "muted" | "success" | "danger";
}) {
  const tones = {
    primary: "bg-primary text-primary-foreground",
    gold: "bg-gold-primary text-[#10251e]",
    muted: "bg-muted text-muted-foreground",
    success: "bg-emerald-600 text-white",
    danger: "bg-rose-600 text-white",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-35",
        tones[tone],
      )}
    >
      {children}
    </button>
  );
}

function TriviaGame({
  state,
  players,
  me,
  isHost,
  dispatch,
}: {
  state: RoomState;
  players: Player[];
  me: Player;
  isHost: boolean;
  dispatch: (type: string, value?: any) => Promise<void>;
}) {
  const data = state.data;
  const question = TRIVIA_QUESTIONS[data.questionIndex % TRIVIA_QUESTIONS.length];
  const myAnswer = data.answers[me.id] as number | undefined;
  const answerCount = Object.keys(data.answers).length;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-[30px] bg-gradient-to-br from-primary to-[#0a493a] p-6 text-center text-white sm:p-9">
        <p className="text-xs font-black text-gold-primary">سؤال {state.round + 1}</p>
        <h4 className="mt-3 text-2xl font-black leading-relaxed sm:text-3xl">{question.q}</h4>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {question.options.map((option, index) => {
          const selected = myAnswer === index;
          const correct = data.revealed && question.correct === index;
          const wrong = data.revealed && selected && question.correct !== index;
          return (
            <button
              key={option}
              type="button"
              disabled={myAnswer != null || data.revealed}
              onClick={() => void dispatch("answer", index)}
              className={cn(
                "min-h-20 rounded-3xl border-2 px-5 text-right text-base font-black transition",
                selected ? "border-gold-primary bg-gold-primary/15" : "border-border bg-muted/25",
                correct && "border-emerald-500 bg-emerald-500/15 text-emerald-700",
                wrong && "border-rose-500 bg-rose-500/10 text-rose-700",
              )}
            >
              <span className="ml-3 inline-flex size-8 items-center justify-center rounded-full bg-card text-xs">
                {index + 1}
              </span>
              {option}
            </button>
          );
        })}
      </div>

      <p className="text-center text-sm font-bold text-muted-foreground">
        {data.revealed
          ? `الإجابة الصحيحة: ${question.options[question.correct]}`
          : myAnswer != null
            ? "تم تثبيت إجابتك — بانتظار بقية اللاعبين"
            : `أجاب ${answerCount} من ${players.length}`}
      </p>

      {isHost && !data.revealed && (
        <PrimaryAction onClick={() => void dispatch("reveal")} disabled={answerCount === 0} tone="gold">
          <Check className="size-5" /> كشف الإجابات للجميع
        </PrimaryAction>
      )}
      {isHost && data.revealed && (
        <PrimaryAction onClick={() => void dispatch("next")}>
          السؤال التالي <ChevronLeft className="size-5" />
        </PrimaryAction>
      )}
    </div>
  );
}

function JudgeGame({
  state,
  players,
  me,
  isHost,
  dispatch,
}: {
  state: RoomState;
  players: Player[];
  me: Player;
  isHost: boolean;
  dispatch: (type: string, value?: any) => Promise<void>;
}) {
  const data = state.data;
  const myVote = data.votes[me.id] as string | undefined;
  const counts = Object.values(data.votes as Record<string, string>).reduce<Record<string, number>>((acc, id) => {
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});
  const highest = Math.max(0, ...Object.values(counts));
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-[30px] bg-gradient-to-br from-[#6b4a12] to-[#1f180c] p-7 text-center text-white sm:p-10">
        <Gavel className="mx-auto size-9 text-gold-primary" />
        <p className="mt-3 text-xs font-black text-gold-primary">صوّت بسرية من جوالك</p>
        <h4 className="mt-3 text-2xl font-black leading-relaxed">{JUDGE_SCENARIOS[data.scenarioIndex % JUDGE_SCENARIOS.length]}</h4>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {players.map((player) => {
          const selected = myVote === player.id;
          const winner = data.revealed && highest > 0 && counts[player.id] === highest;
          return (
            <button
              key={player.id}
              type="button"
              disabled={myVote != null || data.revealed}
              onClick={() => void dispatch("vote", player.id)}
              className={cn(
                "flex min-h-20 items-center gap-3 rounded-3xl border-2 p-4 text-right transition",
                selected ? "border-gold-primary bg-gold-primary/10" : "border-border bg-muted/25",
                winner && "border-emerald-500 bg-emerald-500/15",
              )}
            >
              <PlayerAvatar player={player} />
              <span className="min-w-0 flex-1 truncate font-black text-primary">{player.name}</span>
              {data.revealed && <span className="text-xl font-black text-gold-primary">{counts[player.id] ?? 0}</span>}
            </button>
          );
        })}
      </div>

      <p className="text-center text-sm font-bold text-muted-foreground">
        {data.revealed ? "ظهرت نتيجة التصويت للجميع" : myVote ? "تم تسجيل صوتك بسرية" : "اختر شخصًا واحدًا"}
      </p>
      {isHost && !data.revealed && (
        <PrimaryAction onClick={() => void dispatch("reveal")} disabled={!Object.keys(data.votes).length} tone="gold">
          كشف نتيجة التصويت
        </PrimaryAction>
      )}
      {isHost && data.revealed && (
        <PrimaryAction onClick={() => void dispatch("next")}>موقف جديد <ChevronLeft className="size-5" /></PrimaryAction>
      )}
    </div>
  );
}

function ChallengeGame({
  state,
  players,
  me,
  isHost,
  now,
  dispatch,
}: {
  state: RoomState;
  players: Player[];
  me: Player;
  isHost: boolean;
  now: number;
  dispatch: (type: string, value?: any) => Promise<void>;
}) {
  const data = state.data;
  const active = players[data.activeIndex % Math.max(players.length, 1)];
  const seconds = Math.max(0, Math.ceil((data.endsAt - now) / 1000));
  const amActive = active?.id === me.id;

  useEffect(() => {
    if (seconds === 0 && amActive && !data.finished) void dispatch("end-turn");
  }, [seconds, amActive, data.finished, dispatch]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 text-center">
      <div className="flex items-center justify-center gap-3">
        {active && <PlayerAvatar player={active} size="lg" />}
        <div className="text-right">
          <p className="text-xs font-bold text-muted-foreground">صاحب الدور</p>
          <p className="text-xl font-black text-primary">{active?.name ?? "—"}</p>
        </div>
      </div>

      <div className={cn("rounded-[36px] border-2 p-7 sm:p-12", seconds <= 5 ? "border-rose-500 bg-rose-500/5" : "border-gold-primary bg-gold-primary/5")}>
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary text-3xl font-black text-primary-foreground">{seconds}</div>
        {amActive ? (
          <>
            <p className="mt-6 text-xs font-black text-muted-foreground">اشرح الكلمة من دون أن تقولها</p>
            <h4 className="mt-2 text-3xl font-black text-primary sm:text-5xl">
              {data.finished ? "انتهى الوقت" : CHALLENGE_WORDS[data.wordIndex % CHALLENGE_WORDS.length]}
            </h4>
          </>
        ) : (
          <>
            <Users className="mx-auto mt-6 size-10 text-gold-primary" />
            <h4 className="mt-2 text-2xl font-black text-primary">خمّن الكلمة من شرح {active?.name}</h4>
            <p className="mt-2 text-sm font-bold text-muted-foreground">الكلمة ظاهرة في جوال صاحب الدور فقط</p>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-emerald-500/10 p-4">
          <p className="text-xs font-bold text-muted-foreground">صحيح</p>
          <p className="text-3xl font-black text-emerald-600">{data.correct}</p>
        </div>
        <div className="rounded-2xl bg-muted p-4">
          <p className="text-xs font-bold text-muted-foreground">تخطي</p>
          <p className="text-3xl font-black text-primary">{data.skips}</p>
        </div>
      </div>

      {amActive && !data.finished && seconds > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <PrimaryAction onClick={() => void dispatch("correct")} tone="success"><Check className="size-5" /> صحيحة</PrimaryAction>
          <PrimaryAction onClick={() => void dispatch("skip")} tone="muted">تخطي</PrimaryAction>
        </div>
      )}
      {isHost && data.finished && (
        <PrimaryAction onClick={() => void dispatch("next")}>دور اللاعب التالي <ChevronLeft className="size-5" /></PrimaryAction>
      )}
      {!amActive && !data.finished && <p className="text-sm font-bold text-muted-foreground">التحكم الآن من جوال صاحب الدور</p>}
    </div>
  );
}

function AuctionRoom({
  state,
  players,
  me,
  isHost,
  dispatch,
}: {
  state: RoomState;
  players: Player[];
  me: Player;
  isHost: boolean;
  dispatch: (type: string, value?: any) => Promise<void>;
}) {
  const data = state.data;
  const [bid, setBid] = useState("");
  const myBid = data.bids[me.id] as number | undefined;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-[30px] bg-gradient-to-br from-primary to-[#132e27] p-7 text-center text-white sm:p-10">
        <Gavel className="mx-auto size-10 text-gold-primary" />
        <p className="mt-3 text-xs font-black text-gold-primary">قدّم أعلى مزايدة تستطيع تنفيذها</p>
        <h4 className="mt-3 text-2xl font-black leading-relaxed">{AUCTION_PROMPTS[data.promptIndex % AUCTION_PROMPTS.length]}</h4>
      </div>

      {!data.revealed && myBid == null ? (
        <div className="mx-auto flex max-w-md gap-3" dir="ltr">
          <button
            type="button"
            disabled={!bid}
            onClick={() => void dispatch("bid", Number(bid))}
            className="min-w-28 rounded-2xl bg-gold-primary px-5 font-black text-[#10251e] disabled:opacity-35"
          >
            إرسال
          </button>
          <input
            type="number"
            min={0}
            max={999}
            value={bid}
            onChange={(event) => setBid(event.target.value)}
            placeholder="مزايدتك"
            className="h-16 min-w-0 flex-1 rounded-2xl border-2 border-border bg-muted/30 px-5 text-center text-2xl font-black text-primary outline-none focus:border-gold-primary"
          />
        </div>
      ) : !data.revealed ? (
        <p className="text-center text-lg font-black text-emerald-600">تم إرسال مزايدتك: {myBid}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            disabled={!isHost || !data.revealed || Boolean(data.winnerId)}
            onClick={() => void dispatch("award", player.id)}
            className={cn(
              "flex min-h-20 items-center gap-3 rounded-3xl border-2 p-4 text-right",
              data.winnerId === player.id ? "border-gold-primary bg-gold-primary/15" : "border-border bg-muted/25",
            )}
          >
            <PlayerAvatar player={player} />
            <span className="min-w-0 flex-1 truncate font-black text-primary">{player.name}</span>
            <span className="text-2xl font-black text-gold-primary">{data.revealed ? (data.bids[player.id] ?? "—") : data.bids[player.id] != null ? "✓" : "…"}</span>
          </button>
        ))}
      </div>

      {isHost && !data.revealed && (
        <PrimaryAction onClick={() => void dispatch("reveal")} disabled={!Object.keys(data.bids).length} tone="gold">كشف جميع المزايدات</PrimaryAction>
      )}
      {isHost && data.revealed && !data.winnerId && <p className="text-center text-sm font-bold text-muted-foreground">اضغط اسم الفائز لمنحه النقطة</p>}
      {isHost && data.winnerId && (
        <PrimaryAction onClick={() => void dispatch("next")}>مزاد جديد <ChevronLeft className="size-5" /></PrimaryAction>
      )}
    </div>
  );
}

function WordDuelRoom({
  state,
  players,
  me,
  dispatch,
}: {
  state: RoomState;
  players: Player[];
  me: Player;
  dispatch: (type: string, value?: any) => Promise<void>;
}) {
  const data = state.data;
  const active = players[data.turnIndex % Math.max(players.length, 1)];
  const amActive = active?.id === me.id;
  const [word, setWord] = useState("");
  const valid = word.trim().length >= 2 && word.trim().startsWith(data.currentLetter);

  useEffect(() => setWord(""), [data.turnIndex]);

  const submit = () => {
    if (!valid) return;
    void dispatch("word", word.trim());
    setWord("");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 text-center">
      <div className="flex items-center justify-center gap-3">
        {active && <PlayerAvatar player={active} size="lg" />}
        <div className="text-right">
          <p className="text-xs font-bold text-muted-foreground">الدور الآن عند</p>
          <p className="text-xl font-black text-primary">{active?.name ?? "—"}</p>
        </div>
      </div>

      <div className="rounded-[36px] bg-gradient-to-br from-[#0b4f3e] to-[#081f1a] p-8 text-white sm:p-12">
        <p className="text-sm font-black text-gold-primary">اكتب كلمة تبدأ بحرف</p>
        <p className="mt-3 text-8xl font-black text-white">{data.currentLetter}</p>
      </div>

      {amActive ? (
        <div className="space-y-3">
          <div className="flex gap-3" dir="rtl">
            <input
              value={word}
              onChange={(event) => setWord(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && submit()}
              placeholder={`كلمة تبدأ بـ ${data.currentLetter}`}
              autoFocus
              className="h-16 min-w-0 flex-1 rounded-2xl border-2 border-border bg-muted/30 px-5 text-lg font-black text-primary outline-none focus:border-gold-primary"
            />
            <button
              type="button"
              disabled={!valid}
              onClick={submit}
              className="min-w-24 rounded-2xl bg-primary px-5 font-black text-primary-foreground disabled:opacity-35"
            >
              إرسال
            </button>
          </div>
          <button type="button" onClick={() => void dispatch("skip")} className="text-xs font-black text-muted-foreground underline underline-offset-4">
            لا أعرف — تخطي الدور
          </button>
        </div>
      ) : (
        <p className="rounded-2xl bg-muted/40 p-4 text-sm font-bold text-muted-foreground">بانتظار كلمة {active?.name}</p>
      )}

      {data.words.length > 0 && (
        <div className="text-right">
          <p className="mb-3 text-xs font-black text-muted-foreground">آخر الكلمات</p>
          <div className="flex flex-wrap gap-2">
            {data.words.slice(-10).reverse().map((item: { playerId: string; word: string }, index: number) => (
              <span key={`${item.playerId}-${item.word}-${index}`} className="rounded-full bg-gold-primary/12 px-4 py-2 text-sm font-black text-primary">
                {item.word}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WheelRoom({
  state,
  players,
  isHost,
  dispatch,
}: {
  state: RoomState;
  players: Player[];
  isHost: boolean;
  dispatch: (type: string, value?: any) => Promise<void>;
}) {
  const winner = players.find((player) => player.id === state.data.winnerId);
  const rotation = (state.data.spin ?? 0) * 1080 + ((state.data.spin ?? 0) * 137) % 360;
  return (
    <div className="mx-auto max-w-2xl space-y-7 text-center">
      <div className="relative mx-auto size-64 sm:size-80">
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 border-x-[14px] border-t-[24px] border-x-transparent border-t-gold-primary" />
        <div
          className="flex size-full items-center justify-center rounded-full border-[12px] border-primary bg-[conic-gradient(from_45deg,#d4af37,#0b5b47,#ead38a,#073f34,#d4af37)] shadow-2xl transition-transform duration-[1800ms] ease-out"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className="flex size-24 items-center justify-center rounded-full border-4 border-gold-primary bg-card shadow-xl">
            <RotateCw className="size-10 text-primary" />
          </div>
        </div>
      </div>

      {winner ? (
        <div className="rounded-3xl bg-gold-primary/15 p-6">
          <PlayerAvatar player={winner} size="lg" />
          <p className="mt-3 text-xs font-black text-gold-primary">وقع الاختيار على</p>
          <h4 className="mt-1 text-3xl font-black text-primary">{winner.name}</h4>
        </div>
      ) : (
        <p className="text-sm font-bold text-muted-foreground">القرعة تشمل كل الموجودين في الغرفة</p>
      )}

      {isHost ? (
        <PrimaryAction onClick={() => void dispatch("spin")} tone="gold">
          <RotateCw className="size-5" /> {winner ? "إعادة القرعة" : "تشغيل القرعة عند الجميع"}
        </PrimaryAction>
      ) : (
        <p className="text-sm font-bold text-muted-foreground">بانتظار المضيف لتشغيل القرعة</p>
      )}
    </div>
  );
}

function BalootRoom({
  state,
  isHost,
  dispatch,
}: {
  state: RoomState;
  isHost: boolean;
  dispatch: (type: string, value?: any) => Promise<void>;
}) {
  const data = state.data;
  const [us, setUs] = useState("");
  const [them, setThem] = useState("");
  const submit = () => {
    if (!us && !them) return;
    void dispatch("score", { us: Number(us) || 0, them: Number(them) || 0 });
    setUs("");
    setThem("");
  };
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        <div className="rounded-[32px] border-2 border-emerald-500/30 bg-emerald-500/8 p-5 text-center sm:p-8">
          <p className="text-sm font-black text-emerald-600">لنا</p>
          <p className="mt-2 text-6xl font-black tracking-tighter text-primary sm:text-8xl">{data.us}</p>
        </div>
        <div className="rounded-[32px] border-2 border-rose-500/30 bg-rose-500/8 p-5 text-center sm:p-8">
          <p className="text-sm font-black text-rose-600">لهم</p>
          <p className="mt-2 text-6xl font-black tracking-tighter text-primary sm:text-8xl">{data.them}</p>
        </div>
      </div>

      <div className="rounded-3xl bg-muted/30 p-4 sm:p-5">
        <p className="mb-3 text-center text-xs font-black text-muted-foreground">أي لاعب يقدر يسجل النتيجة من جواله</p>
        <div className="grid grid-cols-2 gap-3" dir="rtl">
          <label>
            <span className="mb-1 block text-center text-xs font-black text-emerald-600">لنا</span>
            <input type="number" min={0} value={us} onChange={(event) => setUs(event.target.value)} className="h-14 w-full rounded-2xl border-2 border-border bg-card px-3 text-center text-xl font-black text-primary outline-none focus:border-emerald-500" />
          </label>
          <label>
            <span className="mb-1 block text-center text-xs font-black text-rose-600">لهم</span>
            <input type="number" min={0} value={them} onChange={(event) => setThem(event.target.value)} className="h-14 w-full rounded-2xl border-2 border-border bg-card px-3 text-center text-xl font-black text-primary outline-none focus:border-rose-500" />
          </label>
        </div>
        <button type="button" disabled={!us && !them} onClick={submit} className="mt-3 h-14 w-full rounded-2xl bg-primary font-black text-primary-foreground disabled:opacity-35">
          تسجيل النتيجة عند الجميع
        </button>
      </div>

      {data.history?.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-black text-muted-foreground">آخر الجولات</p>
          <div className="space-y-2">
            {data.history.slice(0, 5).map((item: { us: number; them: number }, index: number) => (
              <div key={index} className="grid grid-cols-[1fr_auto_1fr] items-center rounded-2xl bg-muted/35 px-5 py-3 text-center font-black">
                <span className="text-emerald-600">+{item.us}</span>
                <span className="text-xs text-muted-foreground">جولة {data.history.length - index}</span>
                <span className="text-rose-600">+{item.them}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isHost && (
        <div className="grid gap-3 sm:grid-cols-3">
          <PrimaryAction onClick={() => void dispatch("undo")} disabled={!data.history?.length} tone="muted">
            تراجع
          </PrimaryAction>
          <PrimaryAction onClick={() => void dispatch("reset-score")} tone="danger">
            تصفير الصكّة
          </PrimaryAction>
          <PrimaryAction onClick={() => void dispatch("finish")} tone="gold">
            إنهاء الصكّة
          </PrimaryAction>
        </div>
      )}
    </div>
  );
}
