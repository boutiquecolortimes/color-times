// Inert stand-ins for native-only modules (haptics, keychain, files, push, purchases…).
const noop = () => undefined;
const asyncNull = async () => null;
export default new Proxy({}, { get: () => noop });
export const trigger = noop;
export const getGenericPassword = asyncNull;
export const setGenericPassword = asyncNull;
export const resetGenericPassword = asyncNull;
export const getSupportedBiometryType = asyncNull;
export const ACCESS_CONTROL = {};
export const ACCESSIBLE = {};
export const pick = asyncNull;
export const keepLocalCopy = asyncNull;
export const types = {};
export const launchCamera = asyncNull;
export const launchImageLibrary = asyncNull;
export const open = asyncNull;
export const setString = noop;
