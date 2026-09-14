import { describe, expect, test } from 'vitest';
import { formatRoute, parseRoute, type Route } from '../../src/app/router';

describe('parseRoute', () => {
  test.each<[string, Route]>([
    ['', { name: 'home', lang: 'pl' }],
    ['#', { name: 'home', lang: 'pl' }],
    ['#en/', { name: 'home', lang: 'en' }],
    ['#uk', { name: 'home', lang: 'uk' }],
    ['#en/topic-3', { name: 'explore', lang: 'en', topic: 3, step: 0 }],
    ['#en/topic-3/explore', { name: 'explore', lang: 'en', topic: 3, step: 0 }],
    ['#pl/topic-8/explore/4', { name: 'explore', lang: 'pl', topic: 8, step: 3 }],
    ['#uk/topic-1/practice', { name: 'practice', lang: 'uk', topic: 1 }],
    ['#en/rehearsal', { name: 'rehearsal', lang: 'en' }],
    ['#en/lab', { name: 'lab', lang: 'en' }],
    ['#uk/cheatsheet', { name: 'cheatsheet', lang: 'uk' }],
    ['#uk/cheatsheet/2', { name: 'home', lang: 'uk' }],
    ['#pl/worksheet', { name: 'worksheet', lang: 'pl' }],
    ['#en/class-quiz', { name: 'class-quiz', lang: 'en', seed: null }],
    ['#en/class-quiz?seed=5b-A', { name: 'class-quiz', lang: 'en', seed: '5b-A' }],
    ['#en/class-quiz?seed=<script>', { name: 'class-quiz', lang: 'en', seed: null }],
    ['#topic-2/practice', { name: 'practice', lang: 'pl', topic: 2 }],
    ['#en/topic-9', { name: 'explore', lang: 'en', topic: 9, step: 0 }],
    ['#uk/topic-9/explore/8', { name: 'explore', lang: 'uk', topic: 9, step: 7 }],
    ['#en/topic-10', { name: 'home', lang: 'en' }],
    ['#en/topic-0', { name: 'home', lang: 'en' }],
    ['#en/topic-2/explore/0', { name: 'home', lang: 'en' }],
    ['#en/nonsense/deep', { name: 'home', lang: 'en' }],
    ['#de/topic-1', { name: 'home', lang: 'pl' }],
  ])('%s', (hash, expected) => {
    expect(parseRoute(hash, 'pl')).toEqual(expected);
  });
});

describe('formatRoute', () => {
  test('round trips canonical forms', () => {
    for (const hash of ['#en/', '#pl/topic-3/explore', '#pl/topic-8/explore/4', '#uk/topic-1/practice', '#en/rehearsal', '#en/lab', '#pl/cheatsheet', '#en/worksheet', '#en/class-quiz', '#en/class-quiz?seed=abc']) {
      expect(formatRoute(parseRoute(hash, 'en'))).toBe(hash);
    }
  });
});
