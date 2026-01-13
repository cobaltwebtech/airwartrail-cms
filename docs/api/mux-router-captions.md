# Mux Router - Captions & Tracks

Caption and track management procedures.

## Quick Reference

- `mux.getVideoTracks` - Get all tracks for a video
- `mux.addCaption` - Add caption/subtitle track
- `mux.deleteCaption` - Delete a caption track
- `mux.generateCaptions` - Generate auto-captions using Whisper

## Supported Caption Languages

English, Spanish, Italian, Portuguese, German, French, Polish, Russian, Dutch, Catalan, Turkish, Swedish, Ukrainian, Norwegian, Finnish, Slovak, Greek, Czech, Croatian, Danish, Romanian, Bulgarian

## Example: Generate Auto-Captions

```typescript
await trpc.mux.generateCaptions.mutate({
  assetId: 'asset_123',
  libraryId: 'lib_abc',
  languageCode: 'en',
});
```

Refer to original documentation for complete schemas and all track types.
