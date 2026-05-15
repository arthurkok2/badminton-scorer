// src/animations/animationAssets.ts
import type { AnimationEventType } from './types';

const VIDEO_MAP: Record<AnimationEventType, string[]> = {
  match_won:   ['animations/match_won_1.webm', 'animations/match_won_2.webm'],
  shutout:     ['animations/shutout_1.webm'],
  bagel:       ['animations/bagel_1.webm', 'animations/bagel_2.webm'],
  match_point: ['animations/match_point_1.webm', 'animations/match_point_2.webm'],
  deuce:       ['animations/deuce_1.webm'],
  streak_9:    ['animations/streak_9_1.webm', 'animations/streak_9_2.webm'],
  streak_6:    ['animations/streak_6_1.webm', 'animations/streak_6_2.webm'],
  streak_3:    ['animations/streak_3_1.webm', 'animations/streak_3_2.webm'],
  comeback:    ['animations/comeback_1.webm', 'animations/comeback_2.webm'],
  first_to_11: ['animations/first_to_11_1.webm'],
  score_6_7:   ['animations/score_6_7_1.webm'],
};

export function getVideoUrl(type: AnimationEventType): string {
  const options = VIDEO_MAP[type];
  return `${import.meta.env.BASE_URL}${options[Math.floor(Math.random() * options.length)]}`;
}
