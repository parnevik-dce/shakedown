const { withXcodeProject } = require('@expo/config-plugins');

// Xcode's newer "User Script Sandboxing" blocks react-native-xcode.sh from writing
// ip.txt into the app bundle (needed so a physical device can find the Metro dev
// server), failing every device build with "Operation not permitted". expo prebuild
// regenerates ios/ from scratch each time, so this has to be patched back in via a
// config plugin rather than edited directly in the generated project.
module.exports = function withDisableUserScriptSandboxing(config) {
  return withXcodeProject(config, (config) => {
    const configurations = config.modResults.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      const entry = configurations[key];
      if (entry?.buildSettings) {
        entry.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
      }
    }
    return config;
  });
};
