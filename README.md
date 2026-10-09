# 🎱 Pocket Masters - Head-to-Head 8-Ball Pool

A fast, responsive, and realistic HTML5 Canvas 8-Ball Pool video game built with physics sub-stepping, full 8-Ball rules, procedural audio effects, and aim trajectory projection.

---

## 🌟 Key Features

1. **Aiming Trajectory Guide (Toggleable)**:
   - **Target Ball Path**: Accurately projects the angle and direction the object ball will travel upon impact.
   - **Ghost Ball Indicator**: Displays a semi-transparent white ghost ball showing the exact point of cue-ball contact.
   - **Cue Ball Deflection Line**: Displays the post-collision tangent line where the cue ball will deflect.
   - **Cushion Bank Ray**: Shows rebound angles when aiming directly into rail cushions.
   - **One-Click Toggle**: Switch the aiming guide on or off anytime via the **Aim Line** button in the HUD or keyboard shortcut `[A]` / `[L]`.

2. **Game Modes**:
   - **Head-to-Head 2-Player**:
     - Local pass-and-play on the same computer.
     - Official 8-ball rules: Open table break shot, suit assignment (Solids 1-7 vs. Stripes 9-15) on the first legal pot, turn persistence on pots, foul detection (scratch, hitting wrong suit first, failure to contact).
     - **Ball in Hand**: Place the cue ball anywhere on the felt when the opponent commits a foul.
     - **8-Ball Rules**: Pocket the 8-ball legally to win; premature pocketing or scratching on the 8-ball results in an automatic loss.
   - **Solo Practice Mode**:
     - Unlimited practice shots with no foul penalties.
     - Free cue ball placement anytime using the **Place Cue** button.
     - Instant rerack at any time.

3. **Physics Engine**:
   - Continuous sub-stepped simulation (8 sub-steps per frame) preventing ball tunneling at high speeds.
   - Accurate elastic sphere collisions with momentum transfer.
   - Beveled cushion rail jaws into 6 pockets with rounded entry funnels.
   - **Realistic Felt Friction**: Combines proportional cloth drag with constant rolling deceleration (Coulomb friction), so balls decelerate and come to a natural stop instead of gliding endlessly.
   - **Felt Cloth Speed Presets**: Switch between Realistic Standard, Slick (Fast), and Heavy (Slow) right from the Table toolbar.
   - **English / Spin Control**: Adjust cue tip strike point (topspin/follow, backspin/draw, and left/right english).

4. **Procedural Web Audio Engine**:
   - Built-in Web Audio API sound synthesizer with zero external dependencies.
   - Hard phenolic resin ball clacks scaled by impact velocity.
   - Wood cue stick strike thumps scaled by shot power.
   - Cushion rail bounces, pocket drops, foul buzzers, and victory fanfare.
   - Mute / Unmute audio toggle button.

5. **Visual Themes**:
   - Customizable felt colors: Classic Green, Tournament Blue, Burgundy Red, and Midnight Slate.
   - 3D ball rendering with specular highlights, drop shadows, and striped bands.
   - Polished wooden rails with inlaid diamond sights and metallic pocket bezels.

---

## 🎮 Controls

| Action | Control |
| :--- | :--- |
| **Aim Cue Stick** | Move mouse around the cue ball |
| **Fine-Tune Aim** | `Left` / `Right` arrow keys or `A` / `D` keys |
| **Power & Shoot (Mouse)** | Click and pull backward on table, then release to shoot |
| **Power & Shoot (HUD)** | Adjust power slider, then click **Strike** or press `Space` |
| **Toggle Aiming Guide** | Press `A` or `L`, or click the **Aim Line** button |
| **Position Ball in Hand** | Move mouse across table, click to place cue ball |
| **Set Spin (English)** | Click inside the Cue Ball Spin widget |
| **Rerack Balls** | Press `R` or click **Rerack** |

---

## 🚀 How to Run

### Option 1: Quick Batch Script (Windows)
Double-click `play.bat` or run:
```powershell
.\play.bat
```

### Option 2: Python HTTP Server
```powershell
python -m http.server 8080
```
Then navigate to `http://localhost:8080` in your web browser (Chrome, Edge, Firefox, Brave, Safari, etc.).

### Option 3: Direct Browser Open
Simply double-click `index.html` or run:
```powershell
start index.html
```
