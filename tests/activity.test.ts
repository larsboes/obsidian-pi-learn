import { expect, test } from 'bun:test';
import { parseActivity, queueDepth, type QueueActivity } from '../src/activity';

const q: QueueActivity = {
  version: 1, kind: 'queue', title: 'Bounded queue', prompt: 'Predict the trend',
  capacity: 20, arrival: 8, service: 6, initial: 0, seconds: 20,
};

test('the queue model clamps, stays balanced and drains existing backlog', () => {
  expect([0, 5, 10, 20].map((t) => queueDepth(q, 6, t))).toEqual([0, 10, 20, 20]);
  expect(queueDepth(q, 8, 20)).toBe(0);
  const loaded = { ...q, initial: 10 };
  expect(queueDepth(loaded, 8, 20)).toBe(10);
  expect([0, 2, 5, 20].map((t) => queueDepth(loaded, 10, t))).toEqual([10, 6, 0, 0]);
});

test('the activity protocol accepts only a bounded queue shape', () => {
  expect(parseActivity(JSON.stringify(q))).toEqual(q);
  for (const change of [{ version: 2 }, { capacity: 0 }, { initial: 21 }, { arrival: -1 },
    { service: 0.5 }, { seconds: 121 }, { path: 'demo.html' }, { script: 'inert' }]) {
    expect(parseActivity(JSON.stringify({ ...q, ...change }))).toBeNull();
  }
  expect(parseActivity('null')).toBeNull();
  expect(parseActivity('{not valid JSON}')).toBeNull();
});
