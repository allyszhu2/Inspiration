"use client";

import type { Card } from "@/lib/types";
import { formatDay, formatMonth } from "@/lib/utils";
import { CardItem, ListRow } from "./CardItem";

interface ViewProps {
  cards: Card[];
  onOpen: (card: Card) => void;
  onTag: (tag: string) => void;
}

export function GridView({ cards, onOpen, onTag }: ViewProps) {
  return (
    <div className="grid">
      {cards.map((c) => (
        <CardItem key={c.id} card={c} onOpen={onOpen} onTag={onTag} />
      ))}
    </div>
  );
}

export function ListView({ cards, onOpen, onTag }: ViewProps) {
  return (
    <div className="list">
      {cards.map((c) => (
        <ListRow key={c.id} card={c} onOpen={onOpen} onTag={onTag} />
      ))}
    </div>
  );
}

export function TimelineView({ cards, onOpen, onTag }: ViewProps) {
  // cards arrive sorted newest-first; group into months, then days
  const months: { label: string; days: { label: string; cards: Card[] }[] }[] =
    [];
  for (const card of cards) {
    const monthLabel = formatMonth(card.createdAt);
    const dayLabel = formatDay(card.createdAt);
    let month = months[months.length - 1];
    if (!month || month.label !== monthLabel) {
      month = { label: monthLabel, days: [] };
      months.push(month);
    }
    let day = month.days[month.days.length - 1];
    if (!day || day.label !== dayLabel) {
      day = { label: dayLabel, cards: [] };
      month.days.push(day);
    }
    day.cards.push(card);
  }

  return (
    <div className="timeline">
      {months.map((month) => (
        <section key={month.label}>
          <h2 className="timeline-month">{month.label}</h2>
          {month.days.map((day) => (
            <div className="timeline-day" key={day.label}>
              <div className="timeline-date">{day.label}</div>
              <div className="timeline-cards">
                {day.cards.map((c) => (
                  <CardItem key={c.id} card={c} onOpen={onOpen} onTag={onTag} />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
