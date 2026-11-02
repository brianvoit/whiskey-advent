/**
 * Which door the homepage's hero calendar lights. Outside December it's an
 * example day (random per visit, passed in); in December it's the real day of
 * the month, and 25 from Christmas Day on (every door open, none lit).
 */
export function getTodayDoor(now: Date, exampleDay: number): number {
  if (now.getMonth() !== 11) return exampleDay;
  return Math.min(now.getDate(), 25);
}

export type DoorState = "today" | "past" | "closed";

export function doorState(n: number, todayDoor: number): DoorState {
  if (n === todayDoor) return "today";
  if (n < todayDoor) return "past";
  return "closed";
}
