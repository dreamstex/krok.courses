export function isMetroStationsGoal(goalText: string): boolean {
  const isMetro = /(метро|subway)/i.test(goalText);
  const mentionsStations = /(станц|station|назв)/i.test(goalText);
  return isMetro && mentionsStations;
}
