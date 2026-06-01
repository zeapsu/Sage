# Legacy Component Cleanup Plan

> **Archive note (May 2026):** Preserved for reference. This docs branch does not remove application code. Verify imports and current product priorities before acting on any deletion plan.

## Finding: All 7 legacy components are ORPHANED

None of the legacy components are imported or used in `page.tsx` or anywhere else in the app. They're dead code from the pre-Ethereal architecture.

| Component | Imported Anywhere? | Notes |
|-----------|-------------------|-------|
| TomeList | ❌ No | Has real API CRUD (sage-api.ts) |
| KeywordSearch | ❌ No | Uses axios, old blue/white |
| SearchBar | ❌ No | Hardcoded gray-900/blue-600 |
| TableOfContents | ❌ No | Hardcoded text-white |
| Feed | ❌ No | Only imports Post (also unused) |
| Post | ❌ Only by Feed | Hardcoded gray-* cards |
| LoadingSpinner | ❌ No | Hardcoded blue-400 |

## Step 1: Merge TomeList API logic into TomeSelector

**What TomeList has that TomeSelector doesn't:**
- Real API integration: `listTomes()`, `createTome()`, `deleteTome()` from `sage-api.ts`
- State management: `useEffect` to fetch on mount, `useState` for tomes array
- Create Tome flow: inline form with name + description inputs
- Delete Tome: with confirmation via stopPropagation
- Loading state

**What TomeSelector has that TomeList doesn't:**
- Ethereal Console glassmorphic design (640px card, backdrop-blur, design tokens)
- Search/filter functionality
- Color-coded tome icons
- Active state indicator
- "New Tome" button (decorative — no onClick handler)

**Plan:** Add TomeList's API integration + create/delete functionality to TomeSelector, then delete TomeList.

## Step 2: Delete all 7 legacy component files

```
rm frontend/src/components/TomeList.tsx
rm frontend/src/components/KeywordSearch.tsx
rm frontend/src/components/SearchBar.tsx
rm frontend/src/components/TableOfContents.tsx
rm frontend/src/components/Feed.tsx
rm frontend/src/components/Post.tsx
rm frontend/src/components/LoadingSpinner.tsx
```

## Step 3: Verify no breakage

- Run `npm run build` to confirm no import errors
- Check `sage-api.ts` exports used by TomeList (listTomes, createTome, deleteTome) still exist
