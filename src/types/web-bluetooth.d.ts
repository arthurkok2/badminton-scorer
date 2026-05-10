interface BluetoothDevice extends EventTarget {
  readonly id: string;
  readonly name?: string;
}

interface BluetoothRequestDeviceOptions {
  acceptAllDevices?: boolean;
  optionalServices?: BluetoothServiceUUID[];
}

interface Bluetooth {
  requestDevice(options: BluetoothRequestDeviceOptions): Promise<BluetoothDevice>;
}

interface Navigator {
  readonly bluetooth: Bluetooth;
}
