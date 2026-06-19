# Ender 3 V3 KE — Print Troubleshooting
machine: Ender 3 V3 KE
category: 3D printing — troubleshooting

Common problems students run into on the Ender 3 V3 KE, what causes them, and what you can safely do. If a fix involves opening up or taking apart the printer, stop and ask ICL staff — do not attempt hardware repairs yourself.

---

## The first layer won't stick to the bed

This is the most common problem. The print needs a solid first layer or nothing else works.

What to do:
1. Make sure the bed is clean. Fingerprints and dust stop plastic from sticking. Wipe the plate with isopropyl alcohol and let it dry.
2. Apply a thin, even layer of glue stick (solid adhesive) to the area where the print will sit.
3. Re-level before printing — the Ender 3 V3 KE auto-levels with its CR-Touch sensor, so just start the print and let it run the auto-level step. Do not skip it.
4. In Cura, check that Material is set to PLA and that the first layer is printing slowly. A brim (a flat ring around the base) helps a lot — enable "Brim" under Build Plate Adhesion in Cura and re-slice.

If it still won't stick after a clean bed and glue, the bed plate may be worn out — tell ICL staff so they can swap it.

---

## The print turned into a stringy mess / bird's nest / "spaghetti"

This means the print came loose from the bed partway through, and the nozzle kept extruding plastic into the air.

What to do:
1. Stop the print — there is no saving it once it is spaghetti.
2. Remove the tangled plastic from the nozzle and bed. Wait for the bed to cool, lift the magnetic plate, and peel it off.
3. The root cause is almost always first-layer adhesion. Before reprinting, clean the bed, apply glue stick, and add a brim (see "first layer won't stick" above).
4. Tall, narrow models tip over easily. If your model has a small base, add a brim or raft in Cura for more grip.

---

## Corners are lifting up off the bed (warping)

The corners curl upward and detach while the lower layers stay down. This happens because the plastic cools and shrinks unevenly.

What to do:
1. Make sure the bed is clean and glue stick is applied — warping is an adhesion problem.
2. Add a brim in Cura and re-slice. The extra surface area holds the corners down.
3. Keep the lab door and windows closed near the printer — drafts and cold air make warping worse.
4. PLA warps far less than other plastics. If you are using PLA and still warping badly, it is almost always adhesion — focus there.

---

## Thin wispy threads of plastic between parts of the print (stringing)

Fine hairs or threads stretch across gaps in the model, like a spider web.

What to do:
1. This is cosmetic — the print is still usable. You can clean the threads off afterward by hand or with a heat gun (ask staff for the heat gun).
2. To reduce it next time, make sure you are slicing with PLA settings in Cura (the profile already has the right retraction values).
3. Damp or old filament strings more. If a fresh slice still strings badly, mention it to ICL staff — the filament may need drying.

---

## Nothing is coming out of the nozzle / the print is missing layers

The printer is moving but little or no plastic is coming out (under-extrusion), or there are gaps and missing lines in the print.

What to do:
1. Check the filament spool — make sure it has not run out or tangled. The Ender 3 V3 KE has a sensor that pauses the print if filament runs out; reload filament and resume.
2. Check that the filament actually reached the nozzle. If you just loaded new filament, run Extrude from the screen (Prepare → Extrude/Retract) until plastic flows steadily.
3. If filament is loaded and feeding but still nothing comes out, the nozzle may be clogged. Do not try to clear or replace the nozzle yourself — this is a staff task. Tell ICL staff.

---

## Grinding or clicking noise from the extruder

A repeated clicking or grinding sound usually means the filament is stuck and the gear is skipping on it.

What to do:
1. Stop the print.
2. Do not force anything. A clog or jam needs staff to clear it safely without damaging the hot end.
3. Tell ICL staff what you heard and which printer you were using.

---

## The print shifted partway up (layers are offset)

The upper part of the print is shifted sideways from the lower part, like the layers slipped.

What to do:
1. This is usually caused by the printer being bumped or something blocking the moving parts mid-print. Make sure nothing is leaning against the printer or sitting on the rails.
2. Re-slice and reprint with a clear area around the printer.
3. If it keeps happening on a clear, untouched printer, report it to ICL staff — it may need a belt or hardware check.

---

## When to stop and get help

Stop the print and find ICL staff (or supervisors Eric or Josh) if:
- You hear grinding, clicking, or any unusual mechanical noise
- You smell burning
- The nozzle or anything is leaking plastic in a way that is not normal extrusion
- The same problem keeps happening after you have tried the fixes above

Never try to open the hot end, replace the nozzle, or adjust hardware yourself. Those are staff tasks.
