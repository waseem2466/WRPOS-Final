
/**
 * Safely access Electron APIs.
 * Returns null if running on Web/Mobile.
 */
export const getElectron = () => {
  return (window as any).electronAPI || null;
};

export const isElectron = () => !!getElectron();
export const isCapacitor = () => !!(window as any).Capacitor?.isNativePlatform?.();
export const isNative = () => isElectron() || isCapacitor();

export const safeInvoke = async (channel: string, ...args: any[]) => {
  const electron = getElectron();
  if (electron && (electron as any)[channel]) {
    return await (electron as any)[channel](...args);
  }
  console.warn(`[App] Electron channel "${channel}" is not available on this platform.`);
  return null;
};
