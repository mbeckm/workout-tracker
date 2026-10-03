/**
 * The repo path has a space ("workout tracker app"), and several Expo pod phases split on it:
 * - EXConstants (app.config), EXUpdates (resources) and ExpoWidgets (bundle) run
 *   `bash -l -c "$PODS_TARGET_SRCROOT/../scripts/<name>.sh"` unquoted, so the build fails with
 *   exit 65.
 * - ExpoWidgets' xcode-build-bundle.sh then runs `basename $PROJECT_DIR` unquoted, decides it
 *   isn't a pod build and silently skips the widget bundle, so "Prepare ExpoWidgets Resources"
 *   finds nothing to copy.
 * This adds a Podfile post_install step that quotes the script paths and calls the widget
 * bundler directly.
 */
const { withPodfile } = require('expo/config-plugins');

const MARKER = '# with-quoted-pod-scripts';
const HOOK = `post_install do |installer|`;
const SNIPPET = String.raw`
    ${MARKER}: quote pod script paths (the repo path has a space)
    installer.pods_project.targets.each do |target|
      target.shell_script_build_phases.each do |phase|
        script = phase.shell_script
        next unless script.start_with?('bash -l -c "$PODS_TARGET_SRCROOT/')
        if target.name == 'ExpoWidgets' && script.include?('xcode-build-bundle.sh')
          phase.shell_script = %q{bash -l -c 'cd "$PROJECT_DIR/../.." && "$PODS_TARGET_SRCROOT/../scripts/with-node.sh" "$PODS_TARGET_SRCROOT/../scripts/build-bundle.mjs" "$PROJECT_DIR/../.."'}
        else
          phase.shell_script = script.sub(/"(\$PODS_TARGET_SRCROOT\/[^"]+\.sh)"/, '"\\"\1\\""')
        end
      end
    end
`;

module.exports = function withQuotedPodScripts(config) {
  return withPodfile(config, (mod) => {
    const contents = mod.modResults.contents;
    if (!contents.includes(MARKER) && contents.includes(HOOK)) {
      mod.modResults.contents = contents.replace(HOOK, `${HOOK}${SNIPPET}`);
    }
    return mod;
  });
};
