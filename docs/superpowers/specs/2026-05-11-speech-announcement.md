# Speech Announcement Design

Date: 2026-05-11

## Goal

Produce TTS announcements that are natural to listen to courtside, with team letter names pronounced correctly and a word order that flows from subject to action to score.

## Announcement format

**Serving (mid-match):**
```
{team}, {player} serving, {serving score}-{receiving score}.
```
Example: `"Team Eh, Alice serving, 3-1."`

**Winner:**
```
Game. {team} wins, {winning score}-{losing score}.
```
Example: `"Game. Team Eh wins, 21-10."`

## Team name pronunciation

Single trailing uppercase letters in team names are replaced with phonetic spellings via the `LETTER_PRONUNCIATIONS` map before being passed to the TTS engine.

| Letter | Phonetic |
|--------|----------|
| A | Eh |
| B | Bee |

The regex `/ ([A-Z])$/` matches only a single trailing letter preceded by a space, so team names without a trailing letter are passed through unchanged.

### Why not a comma pause

An earlier approach inserted a comma: `"Team, A"`. The pause separated the words but most TTS engines still pronounced the isolated "A" as a schwa ("uh"). Replacing with "Eh" is more reliable because TTS engines respond to phonetic spelling directly.

## Why the format order matters

The original format was `"{team} serving, {player}, {score}."`. TTS reads "Team Eh serving" as a phrase before pausing for the player name, which sounds unnatural. The updated order `"{team}, {player} serving, {score}."` announces who first (team + player) then what (serving) then score, matching how a human umpire would call it.

## Testing

- Serving announcement matches `"{team}, {player} serving, {score}."` format.
- Winner announcement matches `"Game. {team} wins, {score}."` format.
- Team A → "Team Eh", Team B → "Team Bee" in both contexts.
