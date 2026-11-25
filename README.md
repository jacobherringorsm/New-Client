# Neon Client UI Prototype

An original, standalone UI concept for a custom Eaglercraft 26.2 client. This prototype explores a dark neon visual theme, menu navigation, and a few client-side quality-of-life preferences.

## Run locally

Serve this directory with:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Public launcher URL

The public launcher is published through GitHub Pages at <https://jacobherringorsm.github.io/New-Client/>. Each push to `main` deploys the static site; the first deployment may take a few minutes.

## Install and launch

Use the Eaglercraft downloads link in the UI to get a standalone 26.2 `.html` client build you are authorized to use. Choose that HTML file or a ZIP containing exactly one HTML client once, then select **Launch 26.2 client**. The build is saved in this browser's IndexedDB and launches from the game view on later visits without selecting the archive again. It is not uploaded or copied into this repository. Only open client files from sources you trust, as HTML files can run browser scripts.

The launcher extracts ZIPs in your browser and supports stored or deflate-compressed HTML entries up to 128 MiB. The game view adds an original ClickGUI overlay, opened by **Right Shift** by default. Its current controls change the overlay appearance only; they do not modify game mechanics or connect to a client mod API. Multi-file bundles are not supported.

## Scope

This project is an original front-end, local client launcher, and visual overlay; it does not modify or package Eaglercraft. Gameplay features require a documented add-on interface and client source you are authorized to modify. This project does not include Eaglercraft or Minecraft source code, assets, or client binaries.
