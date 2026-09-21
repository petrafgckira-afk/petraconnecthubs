# `.htaccess` explained line by line

This documents [public/.htaccess](public/.htaccess). Vite copies it into `dist/` on every build, and Apache (cPanel) reads it from the folder the site is served from.

```apache
Options -MultiViews
DirectoryIndex index.html

<IfModule mod_rewrite.c>
  RewriteEngine On
  # Serve real files/folders as-is, fall back to index.html for everything else
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]
  RewriteRule ^ index.html [L]
</IfModule>

<IfModule mod_mime.c>
  AddType application/javascript .js .mjs
  AddType text/css .css
  AddType image/svg+xml .svg
  AddType video/mp4 .mp4
</IfModule>
```

---

## Part 1: General settings

### `Options -MultiViews`
Turns off Apache's "content negotiation" feature. With MultiViews on, a request for `/about` can silently match a file such as `about.html`. That can conflict with the rewrite rules below, so it is disabled. The `-` before the name means "turn this option off".

### `DirectoryIndex index.html`
Sets which file Apache serves when a URL points at a folder, for example `https://yourdomain.com/`. Here it serves `index.html`, the entry point of the React app.

---

## Part 2: Single-page-app fallback (`mod_rewrite`)

### `<IfModule mod_rewrite.c>` … `</IfModule>`
A safety wrapper. The lines inside run only if the server has the `mod_rewrite` module. If the module is missing, Apache skips the block instead of returning a 500 error.

### `RewriteEngine On`
Switches on the URL rewriting engine. Without it, none of the `Rewrite...` lines do anything.

### `# Serve real files/folders as-is, ...`
A comment. Apache ignores lines starting with `#`.

### `RewriteCond %{REQUEST_FILENAME} -f [OR]`
A condition attached to the next `RewriteRule`.
- `%{REQUEST_FILENAME}` is the path on disk that the requested URL maps to.
- `-f` is true when that path is an existing **file**.
- `[OR]` means this condition and the next one are alternatives, so either can be true.

### `RewriteCond %{REQUEST_FILENAME} -d`
The second condition. `-d` is true when the path is an existing **directory**.
Together, the two conditions read: "the request points to a real file **or** a real folder".

### `RewriteRule ^ - [L]`
Applies only when the conditions above are true.
- `^` is a pattern that matches every URL.
- `-` means "make no substitution", so the URL is left alone.
- `[L]` means "last rule": stop processing further rules.

Effect: real files such as `/assets/index-abc123.js`, `/assets/index-abc123.css` and `/petra-logo.svg` are served exactly as they are.

### `RewriteRule ^ index.html [L]`
The catch-all. It is reached only when the request did **not** match a real file or folder. Apache serves `index.html` instead of returning a 404.

Why this matters for a single-page app: if a user refreshes on a URL like `/dashboard`, no such file exists on the server. Without this rule they would get a 404. With it, `index.html` loads and React decides what to show.

Your app does not currently use URL-based routing (no react-router), so this rule is mostly a safety net.

---

## Part 3: File types (`mod_mime`)

### `<IfModule mod_mime.c>` … `</IfModule>`
Same safety-wrapper idea: run only if `mod_mime` is available.

### `AddType application/javascript .js .mjs`
Tells browsers that `.js` and `.mjs` files are JavaScript. Vite's build uses `<script type="module">`, and browsers refuse to run module scripts that are served with the wrong MIME type.

### `AddType text/css .css`
Serves CSS files as stylesheets. A wrong type can make the browser ignore the styles.

### `AddType image/svg+xml .svg`
Serves SVG files (the Petra logo, the flags) so that they render as images.

### `AddType video/mp4 .mp4`
Serves the `.mp4` videos in the build with the correct type so that they play.

---

## Summary

| Request | Result |
|---|---|
| Real file or folder (`/assets/...`, `/petra-logo.svg`) | Served normally |
| Anything else (`/dashboard`, `/anything`) | Falls back to `index.html` |
| `.js`, `.css`, `.svg`, `.mp4` | Sent with the correct file type |

If your host already sets these MIME types, the `AddType` lines are redundant but harmless.
