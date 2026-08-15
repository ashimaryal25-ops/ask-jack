# Embroidery Software Guide — Artistic Digitizer & VinylMasterCut
machine: Artistic Digitizer / VinylMasterCut
category: embroidery — software

## Overview of Software Workflow
To get a design onto the Janome MC550E or MC9850, you use two programs in the ICL:
1. **VinylMasterCut**: Vectorizes any raster graphic (.PNG, .JPG, .BMP) into clean vector shapes (.SVG).
2. **Artistic Digitizer**: Converts vector lines (.SVG) into machine embroidery stitch paths, sets thread colors and hoop sizes, and exports the final `.JEF` file.

---

## Vectorizing an Image in VinylMasterCut

If your artwork is already a vector `.SVG`, skip to Artistic Digitizer. If you have a downloaded logo or graphic (.PNG, .JPG), vectorize it first:

1. Open **VinylMasterCut** on the desktop.
2. Go to **File > Import** and select your image file.
3. Select the image on the canvas and click the **Vectorize** button in the top toolbar.
4. Choose the number of colors you want the software to trace. Reducing color count simplifies stitching.
5. Click **Trace** to preview the vector paths. If it looks clean, click **Accept**.
6. Go to **File > Export**.
7. Choose **.SVG (Scalable Vector Graphics)** as the format and save it to your desktop or USB.

[IMAGE: https://xyaewwhcelutcoosbawk.supabase.co/storage/v1/object/public/images/embroidery/icl-vectorize-vinylmaster.png | Vectorizing an Image in VinylMasterCut]

---

## Creating Your Design in Artistic Digitizer

1. Open **Artistic Digitizer** on the desktop.
2. In the welcome screen, click **Create New**.
3. Select your embroidery machine:
   - **Janome Memory Craft 550E** OR **Janome MC9850**.
4. Choose the hoop size that fits your garment and design:
   - MC550E options: SQ14b (5.5"x5.5"), RE20b (7.9"x5.5"), SQ20b (7.9"x7.9"), RE36b (7.9"x14.2")
   - MC9850 options: FA10a (1.6"x3.9"), SQ14a (5.5"x5.5"), RE20a (6.7"x7.9")
5. Go to **File > Import > Image** (or Artwork) and select your `.SVG` file.
6. Resize your design:
   - Make sure all artwork stays inside the inner dashed boundary line of the hoop.
   - Leave at least 15–20mm margin from the hoop edge.
7. Assign stitch types (Fill, Satin stitch, or Outline) and thread colors to each section of the artwork.
8. Preview the 3D stitch simulation to verify sewing order and look for gaps or excessive jump stitches.

[IMAGE: https://xyaewwhcelutcoosbawk.supabase.co/storage/v1/object/public/images/embroidery/icl-digitizer-hoop-select.png | Selecting Machine and Hoop Size in Artistic Digitizer]

---

## Exporting to USB (CRITICAL FOLDER STRUCTURE)

The Janome embroidery machines will **NOT** read `.JEF` files stored in the USB root directory or arbitrary folders. You must follow this exact folder hierarchy:

1. Insert your USB drive.
2. In the root of the USB drive, create a folder named `EMB` (all uppercase).
3. Inside the `EMB` folder, create a subfolder named `EMBF` (all uppercase).
4. In Artistic Digitizer, go to **File > Save As** (or Export).
5. Select **.JEF (Janome Embroidery Format)**.
6. Save your file into the `EMBF` folder:
   - Path: `USB_DRIVE:\EMB\EMBF\your_file.JEF`
7. Safely eject the USB drive from the computer.

[IMAGE: https://xyaewwhcelutcoosbawk.supabase.co/storage/v1/object/public/images/embroidery/icl-artistic-digitizer-save.png | Saving .JEF File to USB EMB/EMBF Folder Structure]

---

## Software Tips & Best Practices
- **Text & Monograms**: Keep lettering at least 5mm (0.2 inches) tall so letters stitch cleanly without turning into thread knots.
- **Underlay Stitching**: Artistic Digitizer adds underlay automatically; keep it enabled to anchor the fabric to the stabilizer before sewing top satin/fill stitches.
- **Stitch Density**: Default 0.4mm density is optimal for standard embroidery thread. Don't over-densify small areas or fabric will become stiff and pucker.
