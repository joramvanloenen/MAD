# MAD — Museum of Art & Discovery

MAD is a walkable 3D museum where visitors create and exhibit artwork for 14 days, after which it moves to the visitable Depot. Hosted on GitHub Pages from the main branch.

## Running and developing

Serve the project over HTTP or use GitHub Pages. Opening index.html directly with file:// will not load the ES modules. Three.js loads from jsDelivr.

The museum includes connected gallery spaces, procedural oak flooring, exhibition spotlights, shadows, display furniture, artworks on walls, pedestals and floor, static baked GI, inspection mode and gallery audio. The editor offers painting, formatted canvases/frames, procedural 3D sculptures with PBR surfaces, voxel reliefs, and smooth SDF clay sculpting with editable pigment and three LOD levels.

## Public visitor gallery and private maintenance access

MAD is an **account-free creative museum**. Visitors do not sign up or sign in. They can choose an empty exhibition space, create their artwork, provide a name and description, and press **PLACE IN MUSEUM**. The gallery submits the full artwork directly to the shared MAD Supabase database and displays it to everybody immediately if that space is still free. This includes 2D painting images, mixed-material baked meshes, sculpted clay and coloured voxels. The browser's old `localStorage` collection is no longer treated as publicly shared when Supabase is connected.

MAD uses Supabase project **MAD** (`hzpvktvrlocjubargvod`) and its *publishable* browser key. Sensitive keys and the administrator's access code are **never** stored in GitHub. Works last 14 days in the gallery and then move into the Depot; artworks in the hidden After Hours gallery remain displayed until removed by maintenance.

### Private maintenance login

Use **MAINTENANCE** in the gallery header and enter the separate access code. This code is verified against a **bcrypt hash stored in the private Supabase schema**; it is not present in the website JavaScript. A successful login produces a random, hashed-on-server admin session that lasts 12 hours and is held only in the current browser tab's `sessionStorage`. **LOG OUT** invalidates it immediately. Eight incorrect attempts cause a temporary 15-minute lockout.

Once unlocked, the maintenance dashboard supports viewing currently published artworks, hiding and restoring works, and permanently deleting them. All actions use server-verified admin RPCs; hiding UI controls or changing JavaScript cannot grant permissions. Anonymous visitors have database permission to insert *approved* artwork and read published artwork only. They cannot alter, hide or delete existing entries. Server-side occupancy checks prevent two pieces from using the same active exhibition spot.

**Code recovery or rotation:** an authorized database owner can run `select mad_private.reset_admin_code();` in the Supabase SQL Editor. This produces a **new** one-time maintenance code, stores only its hash, and revokes all older admin sessions. Copy it immediately to your password manager. Do not commit it or add it to `mad-config.js`.

### Setting up a NEW Supabase project

Apply `supabase/schema.sql` once in Supabase SQL Editor, then configure the *Project URL* and the *publishable / anon key* in `mad-config.js`. For existing projects that previously used Google accounts, apply `supabase/public-gallery-admin.sql` as the migration instead. MAD's current database has already been migrated. Google OAuth is **not used or required**.

### Risks of public submission

Because anyone can publish without identifying themselves, spamming or offensive submissions are possible. The maintenance dashboard provides removal but does not preapprove content. Before promoting MAD to a heavily trafficked public installation, add edge-level rate limits and bot protection (for example Cloudflare Turnstile) and consider automated content moderation. Large JSON artworks are capped at 3 MB by the database; for bigger creations use Supabase Storage with validated uploads. No email address is collected by the museum to publish artwork.

## Controls

WASD/mouse: walk/look. Shift: sprint. E: interact. Esc: release pointer. G: baked lighting toggle. Smooth Clay: paint/build/carve/smooth/flatten with left mouse; right drag or Alt-drag to orbit. Paint: brush, watercolor, charcoal, spray, smudge, mirror, procedural patterns, undo/redo.

## Project layout

- `museum-environment.js`: connected galleries, wood PBR floor, track fixtures, lights and furniture.
- `museum-depot.js`: 20 sliding white-metal mesh picture racks guided by floor and ceiling rails. Archived paintings and wall reliefs mount on the sliding frames (up to 80); E/USE pulls a rack out or returns it. Other artworks remain on separate compact archive stands. Collection navigation opens the appropriate rack.
- `museum-expansion.js`: physically open north/east passageways, illuminated white transitional hall, three connected New Wing rooms, upstairs exhibition rooms with a stair transition, concealed west-wall service door with steps descending to the underground After Hours gallery, visitor-only exhibition bays and reduced mobile cellar lighting. Gallery transit uses a short faded scene transition at level changes. Rack collision locations update as they move.
- `museum-vitrines.js`: six interactive protective glass display cases (V1–V6), including the original static showcase location, fitted artwork placement, small exhibit plaques and collision volumes. Works can be painted, sculpted, voxel-built or clay-sculpted; completed works are scaled to fit safely inside the glass. A showcase preview appears in the 3D editors, and archived cases are preserved in the Depot.
- `static-lightmap-baker.js`: deterministic offline GI baker sampling fixed architecture with diffuse hemisphere rays, direct light visibility and one bounce.
- `static-lightmaps-data.js`: five committed RGB565 lightmap atlases (gallery, wing, upper, Depot, cellar), each 128×192 pixels with 6 packed UV2 charts.
- `static-lightmap.js`: lightweight runtime that maps UV2 on architectural meshes and reads the baked atlases as linear DataTextures. No CPU ray tracing, GI shader injection or GPU texture updates occur every frame.
- `tools/bake-lightmaps.html`: developer-facing rebake and download utility.
- `art-presentation.js`: gallery frames, artwork dimensions, PBR materials.
- `clay-sculpt.js`: 25³ signed-distance sculpting, vertex pigment, mesh extraction and LOD.
- `mixed-media.js`: assemblage editor for sawn wooden panels (straight, diagonal, angled or notched), beams, layered carved wooden forms, ceramic, metal, found forms, rods, and fabric sheets. Individual parts can be selected and translated/rotated/scaled, hierarchically glued, and painted with brush marks. Fabric simulates a low-resolution constrained cloth grid and can be frozen into static geometry. Publishing bakes every part and painted mark into one indexed, vertex-colored `BufferGeometry` with small PBR material groups; optimized mesh bytes are packed into base64 for browser-local storage. The editor uses the existing sculpture WebGL renderer, not a new canvas context. Note: this is a multi-material mesh merger with vertex deduplication, **not** a manifold Boolean union or full-texture painter.
- `wall-art.js`: nonpenetrating wall relief rules.
- `museum-inspection.js`: orbitable close-up exhibit viewer.
- `split-flap.js`: animated black 16-column × 3-row mechanical arrival board beside the Depot door, with white flap lettering, green indicator tiles, alternating recent artist/title notices and cryptic messages. Interact using E near the board or use the DISPLAY menu button. Edit messages as multiline blocks separated by a blank line; Save persists only in the current browser's localStorage, not globally across visitors.
- `museum-audio.js`: five locally hosted, recorded footsteps on wood, matched to distance walked (roughly 0.6 seconds between contacts at normal walking speed), gentle per-step pitch variation and short room reflections.
- `museum-placement.js`: immutable gallery spot IDs, occupancy verification, and camera return to the exact newly filled spot.
- `museum-store.js`, `museum-account-ui.js`, `supabase/schema.sql` and `mad-config.js`: anonymous shared storage, maintenance-code login, and secure database controls.

## Known limitations

This remains a prototype. The MAD cloud project is connected; public submissions are enabled without authentication. SQL protects simultaneous **approval** of artworks for the same active slot, but pending submissions may still compete; larger media require object storage, and live cross-device QA, moderation tooling, performance profiling and accessibility work remain important.

## Footstep recording license

The samples `assets/audio/footstep_wood_000.ogg` through `footstep_wood_004.ogg` come from **Kenney — Impact Sounds** (CC0 1.0 public domain dedication). They replace the former synthesized footsteps and are hosted inside MAD to avoid third-party hotlink dependencies. Original source: https://kenney.nl/assets/impact-sounds. The audio files were retrieved from the CC0 collection in https://github.com/iree-gd/iree.gd/tree/main/sample/assets/audio/impact. The music/ambient system is not affected by these clips.

## Expanded galleries and After Hours

From the main gallery, enter the illuminated north passage near the north-east corner to reach the **New Wing**. The scene change places visitors in a matching bright hallway at the south edge of the New Wing, facing directly into its central exhibit room, while the upper-floor stairs remain a separate route to the east. On the return trip, visitors reappear in the original gallery hallway. The corridor opening and skirting have matching architectural cutouts. The New Wing has three adjoining gallery areas and a staircase leading to the **upper-floor exhibition**. The main east Depot door now looks through a physically open short white corridor (no wall directly behind the doorway); walk to the bright end and use the interaction control to switch sections.

The main gallery's west wall conceals an unmarked ground-level door near Z≈4.4. Interact with it to reveal stairs descending to **After Hours**, a moody underground exhibition. Ten dedicated wall spots (C1–C10) accept visitor paintings and wall reliefs there, including spaces on the west and east walls. After Hours works remain in the cellar rather than joining the normal 14-day Depot rotation and are not included in the regular gallery split-flap messages. There are no preinstalled or procedurally generated artworks in the cellar: it starts empty and displays only submitted visitor works. Its west-facing stair vestibule, three open ceiling bays, unobstructed wall labels and lowered vault replace the old pillars and stray wall sections. Once visitors discover the cellar, its collection appears in their Collection menu.

**Content note:** The cellar is intended for unsettling or mature artistic themes, but this static prototype has neither age verification nor a complete moderation system. Actual public hosting of mature visitor content would require moderation policies, warnings, and access controls. Moving up/down the correctly oriented west-ascending stairs uses an animated scene change at the landing, not fully continuous multi-floor locomotion.

## Static global illumination

MAD uses **baked indirect illumination**, rather than continuous DDGI. Fixed architecture in each room receives a second set of UVs (UV2) and samples a committed, RGB565-compressed lightmap. The atlas contains six charts for floor, ceiling and four wall orientations. The baker computes approximate diffuse light transport against architectural bounding volumes and permanent interior partitions using deterministic cosine-weighted ray samples, including a first diffuse bounce and soft corner attenuation. A live gallery uses just one static 2D lightmap texture per room, shared by the architectural materials. Visitor-created artworks and movable components are deliberately excluded and continue using the gallery's normal lighting.

To rebake when architecture changes, open `tools/bake-lightmaps.html` on the published GitHub Pages site. Pick the number of rays, press **Bake all**, then **Save baked lightmaps JS**. Replace `static-lightmaps-data.js` in the repository with the downloaded file and commit it to `main`. This is a manual editorial workflow: visitors do not recompute lighting and the web editor does not silently push repository changes. The **LIGHT: BAKED** toggle (keyboard **G**) temporarily disables the indirect contribution for inspection.

The baked solution is an **architectural proxy approximation**, not a production path-traced geometry-aware bake. It cannot include new visitor sculptures, movable racks, or every wall opening as a separate occluder. Rebuild the data when room geometry or the fixed lighting layout changes substantially.

## Higher-resolution voxel artworks

New voxel artwork uses a **2× finer grid** in each axis, including a 21×21 wall-relief canvas instead of the legacy 9×9 grid. **Add, Paint and Remove** tools can be used with the existing palette. Every painted cell now saves its own `#RRGGBB` colour, and exhibition mode draws all cells efficiently through one instance-coloured mesh. Existing older voxel works without per-cell colour or a `voxelResolution` property still render with their original overall colour and original voxel size.

## Artwork editor layout (desktop / mobile)

The editor now runs as a dedicated workstation instead of a single vertically scrolling modal. Desktop presents a nearly full-window 2D/3D canvas and a fixed right-hand inspector with **Create**, **Appearance** and **Artwork Info** tabs. **Place in Museum** is always in the bottom bar and requires the title and description.

On phones the editor fills the available dynamic viewport. All five modes (Paint, 3D Form, Voxels, Clay, Mixed) stay simultaneously visible in a small fixed tab row. The canvas gets the flexible upper area; compact tool panes occupy the lower dock, and the publish action stays fixed at the bottom. The full page doesn't scroll. Complex mixed-media controls are split into five categories (Materials, Assemble, Transform, Paint, Cloth), so visitors can access every action without scrolling through a long form. Landscape phones use a side-by-side arrangement. Tool state and input nodes are preserved when switching panes.

## Mixed-media atelier

Choose **MIXED MEDIA** from the artwork editor. Combine materials using the palette; select parts by tapping the 3D model or the component selector. The Move, Rotate, Paint and Orbit modes work with mouse or touch. Cut wood using the Saw Cut profile tool, use the position/rotation/scale controls, and Glue to Previous to make real parent-child assemblies. Fabric can be draped live, settled and frozen. Paint dabs adhere to the selected piece and survive transformations. **Bake & Check Mesh** reports triangle and vertex counts; **Place in Museum** always bakes, including remaining active fabric, into a static indexed display mesh. In glass showcases the editor preview is scaled down while the baked artwork stays at its intrinsic size for accurate fitting.

Limitations: up to 25 independent pieces and 220 paint marks per piece, a 45k-vertex baking cap, simplified cloth-to-sculpture collisions and limited saw-cut presets. The current system doesn't do arbitrary hand-drawn cut paths, watertight CSG unions, UV texture painting, professional remeshing/retopology, or downloadable GLB exports. Large works may reach the browser's localStorage quota; production storage would use durable binary object storage rather than JSON/base64.

### Concealed cellar entrance

The secret door is disguised as a plaster wall panel on the west side of the main gallery. The previously visible framing and decorative handle are removed; only a quiet hairline seam and subtle push detail remain. Inspecting the wall seam opens a hinged panel to the underground stairwell. The cellar staircase itself has not been changed in this refinement.
