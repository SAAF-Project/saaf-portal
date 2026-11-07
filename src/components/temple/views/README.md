# Visualisations and the `visualization.yaml` contract

Every visualisation (Temple, Islands, Agent dependencies, ...) has a folder here with two files:

```
views/<id>/
  visualization.yaml   what the view says about itself
  preview.jpg          the picture on its tile in the chooser (about 880 x 550, under 200 KB)
```

One shared engine (`../ProgressApp.tsx`) provides the data, the filters, the side panel, the tour, the chooser and the
links. A visualisation is **frontend only**: it receives the data and the current focus, draws them and reports clicks. It
never writes data.

## visualization.yaml

```yaml
id: islands                 # lowercase letters, digits, dashes; must equal the folder name
name: Islands               # the tile and the switch in the header
short_name: Isl             # optional, the same on narrow screens
title: The SAAF Archipelago # what the whole picture is called (panel, breadcrumb)
description: One or two sentences for the tile in the chooser.
preview: preview.jpg        # a picture next to this file
access: community           # reserved for later; community = everyone who can open the portal
supports:
  filters: true             # the Filters button (default true)
  display: [scenery, style] # personal display options this view has: scenery, style (default none)
  relations: false          # shows the relations between plans, so "How this is calculated" explains them (default false)
calculation:                # "How this is calculated": a few lines about THIS view only
  - An island grows with its number of plans.
tour:                       # the onboarding tour of this view, at least one step
  - title: The whole project as islands
    text: Two or three sentences.
    target: view            # optional: view | views | filters | display | tour | panel | legend
    focus: { level: project }   # optional: project | annex | { level: part, part: <part id> }
```

- **`target`** highlights a part of the page: the element with `data-tour="<target>"`. `view` is the picture itself (no
  highlight, the card sits at the bottom). A step whose target is not on the page is skipped, so a tour never points at
  a button the view does not have. A step that explains a button or the legend returns to the overview first.
- **`focus`** moves the view to a block before the card is shown, so the step zooms in on the real part of the visual.
- **`supports.display`** decides what the Display menu offers. Without any option there is no Display button.
- **`calculation`** must say nothing about other views (the tests check for the words temple / island).

The file is read and checked on the server (`src/lib/visualisations.ts`, `parseManifest` in `../visualisation.ts`). A
mistake fails the build or the page with the file name and the field in the message.

## Adding a view

1. Make the folder `views/<id>/` with `visualization.yaml` and `preview.jpg`.
2. Write the component. It gets `VisualProps` (see `../views.ts`). Put it in its own folder next to this one.
3. Add **one entry** to `REGISTRY` in `../views.ts` (id, the preview import, the lazy component).
4. `npm test`: it checks that every registered view has a manifest and the other way round, that the tour only points at
   real targets and blocks, and that a view without scenery does not promise a Display menu.

Nothing else changes: not the engine, not the chooser, not the tour. Removing a view is deleting its folder and its
entry; links that still say `view=<id>` then show the chooser.

## The chooser and the link

A first visit, or a link without `view=`, shows the chooser. The choice is written to the link (`#/?view=<id>`) and
remembered per person only when someone picks. The first time someone opens a view its tour starts by itself (once per
view, remembered in the browser); the Tour button replays it.
