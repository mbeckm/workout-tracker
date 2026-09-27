/**
 * Expo SDK 57's iOS template runs react-native-xcode.sh via unquoted backticks in the
 * "Bundle React Native code and images" phase, so a project path with a space
 * ("workout tracker app") splits and the build fails with exit 65. This quotes it.
 */
const { withXcodeProject } = require('expo/config-plugins');

const PHASE = 'Bundle React Native code and images';
const UNQUOTED = /`(\\"\$NODE_BINARY\\" --print [^`]*)`/;

module.exports = function withQuotedBundleScript(config) {
  return withXcodeProject(config, (mod) => {
    const phases = mod.modResults.hash.project.objects.PBXShellScriptBuildPhase ?? {};
    for (const phase of Object.values(phases)) {
      if (typeof phase !== 'object' || !String(phase.name ?? '').includes(PHASE)) {
        continue;
      }
      if (typeof phase.shellScript === 'string' && UNQUOTED.test(phase.shellScript)) {
        phase.shellScript = phase.shellScript.replace(UNQUOTED, '/bin/sh \\"$($1)\\"');
      }
    }
    return mod;
  });
};
