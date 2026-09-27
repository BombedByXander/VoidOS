# VoidOS

VoidOS is the installable PWA version of Xanders Arcade. The root page explains how to install it; the installed app opens directly to Games.

The app has three main tabs:

- **Games**
- **Apps**
- **Appearance**

VoidOS needs to be served over HTTPS by its Node/Vercel server so game and app launch routes, proxy service workers, and APIs work. A static GitHub Pages deployment is not sufficient.

## Install

1. Open the deployed VoidOS URL in a supported browser.
2. Choose **Install VoidOS** when the browser offers it.
3. On iPhone or iPad, use Safari’s **Share → Add to Home Screen**.
4. Launch VoidOS from the installed app icon. It opens in standalone mode at Games.

Games and apps still need an internet connection to load their remote content.
