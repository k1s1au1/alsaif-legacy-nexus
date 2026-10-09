import { useEffect, useState, type CSSProperties } from "react";
import { Crown, RefreshCcw, Trophy } from "lucide-react";
import { playGameSfx } from "@/lib/game-sfx";
import {
  MILLIONAIRE_COLORS as COLORS,
  millionaireCash as cash,
  millionaireInvestment,
  millionairePropertyAt,
  type MillionaireData,
  type MillionairePlayerView,
} from "./millionaire-presentation";
import { MILLIONAIRE_BOARD } from "./millionaire-board";
import "./millionaire-game-room.css";

const VICTORIES: Record<string, string> = {
  line: "احتكار جهة كاملة",
  triple: "احتكار ثلاث مجموعات",
  tourism: "احتكار المواقع السياحية",
  bankruptcy: "إفلاس المنافسين",
};

export function MillionaireResults({
  data,
  players,
  isHost,
  onLobby,
  fullscreen = false,
  actionLabel = "العودة إلى الغرفة",
  sound,
}: {
  data: MillionaireData;
  players: MillionairePlayerView[];
  isHost: boolean;
  onLobby: () => void;
  fullscreen?: boolean;
  actionLabel?: string;
  sound?: boolean;
}) {
  const [preferences] = useState(() => {
    try {
      return typeof window === "undefined"
        ? {}
        : JSON.parse(localStorage.getItem("alsaif-game-experience-v2") ?? "{}");
    } catch {
      return {};
    }
  });
  const winner = players.find((player) => player.id === data.winnerId);
  const ranked = players
    .map((player, seat) => {
      const properties = MILLIONAIRE_BOARD.map((space, index) => ({
        space,
        property: millionairePropertyAt(data, index),
      })).filter((item) => item.property?.ownerId === player.id);
      const money = Number(data.cash?.[player.id] ?? 0);
      const investment = millionaireInvestment(data, player.id);
      return { player, seat, properties, money, investment, wealth: money + investment };
    })
    .sort(
      (a, b) =>
        Number(b.player.id === data.winnerId) - Number(a.player.id === data.winnerId) ||
        Number(Boolean(data.bankrupt?.[a.player.id])) -
          Number(Boolean(data.bankrupt?.[b.player.id])) ||
        b.wealth - a.wealth,
    );
  useEffect(() => {
    try {
      if (sound ?? preferences.sound !== false) playGameSfx("win");
    } catch {
      /* Sound is optional. */
    }
  }, [sound, preferences.sound]);
  return (
    <section
      className={
        "millionaire-results" +
        (fullscreen ? " is-fullscreen" : "") +
        (preferences.reducedMotion ? " is-reduced-motion" : "")
      }
      dir="rtl"
      aria-label="نتائج رحلة المليونير"
    >
      <div className="millionaire-results-confetti" aria-hidden="true">
        {Array.from({ length: 32 }, (_, index) => (
          <i
            key={index}
            style={
              {
                left: ((index * 31) % 100) + "%",
                background: COLORS[index % 4],
                animationDelay: (index % 8) * 0.12 + "s",
                "--drift": (index % 2 ? 1 : -1) * 70 + "px",
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="millionaire-results-content">
        <div className="millionaire-results-trophy">
          <Trophy />
        </div>
        <p>اكتملت رحلة المليونير</p>
        <h1>{winner ? winner.name + " فاز بالرحلة" : "النتيجة النهائية"}</h1>
        <span className="millionaire-victory-type">
          <Crown />
          {VICTORIES[data.victoryType ?? ""] ?? "ملخص المباراة"}
        </span>
        <div className="millionaire-results-table-wrap">
          <table>
            <caption>الفائز أولًا، ثم ترتيب بقية اللاعبين بحسب الثروة</caption>
            <thead>
              <tr>
                <th>الترتيب واللاعب</th>
                <th>الكاش</th>
                <th>الأملاك</th>
                <th>قيمة الاستثمار</th>
                <th>الثروة</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((item, rank) => (
                <tr
                  key={item.player.id}
                  className={item.player.id === data.winnerId ? "is-winner" : ""}
                >
                  <th scope="row">
                    <span className="millionaire-result-player">
                      <b>{rank + 1}</b>
                      <i style={{ background: COLORS[item.seat % 4] }}>{item.seat + 1}</i>
                      <span>
                        {item.player.name}
                        {data.bankrupt?.[item.player.id] && <small>مفلس</small>}
                      </span>
                    </span>
                  </th>
                  <td dir="ltr">{cash(item.money)}</td>
                  <td>{item.properties.length}</td>
                  <td dir="ltr">{cash(item.investment)}</td>
                  <td dir="ltr">
                    <strong>{cash(item.wealth)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="millionaire-results-assets">
          {ranked.map((item) => (
            <article key={item.player.id}>
              <strong>
                <i style={{ background: COLORS[item.seat % 4] }} />
                أملاك {item.player.name}
              </strong>
              <p>
                {item.properties.length
                  ? item.properties.map(({ space }) => space.name).join(" · ")
                  : "لا توجد أملاك"}
              </p>
            </article>
          ))}
        </div>
        {isHost ? (
          <button type="button" className="millionaire-primary" onClick={onLobby}>
            <RefreshCcw />
            {actionLabel}
          </button>
        ) : (
          <p className="millionaire-results-wait">بانتظار المضيف لبدء مباراة جديدة</p>
        )}
      </div>
    </section>
  );
}
