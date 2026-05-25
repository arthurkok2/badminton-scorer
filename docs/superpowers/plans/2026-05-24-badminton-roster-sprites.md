# Badminton Roster Sprites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current little-fighters brawler art with a badminton-themed mixed roster and render deterministic per-player sprites in the court view.

**Architecture:** Keep `CourtView` as the only render surface for little-fighters mode. Add eight badminton sprite assets under `public/sprites/`, then replace the current team-level sprite lookup with a deterministic player-slot lookup in `src/components/CourtView.tsx`. Keep CSS and animation behavior unchanged unless a small fit correction is needed after visual verification.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, plain CSS, built-in image generation.

---

## File Structure

- Add `public/sprites/badminton-female-ace.png`: female ready stance, blue/gold outfit.
- Add `public/sprites/badminton-female-drop.png`: female front-court drop stance, coral/white outfit.
- Add `public/sprites/badminton-female-drive.png`: female drive stance, teal/navy outfit.
- Add `public/sprites/badminton-female-net.png`: female net-defense stance, lime/charcoal outfit.
- Add `public/sprites/badminton-male-clear.png`: male overhead clear stance, royal blue outfit.
- Add `public/sprites/badminton-male-defense.png`: male defensive crouch, red/white outfit.
- Add `public/sprites/badminton-male-jump-smash.png`: male jump-smash landing stance, orange/black outfit.
- Add `public/sprites/badminton-male-serve.png`: male low-serve stance, violet/white outfit.
- Modify `src/components/CourtView.tsx`: replace `FIGHTER_SPRITES` with a badminton roster lookup and add a helper that resolves the sprite per player id.
- Modify `src/components/CourtView.test.tsx`: add a focused test for badminton sprite assignment and update the existing little-fighters render expectations to stay stable.
- Modify `.docs/ui/ui-architecture.md`: describe the badminton roster and deterministic per-player sprite mapping in Little Fighters mode.
- Delete `public/sprites/fighter-team-a.png`: old generic fighter sprite, no longer referenced.
- Delete `public/sprites/fighter-team-b.png`: old generic fighter sprite, no longer referenced.

## Task 1: Generate and Save the Badminton Roster

**Files:**
- Create: `public/sprites/badminton-female-ace.png`
- Create: `public/sprites/badminton-female-drop.png`
- Create: `public/sprites/badminton-female-drive.png`
- Create: `public/sprites/badminton-female-net.png`
- Create: `public/sprites/badminton-male-clear.png`
- Create: `public/sprites/badminton-male-defense.png`
- Create: `public/sprites/badminton-male-jump-smash.png`
- Create: `public/sprites/badminton-male-serve.png`

- [ ] **Step 1: Generate the four female badminton sprites**

Use the built-in image tool with one prompt per file. Save the selected outputs to the exact filenames listed above.

```text
Use case: stylized-concept
Asset type: game sprite for little-fighters mode
Primary request: full-body pixel-art anime badminton athlete, female-presenting, transparent-style isolated composition on a removable plain background, unique silhouette and outfit, facing slightly inward toward center court
Style/medium: polished retro pixel art matching the current sprite proportions and shading density
Composition/framing: full body, generous padding, feet visible, racket fully visible, one character only
Lighting/mood: bright arcade energy
Constraints: no text, no watermark, no second character, no crowd, no floor, no photo realism
Avoid: boxing stance, martial-arts gloves, swords, shields, soccer gear, tennis ball imagery

Variant A filename: badminton-female-ace.png
Pose/outfit notes: ready stance, blue and gold badminton warmup jacket, white skirt-shorts, court shoes, racket up

Variant B filename: badminton-female-drop.png
Pose/outfit notes: front-court drop-shot stance, coral and white jersey, dark shorts, ponytail silhouette, racket angled forward

Variant C filename: badminton-female-drive.png
Pose/outfit notes: side-drive stance, teal and navy performance top, black shorts, braid silhouette, racket across body

Variant D filename: badminton-female-net.png
Pose/outfit notes: net-defense stance, lime and charcoal jacket, athletic leggings, short bob silhouette, racket held low and ready
```

- [ ] **Step 2: Generate the four male badminton sprites**

Use the built-in image tool with one prompt per file. Save the selected outputs to the exact filenames listed above.

```text
Use case: stylized-concept
Asset type: game sprite for little-fighters mode
Primary request: full-body pixel-art anime badminton athlete, male-presenting, transparent-style isolated composition on a removable plain background, unique silhouette and outfit, facing slightly inward toward center court
Style/medium: polished retro pixel art matching the current sprite proportions and shading density
Composition/framing: full body, generous padding, feet visible, racket fully visible, one character only
Lighting/mood: bright arcade energy
Constraints: no text, no watermark, no second character, no crowd, no floor, no photo realism
Avoid: boxing stance, martial-arts gloves, swords, shields, soccer gear, tennis ball imagery

Variant E filename: badminton-male-clear.png
Pose/outfit notes: overhead clear stance, royal blue jacket, dark track pants, tousled hair, racket high behind shoulder

Variant F filename: badminton-male-defense.png
Pose/outfit notes: low defensive crouch, red and white jersey, black shorts, ankle braces, racket centered in front

Variant G filename: badminton-male-jump-smash.png
Pose/outfit notes: jump-smash landing stance, orange and black sleeveless top over undershirt, dynamic hair silhouette, racket finishing across body

Variant H filename: badminton-male-serve.png
Pose/outfit notes: low-serve preparation, violet and white warmup top, tapered pants, calm stance, shuttlecock held near racket
```

- [ ] **Step 3: Validate size, background, and framing**

Confirm each file:

```text
- keeps the current full-body sprite framing
- has a clean transparent or removable flat background
- reads as badminton immediately because the racket and pose are unambiguous
- stays close to the existing sprite height so `.fighter-sprite` width rules can remain unchanged
```

- [ ] **Step 4: Save the final selected files into `public/sprites/`**

After generation, the directory should contain:

```text
public/sprites/badminton-female-ace.png
public/sprites/badminton-female-drop.png
public/sprites/badminton-female-drive.png
public/sprites/badminton-female-net.png
public/sprites/badminton-male-clear.png
public/sprites/badminton-male-defense.png
public/sprites/badminton-male-jump-smash.png
public/sprites/badminton-male-serve.png
```

- [ ] **Step 5: Commit the sprite assets**

```bash
git add public/sprites/badminton-*.png
git commit -m "feat: add badminton fighter roster sprites"
```

## Task 2: Wire Deterministic Player Sprites in `CourtView`

**Files:**
- Modify: `src/components/CourtView.test.tsx`
- Modify: `src/components/CourtView.tsx`
- Delete: `public/sprites/fighter-team-a.png`
- Delete: `public/sprites/fighter-team-b.png`

- [ ] **Step 1: Add a failing test for deterministic badminton sprites**

Append this test inside `describe('CourtView', () => {` in `src/components/CourtView.test.tsx`, after `places little fighter nameplates beside each team instead of below the sprites`:

```tsx
  it('renders deterministic badminton roster sprites for each little fighter slot', () => {
    render(
      <CourtView
        match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })}
        displayMode="little-fighters"
        onPointTeam={vi.fn()}
      />,
    );

    expect(screen.getByTestId('fighter-A1').querySelector('.fighter-sprite')).toHaveAttribute(
      'src',
      expect.stringContaining('badminton-female-ace.png'),
    );
    expect(screen.getByTestId('fighter-A2').querySelector('.fighter-sprite')).toHaveAttribute(
      'src',
      expect.stringContaining('badminton-male-clear.png'),
    );
    expect(screen.getByTestId('fighter-B1').querySelector('.fighter-sprite')).toHaveAttribute(
      'src',
      expect.stringContaining('badminton-female-drive.png'),
    );
    expect(screen.getByTestId('fighter-B2').querySelector('.fighter-sprite')).toHaveAttribute(
      'src',
      expect.stringContaining('badminton-male-jump-smash.png'),
    );
  });
```

- [ ] **Step 2: Run the focused component test to verify it fails**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/CourtView.test.tsx
```

Expected: FAIL because `CourtView.tsx` still points at `fighter-team-a.png` and `fighter-team-b.png`.

- [ ] **Step 3: Replace the team-level sprite map with a roster lookup**

In `src/components/CourtView.tsx`, replace:

```tsx
const FIGHTER_SPRITES: Record<TeamId, string> = {
  teamA: `${import.meta.env.BASE_URL}sprites/fighter-team-a.png`,
  teamB: `${import.meta.env.BASE_URL}sprites/fighter-team-b.png`,
};
```

with:

```tsx
const BADMINTON_FIGHTER_SPRITES = {
  A1: `${import.meta.env.BASE_URL}sprites/badminton-female-ace.png`,
  A2: `${import.meta.env.BASE_URL}sprites/badminton-male-clear.png`,
  B1: `${import.meta.env.BASE_URL}sprites/badminton-female-drive.png`,
  B2: `${import.meta.env.BASE_URL}sprites/badminton-male-jump-smash.png`,
} as const;

function getFighterSprite(playerId: string): string {
  return BADMINTON_FIGHTER_SPRITES[playerId as keyof typeof BADMINTON_FIGHTER_SPRITES] ?? BADMINTON_FIGHTER_SPRITES.A1;
}
```

- [ ] **Step 4: Swap the `<img>` source to use the new helper**

In `FighterTeam`, replace:

```tsx
            <img className="fighter-sprite" src={FIGHTER_SPRITES[player.teamId]} alt="" aria-hidden="true" />
```

with:

```tsx
            <img className="fighter-sprite" src={getFighterSprite(player.id)} alt="" aria-hidden="true" />
```

- [ ] **Step 5: Remove the old sprite files**

Delete:

```diff
*** Begin Patch
*** Delete File: C:\Users\arthu\Projects\badminton-scorer\public\sprites\fighter-team-a.png
*** Delete File: C:\Users\arthu\Projects\badminton-scorer\public\sprites\fighter-team-b.png
*** End Patch
```

- [ ] **Step 6: Run the focused component test again**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/CourtView.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit the roster wiring**

```bash
git add src/components/CourtView.tsx src/components/CourtView.test.tsx public/sprites
git commit -m "feat: use badminton sprites in little fighters mode"
```

## Task 3: Document the Roster and Run Full Verification

**Files:**
- Modify: `.docs/ui/ui-architecture.md`

- [ ] **Step 1: Update the Little Fighters architecture doc**

In `.docs/ui/ui-architecture.md`, replace the last bullet in `### Little Fighters Mode`:

```md
- Point feedback: scoring server animates with a lunge, opposing side flashes/bounces
```

with:

```md
- Point feedback: scoring server animates with a lunge, opposing side flashes/bounces
- Sprite theme: little-fighters uses a badminton-themed pixel-art roster; visible players render deterministic per-player sprites instead of one shared sprite per team
```

Also update the frontmatter date:

```yaml
last-updated: 2026-05-24
```

- [ ] **Step 2: Run the required project checks**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22
npm test
npm run lint
npm run build
node --check public/sw.js
```

Expected: all commands exit 0.

- [ ] **Step 3: Start the dev server for manual sprite verification**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm run dev -- --host 127.0.0.1 --port 4173
```

Expected: Vite serves the app at `http://127.0.0.1:4173/`.

- [ ] **Step 4: Verify the live little-fighters presentation**

In the browser, switch to `little-fighters` mode and confirm:

```text
- the old fighter-team art is gone
- the four visible players are distinct badminton athletes
- the racket silhouettes remain readable at tablet size
- the nameplates do not overlap the racket heads
- the attack lunge still looks natural with the new sprite proportions
```

- [ ] **Step 5: Stop the dev server**

Stop the running Vite process with `Ctrl-C`.

- [ ] **Step 6: Commit the doc update and any tiny fit correction**

If only the doc changed:

```bash
git add .docs/ui/ui-architecture.md
git commit -m "docs: document badminton fighter roster"
```

If manual verification required a small CSS adjustment, stage the CSS file too:

```bash
git add .docs/ui/ui-architecture.md src/styles.css
git commit -m "fix: tune badminton fighter sprite fit"
```
