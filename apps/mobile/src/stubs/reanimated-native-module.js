// Web stub for react-native-reanimated native module.
// On web, SHOULD_BE_USE_WEB is true so createNativeReanimatedModule() is never called,
// but reanimatedModuleInstance.js imports it statically — this stub prevents the
// entire native module chain (NativeReanimated → specs → TurboModuleRegistry) from loading.
export function createNativeReanimatedModule() {
  return {};
}
