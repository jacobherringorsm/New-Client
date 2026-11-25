# Neon Client UI Prototype

An original, standalone UI concept for a custom Eaglercraft 26.2 client. This prototype explores a dark neon visual theme, menu navigation, and a few client-side quality-of-life preferences.

## Run locally

Serve this directory with:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Launch a client you already have

Use the Eaglercraft downloads link in the UI to get a standalone 26.2 `.html` client build you are authorized to use. Back in the prototype, choose that HTML file and select **Launch 26.2 client**. The browser opens the selected local file in a separate tab; the file is not uploaded or copied into this repository. Only open client files from sources you trust, as HTML files can run browser scripts.

The local launcher only supports self-contained HTML builds. It does not load ZIP bundles, connect to multiplayer servers, or inject the prototype's menus into the game.

## Scope

This project is an original front-end prototype and local HTML launcher, not a modified or packaged Eaglercraft client. Its menu actions and preferences do not connect to gameplay. In-client integration requires a documented add-on interface and client source you are authorized to modify. This project does not include Eaglercraft or Minecraft source code, assets, or client binaries.
