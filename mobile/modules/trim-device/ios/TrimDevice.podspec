Pod::Spec.new do |s|
  s.name           = 'TrimDevice'
  s.version        = '1.0.0'
  s.summary        = 'Trim device haptics (Core Haptics), sounds and the SceneKit cartridge insert.'
  s.description    = 'Named Core Haptics patterns and short device sounds for the Trim Gadget UI.'
  s.author         = ''
  s.homepage       = 'https://scratch-legal.vercel.app'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.swift_version  = '5.9'
  s.source_files   = '**/*.{h,m,swift}'
  # Rendered by `node scripts/render-sounds.mjs`; native, so they change only with a build.
  s.resources      = 'sounds/*.wav'
  s.frameworks     = 'CoreHaptics', 'AVFoundation', 'SceneKit', 'QuartzCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
