# ryotaroportfolio

Static portfolio site.

## Structure

- `index.html`: page entry point
- `src/`: JavaScript and CSS source
- `public/assets/`: tracked images and icons used by the site
- `public/media/`: local videos used by the site

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run check
```

This runs the production build, CSS growth guard, route smoke tests, and the
30 MiB delivery limit for videos in `public/media/intro/`.
