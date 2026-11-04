import os
import subprocess
import sys

SCRIPTS_DIR = r"C:\Users\yishay.shavlev\.gemini\config\skills\logo-design\scripts"
RENDER_SCRIPT = os.path.join(SCRIPTS_DIR, "render_png.py")
BRANDING_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.abspath(os.path.join(BRANDING_DIR, ".."))

os.makedirs(BRANDING_DIR, exist_ok=True)
os.makedirs(ASSETS_DIR, exist_ok=True)

# 1. Master Icon Symbol SVG (Full Bleed Tile 1024x1024)
master_icon_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#064e3b" />
      <stop offset="100%" stop-color="#022c22" />
    </linearGradient>
    <linearGradient id="funnelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Background Base -->
  <rect width="1024" height="1024" fill="url(#bgGrad)" />

  <!-- Outer subtle circular glow -->
  <circle cx="512" cy="480" r="380" fill="#10b981" opacity="0.08" />

  <!-- Funnel with exact 45/135 deg diagonals, scaled up -->
  <!-- Top width: 224 to 800 (width 576), top y: 200 -->
  <g id="funnelGroup">
    <path fill="url(#funnelGrad)" d="
      M 224 250
      C 224 218 256 194 288 194
      L 736 194
      C 768 194 800 218 800 250
      C 800 274 784 298 760 314
      L 600 474
      C 584 490 576 514 576 530
      L 576 546
      L 448 546
      L 448 530
      C 448 514 440 490 424 474
      L 264 314
      C 240 298 224 274 224 250
      Z
    " />

    <!-- Video Signal Icons inside funnel -->
    <!-- Play Triangle -->
    <polygon points="480,250 480,314 536,282" fill="#ffffff" filter="url(#glow)" />
    <!-- Heart / Social Dot Red -->
    <circle cx="376" cy="282" r="20" fill="#f43f5e" />
    <!-- Sparkle / Star Dot Gold -->
    <circle cx="648" cy="282" r="20" fill="#fbbf24" />
    <!-- Audio Wave / Additional signal dots -->
    <circle cx="430" cy="380" r="14" fill="#a8e6cf" />
    <circle cx="594" cy="380" r="14" fill="#a8e6cf" />
  </g>

  <!-- 3 Dots Filter Transition Layer -->
  <g id="filterLayer">
    <circle cx="436" cy="594" r="16" fill="#a8e6cf" opacity="0.9" />
    <circle cx="512" cy="594" r="16" fill="#34d399" />
    <circle cx="588" cy="594" r="16" fill="#a8e6cf" opacity="0.9" />
  </g>

  <!-- Output Recipe Card Emerging -->
  <g id="recipeCard" filter="url(#cardShadow)">
    <rect x="304" cy="650" width="416" height="208" rx="48" fill="#ffffff" />
    <!-- Recipe Title Line -->
    <rect x="360" y="698" width="224" height="24" rx="12" fill="#064e3b" />
    <!-- Star Rating Indicator -->
    <circle cx="640" cy="710" r="16" fill="#fbbf24" />
    <!-- Recipe Ingredient Line 1 -->
    <rect x="360" y="746" width="304" height="24" rx="12" fill="#10b981" />
    <!-- Recipe Ingredient Line 2 -->
    <rect x="360" y="794" width="176" height="24" rx="12" fill="#34d399" opacity="0.75" />
  </g>

  <!-- AI Sparkles at Bottom Corner -->
  <path d="M 740 640 Q 755 640 755 625 Q 755 640 770 640 Q 755 640 755 655 Q 755 640 740 640 Z" fill="#fbbf24" />
  <path d="M 270 680 Q 282 680 282 668 Q 282 680 294 680 Q 282 680 282 692 Q 282 680 270 680 Z" fill="#34d399" />
</svg>"""

# 2. Adaptive Foreground SVG (Centred inside Android Safe Zone - 66% diameter)
# Transparent background so Android clips or overlays smoothly
adaptive_foreground_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="afFunnelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <filter id="afCardShadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Centered scale 0.72 inside 1024 canvas -->
  <g transform="translate(512, 512) scale(0.72) translate(-512, -512)">
    <!-- Funnel -->
    <path fill="url(#afFunnelGrad)" d="
      M 224 250
      C 224 218 256 194 288 194
      L 736 194
      C 768 194 800 218 800 250
      C 800 274 784 298 760 314
      L 600 474
      C 584 490 576 514 576 530
      L 576 546
      L 448 546
      L 448 530
      C 448 514 440 490 424 474
      L 264 314
      C 240 298 224 274 224 250
      Z
    " />

    <polygon points="480,250 480,314 536,282" fill="#ffffff" />
    <circle cx="376" cy="282" r="20" fill="#f43f5e" />
    <circle cx="648" cy="282" r="20" fill="#fbbf24" />
    <circle cx="430" cy="380" r="14" fill="#a8e6cf" />
    <circle cx="594" cy="380" r="14" fill="#a8e6cf" />

    <circle cx="436" cy="594" r="16" fill="#a8e6cf" />
    <circle cx="512" cy="594" r="16" fill="#34d399" />
    <circle cx="588" cy="594" r="16" fill="#a8e6cf" />

    <!-- Recipe Card -->
    <g filter="url(#afCardShadow)">
      <rect x="304" y="650" width="416" height="208" rx="48" fill="#ffffff" />
      <rect x="360" y="698" width="224" height="24" rx="12" fill="#064e3b" />
      <circle cx="640" cy="710" r="16" fill="#fbbf24" />
      <rect x="360" y="746" width="304" height="24" rx="12" fill="#10b981" />
      <rect x="360" y="794" width="176" height="24" rx="12" fill="#34d399" opacity="0.75" />
    </g>

    <path d="M 740 640 Q 755 640 755 625 Q 755 640 770 640 Q 755 640 755 655 Q 755 640 740 640 Z" fill="#fbbf24" />
    <path d="M 270 680 Q 282 680 282 668 Q 282 680 294 680 Q 282 680 282 692 Q 282 680 270 680 Z" fill="#34d399" />
  </g>
</svg>"""

# 3. Splash Screen SVG (Vertical 1284 x 2778 for high-res mobile displays)
splash_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1284 2778" width="1284" height="2778">
  <defs>
    <linearGradient id="splashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b1329" />
      <stop offset="40%" stop-color="#064e3b" />
      <stop offset="100%" stop-color="#022c22" />
    </linearGradient>
    <linearGradient id="spFunnelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <filter id="spShadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="20" stdDeviation="24" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
  </defs>

  <rect width="1284" height="2778" fill="url(#splashGrad)" />

  <!-- Center Logo Group -->
  <g transform="translate(642, 1150) scale(0.95) translate(-512, -512)">
    <circle cx="512" cy="480" r="380" fill="#10b981" opacity="0.09" />

    <!-- Funnel -->
    <path fill="url(#spFunnelGrad)" d="
      M 224 250
      C 224 218 256 194 288 194
      L 736 194
      C 768 194 800 218 800 250
      C 800 274 784 298 760 314
      L 600 474
      C 584 490 576 514 576 530
      L 576 546
      L 448 546
      L 448 530
      C 448 514 440 490 424 474
      L 264 314
      C 240 298 224 274 224 250
      Z
    " />

    <polygon points="480,250 480,314 536,282" fill="#ffffff" />
    <circle cx="376" cy="282" r="20" fill="#f43f5e" />
    <circle cx="648" cy="282" r="20" fill="#fbbf24" />
    <circle cx="430" cy="380" r="14" fill="#a8e6cf" />
    <circle cx="594" cy="380" r="14" fill="#a8e6cf" />

    <circle cx="436" cy="594" r="16" fill="#a8e6cf" />
    <circle cx="512" cy="594" r="16" fill="#34d399" />
    <circle cx="588" cy="594" r="16" fill="#a8e6cf" />

    <!-- Recipe Card -->
    <g filter="url(#spShadow)">
      <rect x="304" y="650" width="416" height="208" rx="48" fill="#ffffff" />
      <rect x="360" y="698" width="224" height="24" rx="12" fill="#064e3b" />
      <circle cx="640" cy="710" r="16" fill="#fbbf24" />
      <rect x="360" y="746" width="304" height="24" rx="12" fill="#10b981" />
      <rect x="360" y="794" width="176" height="24" rx="12" fill="#34d399" opacity="0.75" />
    </g>

    <path d="M 740 640 Q 755 640 755 625 Q 755 640 770 640 Q 755 640 755 655 Q 755 640 740 640 Z" fill="#fbbf24" />
    <path d="M 270 680 Q 282 680 282 668 Q 282 680 294 680 Q 282 680 282 692 Q 282 680 270 680 Z" fill="#34d399" />
  </g>

  <!-- Typography under Logo -->
  <text x="642" y="1720" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="76" font-weight="900" fill="#ffffff" letter-spacing="-1">ספר המתכונים שלי</text>
  <text x="642" y="1800" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="28" font-weight="700" fill="#34d399" letter-spacing="6">AI RECIPE SIEVE &amp; FILTER</text>
  
  <text x="642" y="2580" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="22" font-weight="600" fill="#6ee7b7" opacity="0.7">חילוץ מתכונים חכם מרשתות חברתיות</text>
</svg>"""

# 4. Transparent In-App Logo Symbol (Square 512x512)
in_app_logo_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="appGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#064e3b" />
    </linearGradient>
    <linearGradient id="appFunnel" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
  </defs>

  <!-- Squircle Tile -->
  <rect x="24" y="24" width="464" height="464" rx="104" fill="url(#appGrad)" />

  <!-- Funnel -->
  <g transform="translate(256, 256) scale(0.48) translate(-512, -512)">
    <path fill="url(#appFunnel)" d="
      M 224 250
      C 224 218 256 194 288 194
      L 736 194
      C 768 194 800 218 800 250
      C 800 274 784 298 760 314
      L 600 474
      C 584 490 576 514 576 530
      L 576 546
      L 448 546
      L 448 530
      C 448 514 440 490 424 474
      L 264 314
      C 240 298 224 274 224 250
      Z
    " />

    <polygon points="480,250 480,314 536,282" fill="#ffffff" />
    <circle cx="376" cy="282" r="20" fill="#f43f5e" />
    <circle cx="648" cy="282" r="20" fill="#fbbf24" />

    <circle cx="436" cy="594" r="16" fill="#a8e6cf" />
    <circle cx="512" cy="594" r="16" fill="#34d399" />
    <circle cx="588" cy="594" r="16" fill="#a8e6cf" />

    <!-- Card -->
    <rect x="304" y="650" width="416" height="208" rx="48" fill="#ffffff" />
    <rect x="360" y="698" width="224" height="24" rx="12" fill="#064e3b" />
    <circle cx="640" cy="710" r="16" fill="#fbbf24" />
    <rect x="360" y="746" width="304" height="24" rx="12" fill="#10b981" />
    <rect x="360" y="794" width="176" height="24" rx="12" fill="#34d399" />
  </g>
</svg>"""

# Save SVGs
files = {
    os.path.join(BRANDING_DIR, "master-icon.svg"): master_icon_svg,
    os.path.join(BRANDING_DIR, "adaptive-foreground.svg"): adaptive_foreground_svg,
    os.path.join(BRANDING_DIR, "splash-canvas.svg"): splash_svg,
    os.path.join(BRANDING_DIR, "in-app-logo.svg"): in_app_logo_svg,
}

for path, content in files.items():
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Saved SVG: {path}")

# Render PNGs using render_png.py
renders = [
    # (svg_path, out_png_path, width, height)
    (os.path.join(BRANDING_DIR, "master-icon.svg"), os.path.join(ASSETS_DIR, "icon.png"), 1024, 1024),
    (os.path.join(BRANDING_DIR, "adaptive-foreground.svg"), os.path.join(ASSETS_DIR, "adaptive-icon.png"), 1024, 1024),
    (os.path.join(BRANDING_DIR, "splash-canvas.svg"), os.path.join(ASSETS_DIR, "splash.png"), 1284, 2778),
    (os.path.join(BRANDING_DIR, "in-app-logo.svg"), os.path.join(ASSETS_DIR, "logo.png"), 512, 512),
    (os.path.join(BRANDING_DIR, "in-app-logo.svg"), os.path.join(ASSETS_DIR, "favicon.png"), 48, 48),
]

for svg_file, png_file, w, h in renders:
    cmd = [
        sys.executable,
        RENDER_SCRIPT,
        svg_file,
        "-o",
        png_file,
        "--width",
        str(w),
        "--height",
        str(h),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0:
        print(f"Rendered: {png_file} ({w}x{h})")
    else:
        print(f"Error rendering {png_file}: {res.stderr}")

print("All branding assets generated successfully!")

