// src/animations/animationAssets.ts
import type { AnimationEventType } from './types';

const GIF_MAP: Record<AnimationEventType, string[]> = {
  match_won:   ['animations/match_won_1.gif', 'animations/match_won_2.gif'],
  shutout:     ['animations/shutout_1.gif'],
  bagel:       ['animations/bagel_1.gif', 'animations/bagel_2.gif'],
  match_point: ['animations/match_point_1.gif', 'animations/match_point_2.gif'],
  deuce:       ['animations/deuce_1.gif'],
  streak_9:    ['animations/streak_9_1.gif', 'animations/streak_9_2.gif'],
  streak_6:    ['animations/streak_6_1.gif'],
  streak_3:    ['animations/streak_3_1.gif', 'animations/streak_3_2.gif'],
  comeback:    ['animations/comeback_1.gif', 'animations/comeback_2.gif'],
  first_to_11: ['animations/first_to_11_1.gif'],
};

export function getGifUrl(type: AnimationEventType): string {
  const options = GIF_MAP[type];
  return `${import.meta.env.BASE_URL}${options[Math.floor(Math.random() * options.length)]}`;
}
