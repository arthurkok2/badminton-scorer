import { connectBluetoothRemote, getBluetoothSupportStatus, translateRemoteValue } from './bluetoothRemote';
import type { AppCommand } from './commands';

function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

class FakeBluetoothCharacteristic extends EventTarget {
  readonly listenerCounts = new Map<string, number>();

  constructor(private readonly startNotificationsResult?: Promise<FakeBluetoothCharacteristic>) {
    super();
  }

  async startNotifications(): Promise<FakeBluetoothCharacteristic> {
    await this.startNotificationsResult;
    return this;
  }

  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    super.addEventListener(type, listener);
    this.listenerCounts.set(type, (this.listenerCounts.get(type) ?? 0) + 1);
  }

  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    super.removeEventListener(type, listener);
    this.listenerCounts.set(type, Math.max((this.listenerCounts.get(type) ?? 0) - 1, 0));
  }

  emitValue(bytes: number[]): void {
    const event = new Event('characteristicvaluechanged');
    Object.defineProperty(event, 'target', {
      value: { value: new DataView(new Uint8Array(bytes).buffer) },
    });

    this.dispatchEvent(event);
  }
}

class FakeBluetoothDevice extends EventTarget {
  readonly gatt: BluetoothRemoteGATTServer;
  readonly listenerCounts = new Map<string, number>();
  readonly id = 'fake-device';
  readonly name = 'Fake Remote';
  disconnects = 0;

  constructor(characteristic: FakeBluetoothCharacteristic) {
    super();

    this.gatt = {
      connected: false,
      device: this as unknown as BluetoothDevice,
      connect: async () => {
        this.gatt.connected = true;
        return this.gatt;
      },
      disconnect: () => {
        this.disconnects += 1;
        this.gatt.connected = false;
      },
      getPrimaryService: async () => ({
        device: this as unknown as BluetoothDevice,
        isPrimary: true,
        uuid: '0000fff0-0000-1000-8000-00805f9b34fb',
        getCharacteristic: async () => characteristic as unknown as BluetoothRemoteGATTCharacteristic,
      }),
    } as BluetoothRemoteGATTServer;
  }

  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    super.addEventListener(type, listener);
    this.listenerCounts.set(type, (this.listenerCounts.get(type) ?? 0) + 1);
  }

  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    super.removeEventListener(type, listener);
    this.listenerCounts.set(type, Math.max((this.listenerCounts.get(type) ?? 0) - 1, 0));
  }
}

describe('bluetooth remote adapter', () => {
  it('reports unsupported when navigator.bluetooth is missing', () => {
    expect(getBluetoothSupportStatus({} as Navigator)).toBe('unsupported');
  });

  it('translates simple generic button values to press and release events', () => {
    expect(translateRemoteValue(new Uint8Array([1]))).toBe('press');
    expect(translateRemoteValue(new Uint8Array([0]))).toBe('release');
    expect(translateRemoteValue(new Uint8Array([9]))).toBe('unknown');
  });

  it('sets unsupported and returns undefined when navigator.bluetooth is missing', async () => {
    const statuses: string[] = [];

    const connection = await connectBluetoothRemote({
      dispatch: () => undefined,
      onStatusChange: (status) => statuses.push(status),
      navigatorLike: {} as Navigator,
    });

    expect(connection).toBeUndefined();
    expect(statuses).toEqual(['unsupported']);
  });

  it('sets disconnected and returns undefined when device request is rejected', async () => {
    const statuses: string[] = [];
    const navigatorLike = {
      bluetooth: {
        requestDevice: async () => {
          throw new Error('cancelled');
        },
      },
    } as unknown as Navigator;

    const connection = await connectBluetoothRemote({
      dispatch: () => undefined,
      onStatusChange: (status) => statuses.push(status),
      navigatorLike,
    });

    expect(connection).toBeUndefined();
    expect(statuses).toEqual(['connecting', 'disconnected']);
  });

  it('reports connected only after GATT connection and notification setup succeed', async () => {
    const notificationsStarted = createDeferred<FakeBluetoothCharacteristic>();
    const characteristic = new FakeBluetoothCharacteristic(notificationsStarted.promise);
    const device = new FakeBluetoothDevice(characteristic);
    const statuses: string[] = [];
    const connectionPromise = connectBluetoothRemote({
      dispatch: () => undefined,
      onStatusChange: (status) => statuses.push(status),
      navigatorLike: {
        bluetooth: {
          requestDevice: async () => device as unknown as BluetoothDevice,
        },
      } as unknown as Navigator,
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(statuses).toEqual(['connecting']);

    notificationsStarted.resolve(characteristic);
    const connection = await connectionPromise;

    expect(connection).toBeDefined();
    expect(statuses).toEqual(['connecting', 'connected']);
  });

  it('routes characteristic press, release, and flush events through the gesture interpreter', async () => {
    const characteristic = new FakeBluetoothCharacteristic();
    const device = new FakeBluetoothDevice(characteristic);
    const commands: AppCommand[] = [];
    const intervalCallbacks: Array<() => void> = [];
    const timestamps = [0, 80, 260];

    await connectBluetoothRemote({
      dispatch: (command) => commands.push(command),
      onStatusChange: () => undefined,
      navigatorLike: {
        bluetooth: {
          requestDevice: async () => device as unknown as BluetoothDevice,
        },
      } as unknown as Navigator,
      now: () => timestamps.shift() ?? 260,
      setInterval: (callback) => {
        intervalCallbacks.push(callback);
        return 7;
      },
      clearInterval: () => undefined,
    });

    characteristic.emitValue([1]);
    characteristic.emitValue([9]);
    characteristic.emitValue([0]);
    intervalCallbacks[0]();

    expect(commands).toEqual([{ type: 'POINT_SERVING' }]);
  });

  it('disconnect cleanup clears the flush interval and removes notification and disconnect listeners', async () => {
    const characteristic = new FakeBluetoothCharacteristic();
    const device = new FakeBluetoothDevice(characteristic);
    const clearedIntervals: number[] = [];
    const connection = await connectBluetoothRemote({
      dispatch: () => undefined,
      onStatusChange: () => undefined,
      navigatorLike: {
        bluetooth: {
          requestDevice: async () => device as unknown as BluetoothDevice,
        },
      } as unknown as Navigator,
      setInterval: () => 42,
      clearInterval: (intervalId) => {
        clearedIntervals.push(intervalId);
      },
    });

    expect(characteristic.listenerCounts.get('characteristicvaluechanged')).toBe(1);
    expect(device.listenerCounts.get('gattserverdisconnected')).toBe(1);

    connection?.disconnect();

    expect(clearedIntervals).toEqual([42]);
    expect(characteristic.listenerCounts.get('characteristicvaluechanged')).toBe(0);
    expect(device.listenerCounts.get('gattserverdisconnected')).toBe(0);
    expect(device.disconnects).toBe(1);
  });
});
