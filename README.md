# MAD — Museum of Art & Discovery

MAD is a walkable 3D museum where visitors create and exhibit artwork for 14 days, after which it moves to the visitable Depot. Hosted on GitHub Pages from the main branch.

## Running and developing

Serve the project over HTTP or use GitHub Pages. Opening index.html directly with file:// will not load the ES modules. Three.js loads from jsDelivr.

The museum includes connected gallery spaces, procedural oak flooring, exhibition spotlights, shadows, display furniture, artworks on walls, pedestals and floor, dynamic GI, inspection mode and gallery audio. The editor offers painting, formatted canvases/frames, procedural 3D sculptures with PBR surfaces, voxel reliefs, and smooth SDF clay sculpting with editable pigment and three LOD levels.

## Optional shared gallery: Supabase

**Unconfigured by default.** Until connected, artworks exist only in the current browser's localStorage, not a public collection.

1. Create your own Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Put the Supabase **Project URL** and **publishable / anon key** in `mad-config.js`. Never put a service-role or secret key in static client code.
4. Commit to main and wait for Pages deployment.
5. Visitors' artworks are submitted as **pending** for safety. Use the Supabase Table Editor to review and approve or reject submissions; approved artwork is publicly visible.
6. Before a broad public launch, configure rate limiting, CAPTCHA, quotas, ownership/authentication and media-storage policies. The included RLS prevents public visitors from approving and editing rows, but guest submissions can still be spammed.

The client currently stores painting images and sculpt fields inside artwork JSON. Migrate larger media to Supabase Storage with upload restrictions as usage grows.

## Controls

WASD/mouse: walk/look. Shift: sprint. E: interact. Esc: release pointer. G: GI quality. Smooth Clay: paint/build/carve/smooth/flatten with left mouse; right drag or Alt-drag to orbit. Paint: brush, watercolor, charcoal, spray, smudge, mirror, procedural patterns, undo/redo.

## Project layout

- `museum-environment.js`: connected galleries, wood PBR floor, track fixtures, lights and furniture.
- `gi.js`: directional multi-bounce irradiance probe approximation.
- `art-presentation.js`: gallery frames, artwork dimensions, PBR materials.
- `clay-sculpt.js`: 25³ signed-distance sculpting, vertex pigment, mesh extraction and LOD.
- `wall-art.js`: nonpenetrating wall relief rules.
- `museum-inspection.js`: orbitable close-up exhibit viewer.
- `split-flap.js`: animated black 16-column × 3-row mechanical arrival board beside the Depot door, with white flap lettering, green indicator tiles, alternating recent artist/title notices and cryptic messages. Interact using E near the board or use the DISPLAY menu button. Edit messages as multiline blocks separated by a blank line; Save persists only in the current browser's localStorage, not globally across visitors.
- `museum-audio.js`: five locally hosted, recorded footsteps on wood, matched to distance walked (roughly 0.6 seconds between contacts at normal walking speed), gentle per-step pitch variation and short room reflections.
- `museum-placement.js`: immutable gallery spot IDs, occupancy verification, and camera return to the exact newly filled spot.
- `museum-store.js` and `mad-config.js`: optional shared Supabase data store.

## Known limitations

This remains a prototype. Cloud credentials are not configured. Placement reservations are not transactional across visitors, clay mesh regeneration is CPU based, and the site still needs live multi-device QA, moderation workflows, mobile performance profiling, and additional accessibility work.

## Footstep recording license

The samples `assets/audio/footstep_wood_000.ogg` through `footstep_wood_004.ogg` come from **Kenney — Impact Sounds** (CC0 1.0 public domain dedication). They replace the former synthesized footsteps and are hosted inside MAD to avoid third-party hotlink dependencies. Original source: https://kenney.nl/assets/impact-sounds. The audio files were retrieved from the CC0 collection in https://github.com/iree-gd/iree.gd/tree/main/sample/assets/audio/impact. The music/ambient system is not affected by these clips.
