export interface LevelData {
  title: string;
  map: readonly string[];
}

export const LEVELS: readonly LevelData[] = [
  {
    title: "Niveau 1 - Tutoriel",
    map: [
      "#####",
      "#@$.#",
      "#####",
    ],
  },
  {
    title: "Niveau 2 - Deux étapes",
    map: [
      "######",
      "#  . #",
      "#    #",
      "# $  #",
      "# @  #",
      "######",
    ],
  },
  {
    title: "Niveau 3 - Contournement",
    map: [
      "######",
      "#@   #",
      "# $  #",
      "#  . #",
      "######",
    ],
  },
  {
    title: "Niveau 4 - Deux caisses",
    map: [
      "######",
      "#.   #",
      "#.$  #",
      "# $  #",
      "# @  #",
      "######",
    ],
  },
  {
    title: "Niveau 5 - Travail d'équipe",
    map: [
      "#######",
      "#. .  #",
      "# $$  #",
      "#  @  #",
      "#######",
    ],
  },
];
