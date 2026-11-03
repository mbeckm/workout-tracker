#!/bin/zsh
# Drive Trim in its own iOS Simulator with its own Metro, so verification never touches
# another session's simulator or dev server. See .claude/skills/verify/SKILL.md.
#
#   trim-verify.sh up              boot the "Trim Verify" simulator, install the newest dev build, start Metro, open the app
#   trim-verify.sh doctor          read-only: is this instance worth driving?
#   trim-verify.sh open '<query>'  deep link into the device, e.g. '?sheet=settings' or '?log=1&planId=..&dayId=..'
#   trim-verify.sh shot <name>     screenshot into the run's evidence dir, prints the path
#   trim-verify.sh state [name]    save the persisted app state (scratchWorkout.appState.v1) as evidence, print a summary
#   trim-verify.sh reload          relaunch the app against Metro (picks up JS changes)
#   trim-verify.sh fresh           uninstall + reinstall: wipes app data, lands on onboarding
#   trim-verify.sh logs [n]        last n lines of this Metro's log (JS errors, console)
#   trim-verify.sh down            stop our Metro, shut down our simulator; evidence stays
set -u

ROOT=${0:A:h:h:h:h}
MOBILE="$ROOT/mobile"
SIM_NAME=${TRIM_VERIFY_SIM:-"Trim Verify"}
SIM_TYPE="com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro"
PORT=${TRIM_VERIFY_PORT:-8095}
BUNDLE="com.marvinbeckmann.ScratchWorkout"
STATE="${TMPDIR:-/tmp}trim-verify"
EVIDENCE=${TRIM_VERIFY_EVIDENCE:-"$ROOT/.claude/verify-runs/$(date +%Y-%m-%d)"}
mkdir -p "$STATE"

udid() { xcrun simctl list devices -j | /usr/bin/python3 -c "
import json,sys
for rt in json.load(sys.stdin)['devices'].values():
  for d in rt:
    if d['name']==sys.argv[1] and d['isAvailable']: print(d['udid']); sys.exit()" "$SIM_NAME"; }

newest_app() {
  ls -td ~/Library/Developer/Xcode/DerivedData/Trim-*/Build/Products/Debug-iphonesimulator/Trim.app \
    "$MOBILE"/ios/build/Build/Products/Debug-iphonesimulator/Trim.app 2>/dev/null | head -1
}

metro_pid() { [[ -f "$STATE/metro.pid" ]] && kill -0 "$(cat "$STATE/metro.pid")" 2>/dev/null && cat "$STATE/metro.pid"; }

launch_dev_client() {
  local id=$1
  # Keep the dev menu out of the evidence (no intro, no menu at launch, no floating gear: use
  # `reload` instead). Launching before openurl skips iOS's "Open in Trim?" prompt.
  for key in EXDevMenuIsOnboardingFinished:YES EXDevMenuShowsAtLaunch:NO EXDevMenuShowFloatingActionButton:NO; do
    xcrun simctl spawn "$id" defaults write "$BUNDLE" ${key%%:*} -bool ${key##*:}
  done
  xcrun simctl terminate "$id" "$BUNDLE" >/dev/null 2>&1
  local before=$(grep -c "iOS Bundled" "$STATE/metro.log" 2>/dev/null)
  xcrun simctl launch "$id" "$BUNDLE" >/dev/null
  sleep 3
  xcrun simctl openurl "$id" "exp+workout-app://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A$PORT"
  # Ready once Metro serves a new bundle; the device needs ~3 s more to hydrate and draw.
  for i in {1..90}; do
    (( $(grep -c "iOS Bundled" "$STATE/metro.log" 2>/dev/null) > ${before:-0} )) && { sleep 3; echo "app loaded"; return 0; }
    sleep 1
  done
  echo "no bundle served after 90 s: check 'logs' and take a shot"; return 1
}

cmd=${1:-doctor}
case $cmd in
up)
  id=$(udid)
  if [[ -z $id ]]; then
    runtime=$(xcrun simctl list runtimes -j | /usr/bin/python3 -c "import json,sys; print([r['identifier'] for r in json.load(sys.stdin)['runtimes'] if r['platform']=='iOS' and r['isAvailable']][-1])")
    id=$(xcrun simctl create "$SIM_NAME" "$SIM_TYPE" "$runtime") || exit 1
    echo "created simulator $SIM_NAME ($id)"
  fi
  xcrun simctl bootstatus "$id" -b >/dev/null || exit 1
  app=$(newest_app)
  [[ -z $app ]] && { echo "no Trim.app dev build found: run 'npx expo run:ios' in mobile/ first"; exit 1; }
  if ! xcrun simctl get_app_container "$id" "$BUNDLE" >/dev/null 2>&1; then
    xcrun simctl install "$id" "$app" && echo "installed $app"
  fi
  if [[ -z $(metro_pid) ]]; then
    if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null; then
      echo "port $PORT is taken by someone else; set TRIM_VERIFY_PORT"; exit 1
    fi
    (cd "$MOBILE" && nohup npx expo start --dev-client --port $PORT >"$STATE/metro.log" 2>&1 </dev/null & echo $! >"$STATE/metro.pid")
    for i in {1..90}; do
      curl -s "http://127.0.0.1:$PORT/status" | grep -q packager-status:running && break
      sleep 1
    done
  fi
  curl -s "http://127.0.0.1:$PORT/status" | grep -q packager-status:running || { echo "Metro did not come up; see $STATE/metro.log"; exit 1; }
  launch_dev_client "$id"
  echo "ready: simulator '$SIM_NAME' ($id), Metro :$PORT (pid $(metro_pid)), evidence -> $EVIDENCE"
  ;;
doctor)
  ok=1
  id=$(udid)
  [[ -n $id ]] && echo "ok   simulator '$SIM_NAME' $id" || { echo "FAIL no simulator '$SIM_NAME' (run up)"; ok=0; }
  if [[ -n $id ]]; then
    xcrun simctl list devices | grep -q "$id) (Booted)" && echo "ok   booted" || { echo "FAIL not booted (run up)"; ok=0; }
    xcrun simctl get_app_container "$id" "$BUNDLE" >/dev/null 2>&1 && echo "ok   Trim installed" || { echo "FAIL Trim not installed (run up)"; ok=0; }
  fi
  pid=$(metro_pid)
  if [[ -n $pid ]]; then
    owner=$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null | head -1)
    cwd=$(lsof -a -p "$owner" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
    [[ $cwd == "$MOBILE" ]] && echo "ok   Metro :$PORT serves this checkout ($cwd)" || { echo "FAIL :$PORT is served from '$cwd', not $MOBILE"; ok=0; }
  else
    echo "FAIL our Metro is not running (run up)"; ok=0
  fi
  app=$(newest_app)
  if [[ -n $app ]]; then
    built=$(stat -f %m "$app")
    native=$(git -C "$ROOT" log -1 --format=%ct -- mobile/package.json mobile/app.json mobile/modules mobile/plugins)
    (( built >= native )) && echo "ok   dev build $(date -r $built '+%F %R') is newer than the last native change" \
      || echo "WARN dev build $(date -r $built '+%F %R') predates the last native change: rebuild (npx expo run:ios) before trusting native UI"
  fi
  echo "     branch $(git -C "$ROOT" branch --show-current) @ $(git -C "$ROOT" rev-parse --short HEAD)"
  (( ok )) && echo "doctor: OK" || { echo "doctor: NOT READY"; exit 1; }
  ;;
open)
  id=$(udid); [[ -z $id ]] && { echo "no simulator, run up"; exit 1; }
  xcrun simctl openurl "$id" "scratchworkout:///${2#/}"
  ;;
shot)
  id=$(udid); [[ -z $id ]] && { echo "no simulator, run up"; exit 1; }
  mkdir -p "$EVIDENCE"
  file="$EVIDENCE/$(date +%H%M%S)-${2:-shot}.png"
  xcrun simctl io "$id" screenshot "$file" >/dev/null 2>&1 && echo "$file"
  ;;
state)
  id=$(udid); [[ -z $id ]] && { echo "no simulator, run up"; exit 1; }
  store="$(xcrun simctl get_app_container "$id" "$BUNDLE" data)/Library/Application Support/$BUNDLE/RCTAsyncLocalStorage_V1"
  mkdir -p "$EVIDENCE"
  file="$EVIDENCE/$(date +%H%M%S)-state-${2:-app}.json"
  /usr/bin/python3 - "$store" "$file" <<'PY'
import hashlib, json, os, sys
store, out = sys.argv[1:]
key = 'scratchWorkout.appState.v1'
manifest = json.load(open(os.path.join(store, 'manifest.json'))) if os.path.exists(os.path.join(store, 'manifest.json')) else {}
raw = manifest.get(key)
if raw is None:
    big = os.path.join(store, hashlib.md5(key.encode()).hexdigest())  # AsyncStorage keeps large values in md5(key)
    raw = open(big).read() if os.path.exists(big) else None
if raw is None:
    print('no saved app state yet (fresh install, or nothing persisted)'); sys.exit(1)
s = json.loads(raw)
json.dump(s, open(out, 'w'), indent=2)
active = next((p for p in s.get('plans', []) if p.get('id') == s.get('activePlanId')), None)
print(out)
print(f"onboarded={s.get('hasCompletedOnboarding')} name={s.get('userName')!r} units={s.get('units')} finish={s.get('finish')} pro={s.get('isPro')} tourDone={s.get('tourDone')}")
print(f"plans={[p.get('name') for p in s.get('plans', [])]} active={active.get('name') if active else None} nextDayIndex={s.get('nextDayIndex')}")
print(f"workouts={len(s.get('workoutHistory', []))} activeSession={'yes' if s.get('activeSession') else 'no'} goals={len(s.get('goals', []))} bodyCheckIns={len(s.get('bodyCheckIns', []))} customExercises={len(s.get('customExercises', []))}")
PY
  ;;
reload)
  id=$(udid); launch_dev_client "$id"
  ;;
fresh)
  id=$(udid); app=$(newest_app)
  xcrun simctl uninstall "$id" "$BUNDLE" && xcrun simctl install "$id" "$app" && launch_dev_client "$id" && echo "fresh install, app data wiped"
  ;;
logs)
  tail -n "${2:-60}" "$STATE/metro.log"
  ;;
down)
  pid=$(metro_pid)
  if [[ -n $pid ]]; then
    pkill -P "$pid" 2>/dev/null; kill "$pid" 2>/dev/null
    for c in $(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null); do
      [[ $(lsof -a -p $c -d cwd -Fn | sed -n 's/^n//p') == "$MOBILE" ]] && kill $c
    done
    echo "stopped Metro (pid $pid)"
  fi
  rm -f "$STATE/metro.pid"
  id=$(udid); [[ -n $id ]] && xcrun simctl shutdown "$id" 2>/dev/null && echo "shut down '$SIM_NAME'"
  echo "evidence kept in $EVIDENCE"
  ;;
*)
  sed -n 2,13p "$0"; exit 2
  ;;
esac
