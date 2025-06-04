# Diabrowser Campus Icon Scraper

This project scrapes all school icons from https://www.diabrowser.com/campuses and exports each SVG as a centered, properly scaled 512×512 PNG using Puppeteer. All icons are included in this repository.

## Contents

```
.
├── script.js       # Scraper and renderer combined
├── svgs/           # Raw inline SVGs extracted from each campus page
└── pngs/           # Final rendered 512x512 PNGs with transparency
```

## Usage

Make sure you have Node.js ≥ v18 installed.

Install dependencies:

```
npm install
```

Then run the script:

```
node script.js
```

It will:
1. Visit https://www.diabrowser.com/campuses
2. Follow each link (e.g. `/ucsd`, `/ucla`, etc.)
3. Extract the embedded inline SVG
4. Save the SVG to `svgs/`
5. Render each to a centered, transparent PNG in `pngs/` using Puppeteer with a consistent viewport and padding

Each icon is named by its campus slug, matching the URL (e.g. `ucsd.png`, `ucla.svg`).

## Output

- PNGs are 512×512 px with transparent backgrounds
- Each SVG is rendered centered with consistent padding
- Optimized for use in macOS Dock or launchers

## Notes

If any campus pages change structure, you may need to update the selector logic in `script.js`.
