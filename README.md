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
- `museum-depot.js`: 20 sliding white-metal mesh picture racks guided by floor and ceiling rails. Archived paintings and wall reliefs mount on the sliding frames (up to 80); E/USE pulls a rack out or returns it. Other artworks remain on separate compact archive stands. Collection navigation opens the appropriate rack.
- `museum-expansion.js`: physically open north/east passageways, illuminated white transitional hall, three connected New Wing rooms, upstairs exhibition rooms with a stair transition, concealed west-wall service door with steps descending to the underground After Hours gallery, atmospheric study works and reduced mobile cellar lighting. Gallery transit uses a short faded scene transition at level changes. Rack collision locations update as they move.
- `museum-vitrines.js`: six interactive protective glass display cases (V1–V6), including the original static showcase location, fitted artwork placement, small exhibit plaques and collision volumes. Works can be painted, sculpted, voxel-built or clay-sculpted; completed works are scaled to fit safely inside the glass. A showcase preview appears in the 3D editors, and archived cases are preserved in the Depot.
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

## Expanded galleries and After Hours

From the main gallery, enter the new north passage near the north-east corner to reach the **New Wing**. The New Wing has three adjoining gallery areas and a staircase leading to the **upper-floor exhibition**. The main east Depot door now looks through a physically open short white corridor (no wall directly behind the doorway); walk to the bright end and use the interaction control to switch sections.

The main gallery's west wall conceals an unmarked ground-level door near Z≈4.4. Interact with it to reveal stairs descending to **After Hours**, a moody underground exhibition. Seven special wall spots (C1–C7) accept visitor paintings and wall reliefs there. After Hours works remain in the cellar rather than joining the normal 14-day Depot rotation and are not included in the regular gallery split-flap messages. A few atmospheric study paintings are built into the cellar; they are generated art, not purported community submissions. Once visitors discover the cellar, its collection appears in their Collection menu.

**Content note:** The cellar is intended for unsettling or mature artistic themes, but this static prototype has neither age verification nor a complete moderation system. Actual public hosting of mature visitor content would require moderation policies, warnings, and access controls. Moving up/down the stairs uses an animated scene change, not fully continuous multi-floor locomotion.
