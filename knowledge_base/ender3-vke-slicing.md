# Ender 3 V3 KE & CR-M4 — Slicing Guide (Creality Print & Ultimaker Cura)
machine: Ender 3 V3 KE / CR-M4
category: 3D printing — software / slicing

## What is slicing?
Slicing converts your 3D model file (.STL, .OBJ, .3MF) into a `.gcode` file — the exact layer-by-layer coordinates, speed, and temperature instructions that the 3D printer executes.

## Slicing Software in the ICL
The ICL computers have two slicers available:
1. **Creality Print** (Recommended for Ender 3 V3 KE & CR-M4): Official native slicer with pre-tuned high-speed profiles for the lab's printers.
2. **Ultimaker Cura**: Popular open-source slicer.

---

## How to Slice in Creality Print (Step-by-Step)

### 1. Open Creality Print & Select Printer
1. Open **Creality Print** from the desktop.
2. At the top left of the window, ensure your target printer is selected from the device dropdown:
   - **Creality Ender-3 V3 KE** (0.4mm Nozzle)
   - OR **Creality CR-M4** (0.4mm Nozzle)
3. Select your material from the filament dropdown: **Generic PLA** or **Hyper PLA**.

### 2. Import Your 3D Model
1. Click the **Import** button in the top toolbar (or press `Ctrl + O` / drag-and-drop).
2. Select your `.STL`, `.OBJ`, or `.3MF` file.
3. Your model will appear positioned on the virtual heated bed.

### 3. Position, Scale, and Orient Your Model
Use the transform tools on the left toolbar:
- **Move**: Click the model and drag to center it on the bed.
- **Scale**: Resize dimensions. Keep "Uniform Scale" checked to preserve proportions.
- **Rotate / Lay Flat**: Click **Rotate** and use the **Auto-orient** or **Lay Flat on Face** tool to ensure the largest flat surface rests firmly against the build plate for maximum bed adhesion.

### 4. Configure Slicing Settings (Right Panel)
For standard 3D prints, use these recommended settings:
- **Layer Height**: `0.20mm Standard` (use `0.12mm High Quality` for fine details).
- **Infill Density**: `15% - 20%` (Pattern: *Grid* or *Gyroid*). Increase to `40% - 100%` for load-bearing or mechanical parts.
- **Supports**: Check **Generate Support** (Tree support or Normal) if your model has overhang angles steeper than 45° or bridges floating in mid-air.
- **Build Plate Adhesion**: Set to **Brim** (5mm) for small or tall prints to prevent corners from peeling and warping.

### 5. Slice and Preview
1. Click the blue **Slice** button in the bottom-right corner.
2. Click **Preview** to inspect the sliced toolpath.
3. Use the right-hand layer slider to scroll from layer 1 to top, checking that:
   - The first layer has complete, solid lines on the bed.
   - Overhangs have proper support structures beneath them.
4. Note the estimated print time and filament consumption (grams).

### 6. Export to USB
1. Insert your USB drive into the computer.
2. Click **Export to Local File** (or **Save to Disk**).
3. Save the `.gcode` file into the root of your USB drive.
4. Safely eject the USB drive from the computer, plug it into the printer's front USB port, and start your print.

---

## How to Slice in Ultimaker Cura (Alternative Slicer)

1. Open **Ultimaker Cura**.
2. If first time: click **Add a non-networked printer** → select **Creality → Ender 3 V3 KE** (or CR-M4) → click **Add**.
3. Go to **File → Open File** and select your `.STL` or `.OBJ` model.
4. Use left toolbar to Move, Scale, or Rotate:
   [VIDEO: https://xyaewwhcelutcoosbawk.supabase.co/storage/v1/object/public/videos/scaling.mp4 | How to scale your model in Cura]
5. In the right panel, configure:
   - **Material**: Generic PLA (210°C / 60°C bed)
   - **Profile**: 0.2mm Standard
   - **Infill**: 20%
   - **Generate Supports**: On if overhangs > 45°
   - **Build Plate Adhesion**: Brim
6. Click **Slice** in the bottom-right corner.
7. Click **Save to Disk** and save the `.gcode` file to your USB drive.
8. Safely eject the USB drive.

---

## Common Slicing Mistakes to Avoid
- **Printing in the air**: Always ensure the model is touching the build plate (Z=0).
- **Missing supports**: Any overhang greater than 45° will droop without support structures.
- **No brim on thin tall prints**: Tall or small surface objects will detach mid-print without a 5mm brim.
- **Infill too low on functional hooks/brackets**: Use at least 40–50% infill with 4 wall perimeters for weight-bearing parts.
