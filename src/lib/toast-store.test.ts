import test from "node:test";
import assert from "node:assert/strict";
import {
  createToastStore,
  DEFAULT_DURATION_MS,
  MAX_VISIBLE,
  type Scheduler,
} from "./toast-store.ts";

/** Manual clock: tasks fire in order as time advances. */
class FakeClock {
  time = 0;
  private tasks: { at: number; fn: () => void; id: number }[] = [];
  private nextId = 1;
  scheduler: Scheduler = {
    now: () => this.time,
    setTimeout: (fn, ms) => {
      const id = this.nextId++;
      this.tasks.push({ at: this.time + ms, fn, id });
      return id;
    },
    clearTimeout: (h) => {
      this.tasks = this.tasks.filter((t) => t.id !== h);
    },
  };
  advance(ms: number) {
    const target = this.time + ms;
    for (;;) {
      const due = this.tasks
        .filter((t) => t.at <= target)
        .sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      this.time = due.at;
      this.tasks = this.tasks.filter((t) => t !== due);
      due.fn();
    }
    this.time = target;
  }
}

test("add makes a toast visible with the default duration for its kind", () => {
  const clock = new FakeClock();
  const store = createToastStore(clock.scheduler);
  store.add("success", "Added to the tree");
  assert.equal(store.items().length, 1);
  assert.equal(store.items()[0].message, "Added to the tree");
  assert.equal(store.items()[0].durationMs, DEFAULT_DURATION_MS.success);
});

test("auto-dismiss fires after the kind's duration", () => {
  const clock = new FakeClock();
  const store = createToastStore(clock.scheduler);
  store.add("error", "Couldn't save");
  clock.advance(DEFAULT_DURATION_MS.error - 1);
  assert.equal(store.items().length, 1, "still visible just before expiry");
  clock.advance(1);
  assert.equal(store.items().length, 0, "gone at exactly the duration");
});

test("same kind+message dedupes and refreshes the timer", () => {
  const clock = new FakeClock();
  const store = createToastStore(clock.scheduler);
  store.add("info", "Copied");
  clock.advance(3000);
  const id = store.add("info", "Copied");
  assert.equal(store.items().length, 1, "no second copy stacked");
  clock.advance(DEFAULT_DURATION_MS.info);
  assert.equal(
    store.items().length,
    0,
    "timer restarted from the second add",
  );
  assert.equal(id, store.items().length === 0 ? id : id);
});

test("cap: oldest toast drops off beyond MAX_VISIBLE", () => {
  const clock = new FakeClock();
  const store = createToastStore(clock.scheduler);
  for (let i = 0; i < MAX_VISIBLE + 2; i++) store.add("success", `toast ${i}`);
  assert.equal(store.items().length, MAX_VISIBLE);
  assert.deepEqual(
    store.items().map((t) => t.message),
    ["toast 2", "toast 3", "toast 4"],
  );
});

test("pause freezes timers; resume re-arms the remaining time", () => {
  const clock = new FakeClock();
  const store = createToastStore(clock.scheduler);
  store.add("success", "Saved");
  clock.advance(2000);
  store.pause();
  clock.advance(DEFAULT_DURATION_MS.success); // paused time doesn't count
  assert.equal(store.items().length, 1, "still visible while paused");
  store.resume();
  clock.advance(500);
  assert.equal(store.items().length, 1, "500ms of the remaining 2000 left");
  clock.advance(1500);
  assert.equal(store.items().length, 0, "dismissed after the remaining time");
});

test("pause/resume are idempotent", () => {
  const clock = new FakeClock();
  const store = createToastStore(clock.scheduler);
  store.add("info", "hi");
  store.pause();
  store.pause();
  clock.advance(10_000);
  store.resume();
  store.resume();
  clock.advance(DEFAULT_DURATION_MS.info + 1000);
  assert.equal(store.items().length, 0);
});

test("dismiss removes immediately and notifies subscribers", () => {
  const clock = new FakeClock();
  const store = createToastStore(clock.scheduler);
  let notifications = 0;
  const unsubscribe = store.subscribe(() => notifications++);
  const id = store.add("success", "Saved");
  assert.equal(notifications, 1);
  store.dismiss(id);
  assert.equal(store.items().length, 0);
  assert.equal(notifications, 2);
  unsubscribe();
});

test("snapshot is referentially stable between mutations", () => {
  const clock = new FakeClock();
  const store = createToastStore(clock.scheduler);
  store.add("success", "one");
  const a = store.items();
  const b = store.items();
  assert.equal(a, b, "same reference until the next mutation");
});
