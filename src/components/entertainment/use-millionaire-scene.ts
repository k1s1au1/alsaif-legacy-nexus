import { useEffect, useRef, useState } from "react";
import { playGameSfx, type GameSfx } from "@/lib/game-sfx";
import {
  MILLIONAIRE_TIMING as TIME,
  millionairePropertyAt,
  type MillionaireData,
  type MillionaireChance,
} from "./millionaire-presentation";

export function useMillionaireScene(data: MillionaireData, sound: boolean, reducedMotion: boolean) {
  const [visual, setVisual] = useState(data);
  const [positions, setPositions] = useState(data.positions ?? {});
  const [phase, setPhase] = useState<"ready" | "rolling" | "moving" | "chance" | "building">(
    "ready",
  );
  const [journey, setJourney] = useState({
    movement: data.movement ?? null,
    step: data.movement?.steps.length ?? 0,
  });
  const [chance, setChance] = useState<MillionaireChance | null>(null);
  const [chanceRevealed, setChanceRevealed] = useState(false);
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  const [buildings, setBuildings] = useState<number[]>([]);
  const [cameraFocus, setCameraFocus] = useState<number | null>(null);
  const previous = useRef(data);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const play = (kind: GameSfx) => {
    if (soundRef.current) playGameSfx(kind);
  };

  useEffect(() => {
    const old = previous.current;
    previous.current = data;
    const timers: number[] = [];
    const later = (delay: number, action: () => void) =>
      timers.push(window.setTimeout(action, delay));
    const reduce = reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const newRoll = data.roll
      ? data.roll.sequence !== old.roll?.sequence
      : Boolean(data.rolled && !old.rolled && data.dice);
    const movement = data.movement;
    const newMovement = Boolean(movement && movement.sequence !== old.movement?.sequence);
    const newChance =
      data.chance && data.chance.sequence !== old.chance?.sequence ? data.chance : null;
    const changedBuildings = Object.keys(data.properties ?? {})
      .map(Number)
      .filter((index) => {
        const before = millionairePropertyAt(old, index);
        const after = millionairePropertyAt(data, index);
        return after && (after.ownerId !== before?.ownerId || after.level !== before?.level);
      });
    const cashChanges = Object.fromEntries(
      Object.entries(data.cash ?? {})
        .map(([id, amount]) => [id, amount - Number(old.cash?.[id] ?? amount)] as const)
        .filter(([, amount]) => amount !== 0),
    );
    const settle = () => {
      setVisual(data);
      setDeltas(cashChanges);
      setBuildings(changedBuildings);
      if (Object.keys(cashChanges).length) play("coin");
      if (changedBuildings.length) {
        play("build");
        setCameraFocus(changedBuildings[0]);
      }
      later(TIME.build, () => {
        setDeltas({});
        setBuildings([]);
        setCameraFocus(null);
      });
    };

    setChance(null);
    setChanceRevealed(false);
    setDeltas({});
    setBuildings([]);
    setCameraFocus(null);
    if (!data.movement) setJourney({ movement: null, step: 0 });
    if (reduce || (!newRoll && !newMovement && !newChance && !changedBuildings.length)) {
      settle();
      setPositions(data.positions ?? {});
      setPhase("ready");
      if (newMovement && movement) setJourney({ movement, step: movement.steps.length });
      if (newChance) {
        setChance(newChance);
        setChanceRevealed(true);
        later(TIME.chance, () => setChance(null));
      }
      return () => timers.forEach(window.clearTimeout);
    }

    const rollDelay = newRoll ? TIME.roll : 0;
    let arrival = rollDelay;
    if (newRoll) {
      setPhase("rolling");
      play("dice");
    } else if (newMovement) setPhase("moving");
    else if (changedBuildings.length) setPhase("building");

    if (newMovement && movement) {
      const route = [...movement.steps];
      if (route[route.length - 1] !== movement.to) route.push(movement.to);
      setPositions({ ...data.positions, [movement.playerId]: movement.from });
      setJourney({ movement, step: 0 });
      later(rollDelay, () => setPhase("moving"));
      route.forEach((position, index) => {
        later(rollDelay + (index + 1) * TIME.step, () => {
          setPositions((current) => ({ ...current, [movement.playerId]: position }));
          setJourney({ movement, step: Math.min(index + 1, movement.steps.length) });
          play("tick");
        });
      });
      arrival += route.length * TIME.step;
      later(arrival, () => {
        setCameraFocus(movement.to);
        later(TIME.arrival, () => setCameraFocus(null));
      });
    } else setPositions(data.positions ?? {});

    if (newChance) {
      later(arrival, () => {
        setPhase("chance");
        setChance(newChance);
        play("draw");
      });
      later(arrival + 550, () => {
        setChanceRevealed(true);
        play("flip");
      });
      later(arrival + TIME.chance, () => setChance(null));
    }
    later(arrival + (newChance ? 600 : 0), settle);
    later(
      arrival +
        (newChance ? TIME.chance : 0) +
        (changedBuildings.length ? TIME.build : TIME.arrival),
      () => setPhase("ready"),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [data, reducedMotion]);

  return {
    visual,
    positions,
    phase,
    busy: phase !== "ready",
    journey,
    chance,
    chanceRevealed,
    deltas,
    buildings,
    cameraFocus,
  };
}
