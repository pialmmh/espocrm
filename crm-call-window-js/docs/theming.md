# Theming

The call panel has 5 preset themes. Only the **primary accent color set** swaps — semantic colors (red for decline, yellow for incoming, grays for chrome) stay constant across themes so status signals read the same regardless of host branding.

## Preset themes

| Preset | Primary | Primary-dark | Use case |
|---|---|---|---|
| `green` (default) | `#00A651` | `#065f46` | Matches the original BTCL SuiteCRM look |
| `blue` | `#3b82f6` | `#1e40af` | Neutral corporate |
| `gray` | `#6b7280` | `#1f2937` | Monochrome / subdued |
| `red` | `#dc2626` | `#7f1d1d` | Rare — primary already overlaps with the decline button; use with caution |
| `dark` | `#334155` | `#0f172a` | Dark-mode accent (background/text of the panel itself are still light; refinement TODO) |

### React

```tsx
<CallPanel theme="blue" />
```

### Angular

```html
<app-call theme="blue"></app-call>
```

### Vue

Currently ships composables only — pass the theme via the CSS class when you port the panel:

```vue
<div class="cc-root cc-theme-blue"> <!-- your Vue panel template --> </div>
```

---

## CSS variables

Each preset flips a set of `--cc-*` CSS variables. If you need a custom palette, override them on the panel root:

```css
/* React: target .cc-root */
.cc-root {
  --cc-primary: #ec4899;           /* your brand pink */
  --cc-primary-dark: #be185d;
  --cc-primary-rgb: 236, 72, 153;  /* used in pulse shadows */
  --cc-primary-soft: #fce7f3;      /* hover + active-call background */
  --cc-spinner: #f472b6;           /* connecting / registered indicators */
  --cc-badge-known-bg: #fce7f3;
  --cc-badge-known-color: #831843;
}

/* Angular: target :host under your preset */
app-call.cc-theme-green {
  --cc-primary: #ec4899;
  /* … */
}
```

Variables are scoped: React uses `.cc-root.cc-theme-*`, Angular uses `:host.cc-theme-*`. Both expose the same variable names.

---

## Dark-theme caveat

The `dark` preset currently only swaps the accent. The panel's own background, border, and text colors are still hardcoded as light hex values. True dark-mode support (`--cc-bg`, `--cc-fg`, `--cc-border` tokens) is an open TODO — the mechanical work is ~20-30 more variables.

---

## What *not* to override via variables

Semantic colors are intentionally not variablized:

- Red for decline / hangup — always `#dc3545`.
- Yellow for pending / connecting / incoming badge — always `#ffc107`.
- Chrome grays — the various `#dee2e6`, `#f8f9fa`, etc. used in the panel skeleton.

If you really need to change these, fork the CSS and ship your own. The intent is to keep urgency signals readable regardless of brand palette.
