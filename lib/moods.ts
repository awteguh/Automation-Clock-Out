// Mood options sent to /api/attendance/mood alongside each clock-in/out.
// The API expects { emoji: <key> } — the key string IS the value to send.
export interface Mood {
  key: string;
  name: string;
  emoji: string;
}

export const MOODS: Mood[] = [
  { key: "moodExcited", name: "Excited", emoji: "🤩" },
  { key: "moodHappy", name: "Happy", emoji: "😊" },
  { key: "moodEnergetic", name: "Energetic", emoji: "🥳" },
  { key: "moodGrateful", name: "Grateful", emoji: "😇" },
  { key: "moodNeutral", name: "Neutral", emoji: "😐" },
  { key: "moodTired", name: "Tired", emoji: "🥱" },
  { key: "moodSleepy", name: "Sleepy", emoji: "😴" },
  { key: "moodSad", name: "Sad", emoji: "😔" },
  { key: "moodStressed", name: "Stressed", emoji: "🥵" },
  { key: "moodAngry", name: "Angry", emoji: "😡" },
  { key: "moodSick", name: "Sick", emoji: "🤒" },
  { key: "moodCool", name: "Cool", emoji: "😎" },
];

export const DEFAULT_MOOD = "moodNeutral";

/** Look up a mood by key (falls back to a neutral placeholder). */
export function moodByKey(key: string | null | undefined): Mood {
  return (
    MOODS.find((m) => m.key === key) ?? {
      key: key ?? "",
      name: key ?? "—",
      emoji: "❓",
    }
  );
}
