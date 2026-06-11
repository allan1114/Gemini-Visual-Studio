import { describe, it, expect, vi } from 'vitest';
import { showToast, subscribeToast } from './toast';

describe('toast bus', () => {
  it('delivers emitted toasts to subscribers with an id and default kind', () => {
    const received: { message: string; kind: string; id: string }[] = [];
    const unsub = subscribeToast((t) => received.push(t));

    showToast('boom');
    showToast('ok', 'success');

    expect(received).toHaveLength(2);
    expect(received[0]).toMatchObject({ message: 'boom', kind: 'error' });
    expect(received[1]).toMatchObject({ message: 'ok', kind: 'success' });
    expect(received[0].id).toBeTruthy();
    expect(received[0].id).not.toBe(received[1].id);

    unsub();
  });

  it('ignores empty messages and stops after unsubscribe', () => {
    const fn = vi.fn();
    const unsub = subscribeToast(fn);

    showToast('');
    expect(fn).not.toHaveBeenCalled();

    showToast('hi');
    expect(fn).toHaveBeenCalledTimes(1);

    unsub();
    showToast('after');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
