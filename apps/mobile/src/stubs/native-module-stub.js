// Stub for native-only modules on web.
// Returns empty objects so web bundles don't crash when these packages
// are referenced, even if they're guarded by Platform.OS checks.
module.exports = {};
