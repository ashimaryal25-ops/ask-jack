# Ender 3 V3 KE — Slicing with Ultimaker Cura
machine: Ender 3 V3 KE
category: 3D printing — software / slicing

## What is slicing?
Slicing converts your .stl or .obj model file into a .gcode file — the set of movement and temperature instructions the printer actually follows. You do this on a computer before touching the printer.

## Software to use
**Ultimaker Cura** — free download at www.ultimaker.com/software

## First-time setup (do this once)
1. Download and install Ultimaker Cura
2. Open Cura
3. When prompted to add a printer, select **"Add a non-networked printer"**
4. In the list, find **Creality → Ender 3 V3 KE**
5. Click Add — your printer is now configured

## Importing your model
1. Click the folder icon in the top-left, or go to **File → Open File**
2. Navigate to your .stl or .obj file and open it
3. The model will appear on the virtual print bed

## Adjusting your model (optional)
Use the toolbar on the left side of the screen:
- **Move** — reposition the model on the bed
- **Scale** — make it bigger or smaller (check "Uniform Scaling" to keep proportions)
- **Rotate** — tilt or spin the model. Flat side down prints best.
- **Mirror** — flip the model horizontally

## Print settings (right panel)
For most beginner prints, the defaults work well:

| Setting | Recommended | Notes |
|---|---|---|
| Material | PLA | Change only if using PETG or ABS |
| Profile / Layer height | 0.2mm (Standard) | Good balance of speed and quality |
| Infill | 20% | Fine for most objects. Increase to 50–100% for strong functional parts |
| Generate Supports | On if needed | Enable if your model has overhangs greater than 45° |
| Build Plate Adhesion | Brim | Helps first layer stick. Use Raft for tall or narrow objects |

## Slicing and saving to USB
1. Insert a USB drive into your computer
2. Click **"Slice"** button in the bottom-right of Cura
3. Cura will show estimated print time and material usage — review this
4. Click **"Save to Disk"** and save the .gcode file directly to your USB drive
5. Eject the USB safely

## Common mistakes
- Forgetting to check if supports are needed — overhanging parts will droop without them
- Infill too low for functional parts — increase to 40%+ for parts under stress
- Model too big for the bed — scale it down or split it in Cura
