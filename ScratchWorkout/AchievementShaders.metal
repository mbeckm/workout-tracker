#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

[[ stitchable ]] half4 achievementGrain(float2 position, half4 color, float intensity) {
    float n = fract(sin(dot(position, float2(12.9898, 78.233))) * 43758.5453);
    float grain = (n - 0.5) * intensity;
    return half4(color.rgb + half3(grain), color.a);
}
