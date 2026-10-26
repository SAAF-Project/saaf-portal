# Photoreal accents

Static pictures behind the temple (sky and ground). They are decoration only: the temple itself is drawn from data.

| File | What | Used for |
|---|---|---|
| `sky-dusk.jpg` | calm dusk sky over soft hills | dark theme |
| `sky-day.jpg` | bright daytime sky over green hills | light theme |
| `ground-stone.jpg` | pale limestone paving, top-down, 1024 px square | ground (tiled with mirrored edges) |

AI-generated on 2026-10-07 with `bytedance-seedream-5-pro` through the ElevenLabs image tool, 2 variations per prompt (the first sky variations and the second paving variation were kept). Prompts:

- Dusk: "Wide panoramic photograph of a calm dusk sky over a distant low horizon of soft hills, deep blue to indigo gradient at the top fading to a warm pale peach glow at the horizon, thin soft high clouds, no buildings, no people, no birds, no text, no sun disc, very smooth low-contrast, cinematic, photorealistic"
- Day: "Wide panoramic photograph of a bright clear daytime sky over a distant low horizon of soft green hills, pale blue gradient at the top fading to near white haze at the horizon, a few thin wispy white clouds, no buildings, no people, no birds, no text, no visible sun, very smooth low-contrast, soft natural light, photorealistic"
- Paving: "Top-down photograph of weathered pale limestone paving slabs laid in a regular grid with thin dark joints, evenly lit with soft diffuse light, no shadows, no people, no objects, no text, subtle natural wear and fine grain, flat orthographic view filling the whole frame, seamless tileable stone texture, photorealistic"

To replace a picture, keep the file name. The horizon line of each sky picture is set in `src/temple/Scenery.tsx` (`SKY.*.horizon`, measured from the top of the picture). Switch the scenery off with the "Scenery" button or `?scenery=off` in the link.
