import { getBluetoothSupportStatus, translateRemoteValue } from './bluetoothRemote';

describe('bluetooth remote adapter', () => {
  it('reports unsupported when navigator.bluetooth is missing', () => {
    expect(getBluetoothSupportStatus({} as Navigator)).toBe('unsupported');
  });

  it('translates simple generic button values to press and release events', () => {
    expect(translateRemoteValue(new Uint8Array([1]))).toBe('press');
    expect(translateRemoteValue(new Uint8Array([0]))).toBe('release');
    expect(translateRemoteValue(new Uint8Array([9]))).toBe('unknown');
  });
});
