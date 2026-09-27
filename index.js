import express from "express";
import {
  createProxyMiddleware,
  responseInterceptor,
} from "http-proxy-middleware";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const app = express();
app.disable("x-powered-by");
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const staticPath = path.join(__dirname, "public");
const BRAND_LOGO_PATH = "/media/xandersarcade-logo.png";
const shellRefreshScriptPath = path.join(staticPath, "js", "shell-refresh-v2.js");
const appsJsonPath = path.join(staticPath, "json", "apps.json");
const gamesJsonPath = path.join(staticPath, "json", "games.json");
const gamesLocalJsonPath = path.join(staticPath, "json", "games-local.json");
const gamesCdnJsonPath = path.join(staticPath, "json", "games-cdn.json");
const goHtmlPath = path.join(staticPath, "html", "go.html");
const appManifestPath = path.join(staticPath, "app-manifest.json");
const appLauncherPath = path.join(staticPath, "app-launcher.html");
const appFramePath = path.join(staticPath, "html", "index.html");
const appServiceWorkerPath = path.join(staticPath, "app-sw.js");
const appInstallScriptPath = path.join(staticPath, "js", "app-install.js");
const freebuisnessHtmlMapPath = path.join(
  staticPath,
  "json",
  "freebuisness-html-map.json",
);
const target = process.env.UPSTREAM_URL || "https://lunaar.org";
const targetUrl = new URL(target);
const fallbackPath = path.join(staticPath, "html", "404.html");
const fallbackHtml = fs.existsSync(fallbackPath)
  ? fs.readFileSync(fallbackPath, "utf-8")
  : null;
const localTextCache = new Map();
const localBinaryCache = new Map();
const rewrittenAssetCache = new Map();
const storedCookies = new Map();
const upstreamHttpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 200,
  maxFreeSockets: 20,
});
const upstreamHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 200,
  maxFreeSockets: 20,
});
const upstreamAgent =
  targetUrl.protocol === "https:" ? upstreamHttpsAgent : upstreamHttpAgent;

function getLocalSourceFingerprint() {
  const entries = [__filename];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      const stat = fs.statSync(absolutePath);
      entries.push(`${absolutePath}:${stat.size}:${stat.mtimeMs}`);
    }
  };

  visit(staticPath);
  return crypto.createHash("sha1").update(entries.sort().join("|"), "utf8").digest("hex");
}

const PROXY_CLEANUP_STYLE =
  '<style data-xandersarcade-cleanup="true">.ad,.side-ad,.ad-info,.promo,.popup-ad,[class*=" ad-"],[class^="ad-"],[class*="promo"],[id*="promo"],ins[data-ad-client],ins[data-ad-slot],ins[data-ad-status],.toastify,.swal2-container,.swal2-backdrop-show{display:none!important;visibility:hidden!important;pointer-events:none!important;}.search-container{display:flex!important;align-items:center!important;gap:12px!important;overflow:hidden!important;border-radius:999px!important;padding:0 18px!important;min-height:50px!important;box-sizing:border-box!important;}.search-container form{display:flex!important;align-items:center!important;flex:1 1 auto!important;height:100%!important;min-width:0!important;}.search-container .search,.search-container input,.search-container #search-input{flex:1 1 auto!important;width:100%!important;height:100%!important;border:none!important;border-radius:999px!important;background:transparent!important;box-shadow:none!important;min-width:0!important;padding:0!important;margin:0!important;}.search-container i,#search-icon{display:flex!important;align-items:center!important;justify-content:center!important;flex:0 0 20px!important;width:20px!important;height:20px!important;margin:0!important;padding:0!important;line-height:1!important;}.search-container .search:focus,.search-container input:focus{outline:none!important;box-shadow:none!important;}</style>';
const HOME_GREETINGS = `[
  "Soixante Sept",
  "Bayerische Motoren Werke ist schlecht",
  "Hello!",
  "v10 is here!",
  "Freedom",
  "The Best",
  "Welcome to the best",
  "Welcome",
  "xandersarcade",
  "uhh",
  "5 nights at diddys mansion soon",
  "xandersarcade is my retaliation against tech who doubted me.",
  "u can never block me",
  "Happy 1 year anniversary!"
]`;
const LUCIDE_VERSION = "1.7.0";
const DISPLAY_VERSION = "10.0";
const DEPLOY_BUILD_ID = (
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.VERCEL_URL ||
  getLocalSourceFingerprint()
)
  .replace(/[^a-zA-Z0-9_-]/g, "")
  .slice(0, 20);
const ASSET_VERSION = `${DISPLAY_VERSION}-${DEPLOY_BUILD_ID || "local"}`;
const APP_MANIFEST_LINK = '<link rel="manifest" href="/app-manifest.json">';
const VOIDOS_ICON_PATH = "/media/xandersarcade-logo.png";
const APP_INSTALL_SCRIPT = `<script src="/js/app-install.js?v=${ASSET_VERSION}" data-xandersarcade-app-install="true"></script>`;
const NO_STORE_CACHE_CONTROL =
  "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const REWRITTEN_ASSET_CACHE_LIMIT = 32;
const REWRITTEN_ASSET_CACHE_TTL_MS = {
  javascript: 5 * 60 * 1000,
  css: 5 * 60 * 1000,
  json: 60 * 1000,
};
const DEFAULT_PROXY_BACKEND = "ultraviolet";
const DEFAULT_PROXY_TRANSPORT = "bare";
const DEFAULT_THEME = "nova";
const LEGACY_THEME_DEFAULT_MIGRATION_KEY = "xandersarcade-theme-default-v1";
const PREVIOUS_THEME_DEFAULT_MIGRATION_KEY = "xandersarcade-theme-default-v2";
const THEME_DEFAULT_MIGRATION_KEY = "xandersarcade-theme-default-v5";
const DEFAULTS_MIGRATION_KEY = "xandersarcade-defaults-version";
const DEFAULTS_MIGRATION_VALUE = "10.2.0";
const SHELL_CACHE_MIGRATION_KEY = "xandersarcade-shell-version";
const SHELL_HTML_ROUTES = new Set([
  "/",
  "/science",
  "/math",
  "/themes",
  "/admin",
  "/settings",
  "/more",
  "/forum",
  "/tos",
  "/new",
  "/go",
]);
const SERVICE_WORKER_ROUTES = new Set([
  "/sw.js",
  "/app-sw.js",
  "/sj/register-sw.js",
  "/uv/register-sw.js",
  "/uv/sw.js",
  "/uv/uv.sw.js",
]);
const SHELL_ROUTE_ALIASES = new Map([
  ["/science", "/html/games.html"],
  ["/math", "/html/apps.html"],
  ["/themes", "/html/themes.html"],
  ["/admin", "/html/admin.html"],
  ["/settings", "/html/settings.html"],
  ["/more", "/html/more.html"],
  ["/forum", "/html/forum.html"],
  ["/tos", "/html/tos.html"],
  ["/new", "/html/new.html"],
  ["/go", "/html/go.html"],
]);
const FIVE_NIGHTS_AT_EPSTEINS_NAME = "Five Nights at Epstein's";
const FIVE_NIGHTS_AT_EPSTEINS_URL = "https://fivenights.vercel.app/";
const EXTRA_THEME_OPTIONS_HTML =
  '<option value="nova">Nova (Default)</option><option value="flux">Flux</option><option value="rift">Rift</option><option value="echo">Echo</option><option value="drift">Drift</option><option value="coal">Coal</option><option value="mintx">Mint</option><option value="bloom">Bloom</option><option value="frostx">Frost</option><option value="duskx">Dusk</option><option value="voidpurple">Void Purple</option><option value="burgundy">RGB Grid</option><option value="anniversary">1 Year Anniversary</option><option value="tompearl">Tom Pearl</option>';
const ADDITIONAL_THEME_OPTIONS_HTML =
  '<option value="glassmorphism">Glassmorphism</option><option value="blueprint">Blueprint</option><option value="papertrail">Paper Trail</option><option value="synthgrid">Synth Grid</option><option value="neonnoir">Neon Noir</option><option value="biolume">Biolume</option><option value="desertnight">Desert Night</option><option value="moonlit">Moonlit</option><option value="copperforge">Copper Forge</option><option value="lavenderfog">Lavender Fog</option><option value="pixelwave">Pixelwave</option><option value="terminalrain">Terminal Rain</option><option value="auroraveil">Aurora Veil</option><option value="prism">Prism</option><option value="inkwash">Ink Wash</option><option value="velvet">Velvet</option><option value="citrus">Citrus Pop</option><option value="rosegalaxy">Rose Galaxy</option><option value="circuit">Circuit Board</option><option value="topaz">Topaz</option><option value="obsidian">Obsidian</option><option value="cloudnine">Cloud Nine</option><option value="mintglass">Mint Glass</option><option value="magma">Magma</option><option value="starforge">Star Forge</option><option value="oceanfloor">Ocean Floor</option><option value="hologram">Hologram</option><option value="arcade">Arcade Cabinet</option><option value="sakuradrift">Sakura Drift</option><option value="carbon">Carbon Fiber</option><option value="twilight">Twilight</option><option value="storm">Stormfront</option><option value="glacier">Glacier</option><option value="candyland">Candyland</option><option value="fractal">Fractal Bloom</option><option value="moss">Mossy Stone</option><option value="honeycomb">Honeycomb</option><option value="blacklight">Blacklight</option><option value="chrome">Chrome</option><option value="vapor">Vapor Trails</option><option value="deepviolet">Deep Violet</option><option value="firewatch">Firewatch</option><option value="seaglass">Sea Glass</option><option value="plum">Plum Wine</option><option value="sandstorm">Sandstorm</option><option value="electricblue">Electric Blue</option><option value="redshift">Redshift</option><option value="datawave">Datawave</option><option value="lunar">Lunar Surface</option><option value="koi">Koi Pond</option><option value="monochromegrid">Monochrome Grid</option><option value="parchment">Parchment</option><option value="iridescent">Iridescent</option><option value="acidrain">Acid Rain</option><option value="cosmos">Cosmos</option><option value="nightdrive">Night Drive</option><option value="aurorapink">Aurora Pink</option><option value="inkblue">Ink Blue</option><option value="goldenhour">Golden Hour</option><option value="thunder">Thunder</option>';
const EXPANDED_THEME_OPTIONS_HTML =
  '<option value="monsoon">Atmospheric — Monsoon</option><option value="rainshadow">Atmospheric — Rainshadow</option><option value="cloudbank">Atmospheric — Cloudbank</option><option value="bluehour">Atmospheric — Bluehour</option><option value="starlit">Atmospheric — Starlit</option><option value="frostmoon">Atmospheric — Frostmoon</option><option value="duskcloud">Atmospheric — Duskcloud</option><option value="nightmist">Atmospheric — Nightmist</option><option value="sunhalo">Atmospheric — Sunhalo</option><option value="overcast">Atmospheric — Overcast</option><option value="brass">Material — Brass</option><option value="bronze">Material — Bronze</option><option value="pewter">Material — Pewter</option><option value="silverleaf">Material — Silverleaf</option><option value="ironwood">Material — Ironwood</option><option value="marbled">Material — Marbled</option><option value="slate">Material — Slate</option><option value="alabaster">Material — Alabaster</option><option value="basalt">Material — Basalt</option><option value="terracotta">Material — Terracotta</option><option value="fern">Botanical — Fern</option><option value="pine">Botanical — Pine</option><option value="cedar">Botanical — Cedar</option><option value="wildflower">Botanical — Wildflower</option><option value="lavenderfield">Botanical — Lavenderfield</option><option value="meadow">Botanical — Meadow</option><option value="alpine">Botanical — Alpine</option><option value="riverstone">Botanical — Riverstone</option><option value="sequoia">Botanical — Sequoia</option><option value="eucalyptus">Botanical — Eucalyptus</option><option value="neonpulse">Neon — Neonpulse</option><option value="laserline">Neon — Laserline</option><option value="glowstick">Neon — Glowstick</option><option value="cyberglow">Neon — Cyberglow</option><option value="lasergrid">Neon — Lasergrid</option><option value="chroma">Neon — Chroma</option><option value="neonpetal">Neon — Neonpetal</option><option value="plasmawave">Neon — Plasmawave</option><option value="afterimage">Neon — Afterimage</option><option value="neonflare">Neon — Neonflare</option><option value="vhs">Retro — Vhs</option><option value="cassette">Retro — Cassette</option><option value="polaroid">Retro — Polaroid</option><option value="gameboy">Retro — Gameboy</option><option value="atari">Retro — Atari</option><option value="retrowave">Retro — Retrowave</option><option value="pixelparty">Retro — Pixelparty</option><option value="crt">Retro — Crt</option><option value="outrun">Retro — Outrun</option><option value="arcadefilm">Retro — Arcadefilm</option><option value="tessellate">Geometry — Tessellate</option><option value="kaleido">Geometry — Kaleido</option><option value="orbitals">Geometry — Orbitals</option><option value="triangulate">Geometry — Triangulate</option><option value="hexfield">Geometry — Hexfield</option><option value="circles">Geometry — Circles</option><option value="chevrons">Geometry — Chevrons</option><option value="isometric">Geometry — Isometric</option><option value="wireframe">Geometry — Wireframe</option><option value="diamondcut">Geometry — Diamondcut</option><option value="contours">Topographic — Contours</option><option value="elevation">Topographic — Elevation</option><option value="faultline">Topographic — Faultline</option><option value="terrain">Topographic — Terrain</option><option value="ridgewalk">Topographic — Ridgewalk</option><option value="canyon">Topographic — Canyon</option><option value="basin">Topographic — Basin</option><option value="summit">Topographic — Summit</option><option value="depthmap">Topographic — Depthmap</option><option value="geodesic">Topographic — Geodesic</option><option value="inkripple">Liquid — Inkripple</option><option value="oilspill">Liquid — Oilspill</option><option value="rainbowink">Liquid — Rainbowink</option><option value="mercury">Liquid — Mercury</option><option value="tidalglass">Liquid — Tidalglass</option><option value="bubblebath">Liquid — Bubblebath</option><option value="liquidgold">Liquid — Liquidgold</option><option value="seafluid">Liquid — Seafluid</option><option value="soapfilm">Liquid — Soapfilm</option><option value="chromedrip">Liquid — Chromedrip</option><option value="drafting">Blueprint — Drafting</option><option value="architect">Blueprint — Architect</option><option value="schematic">Blueprint — Schematic</option><option value="gridpaper">Blueprint — Gridpaper</option><option value="machinery">Blueprint — Machinery</option><option value="blueprintred">Blueprint — Blueprintred</option><option value="engineering">Blueprint — Engineering</option><option value="workshop">Blueprint — Workshop</option><option value="circuitplan">Blueprint — Circuitplan</option><option value="floorplan">Blueprint — Floorplan</option><option value="newsprint">Paper — Newsprint</option><option value="vellum">Paper — Vellum</option><option value="notebook">Paper — Notebook</option><option value="ledger">Paper — Ledger</option><option value="bluepaper">Paper — Bluepaper</option><option value="graphitepaper">Paper — Graphitepaper</option><option value="origami">Paper — Origami</option><option value="postcard">Paper — Postcard</option><option value="bookcloth">Paper — Bookcloth</option><option value="risograph">Paper — Risograph</option><option value="wildfire">Ember — Wildfire</option><option value="coalglow">Ember — Coalglow</option><option value="hearth">Ember — Hearth</option><option value="sparktrail">Ember — Sparktrail</option><option value="ashfall">Ember — Ashfall</option><option value="flareup">Ember — Flareup</option><option value="cinder">Ember — Cinder</option><option value="smokestack">Ember — Smokestack</option><option value="hotmetal">Ember — Hotmetal</option><option value="sunburn">Ember — Sunburn</option><option value="kelpforest">Ocean — Kelpforest</option><option value="deepcurrent">Ocean — Deepcurrent</option><option value="tidepool">Ocean — Tidepool</option><option value="seabed">Ocean — Seabed</option><option value="coralreef">Ocean — Coralreef</option><option value="saltwater">Ocean — Saltwater</option><option value="wavecrest">Ocean — Wavecrest</option><option value="shipwreck">Ocean — Shipwreck</option><option value="marineroom">Ocean — Marineroom</option><option value="undertow">Ocean — Undertow</option><option value="datastream">Matrix — Datastream</option><option value="codefall">Matrix — Codefall</option><option value="terminalgreen">Matrix — Terminalgreen</option><option value="signalnoise">Matrix — Signalnoise</option><option value="packet">Matrix — Packet</option><option value="mainframe">Matrix — Mainframe</option><option value="bitshift">Matrix — Bitshift</option><option value="greencode">Matrix — Greencode</option><option value="syntax">Matrix — Syntax</option><option value="serverroom">Matrix — Serverroom</option><option value="frostedglass">Glass — Frostedglass</option><option value="rainonglass">Glass — Rainonglass</option><option value="stainedglass">Glass — Stainedglass</option><option value="smokeglass">Glass — Smokeglass</option><option value="opalglass">Glass — Opalglass</option><option value="glasshouse">Glass — Glasshouse</option><option value="crystalroom">Glass — Crystalroom</option><option value="mirrorglow">Glass — Mirrorglow</option><option value="iceglass">Glass — Iceglass</option><option value="prismglass">Glass — Prismglass</option><option value="coralhour">Sunset — Coralhour</option><option value="peachsky">Sunset — Peachsky</option><option value="goldsky">Sunset — Goldsky</option><option value="violetdusk">Sunset — Violetdusk</option><option value="horizon">Sunset — Horizon</option><option value="afterglow">Sunset — Afterglow</option><option value="sundown">Sunset — Sundown</option><option value="twilightrose">Sunset — Twilightrose</option><option value="amberhaze">Sunset — Amberhaze</option><option value="lastlight">Sunset — Lastlight</option>';
const CLEAN_EXPANDED_THEME_OPTIONS_HTML = EXPANDED_THEME_OPTIONS_HTML.replace(/>[^<]+ — /g, ">");
const MASS_THEME_OPTIONS_HTML =
  '<option value="mistralveil1">Mistral Veil</option><option value="mistralmeridian2">Mistral Meridian</option><option value="mistralbloom3">Mistral Bloom</option><option value="mistralhush4">Mistral Hush</option><option value="mistralarc5">Mistral Arc</option><option value="mistraldrift6">Mistral Drift</option><option value="mistralhalo7">Mistral Halo</option><option value="mistralthread8">Mistral Thread</option><option value="mistralgarden9">Mistral Garden</option><option value="mistralridge10">Mistral Ridge</option><option value="mistralpulse11">Mistral Pulse</option><option value="mistralfield12">Mistral Field</option><option value="mistralecho13">Mistral Echo</option><option value="mistralloom14">Mistral Loom</option><option value="mistralcrest15">Mistral Crest</option><option value="mistralgrove16">Mistral Grove</option><option value="mistralcurrent17">Mistral Current</option><option value="mistralframe18">Mistral Frame</option><option value="mistralember19">Mistral Ember</option><option value="mistralatlas20">Mistral Atlas</option><option value="mistralspiral21">Mistral Spiral</option><option value="mistralhaze22">Mistral Haze</option><option value="mistralshard23">Mistral Shard</option><option value="mistralvista24">Mistral Vista</option><option value="mistralglow25">Mistral Glow</option><option value="copperveil1">Copper Veil</option><option value="coppermeridian2">Copper Meridian</option><option value="copperbloom3">Copper Bloom</option><option value="copperhush4">Copper Hush</option><option value="copperarc5">Copper Arc</option><option value="copperdrift6">Copper Drift</option><option value="copperhalo7">Copper Halo</option><option value="copperthread8">Copper Thread</option><option value="coppergarden9">Copper Garden</option><option value="copperridge10">Copper Ridge</option><option value="copperpulse11">Copper Pulse</option><option value="copperfield12">Copper Field</option><option value="copperecho13">Copper Echo</option><option value="copperloom14">Copper Loom</option><option value="coppercrest15">Copper Crest</option><option value="coppergrove16">Copper Grove</option><option value="coppercurrent17">Copper Current</option><option value="copperframe18">Copper Frame</option><option value="copperember19">Copper Ember</option><option value="copperatlas20">Copper Atlas</option><option value="copperspiral21">Copper Spiral</option><option value="copperhaze22">Copper Haze</option><option value="coppershard23">Copper Shard</option><option value="coppervista24">Copper Vista</option><option value="copperglow25">Copper Glow</option><option value="fernveil1">Fern Veil</option><option value="fernmeridian2">Fern Meridian</option><option value="fernbloom3">Fern Bloom</option><option value="fernhush4">Fern Hush</option><option value="fernarc5">Fern Arc</option><option value="ferndrift6">Fern Drift</option><option value="fernhalo7">Fern Halo</option><option value="fernthread8">Fern Thread</option><option value="ferngarden9">Fern Garden</option><option value="fernridge10">Fern Ridge</option><option value="fernpulse11">Fern Pulse</option><option value="fernfield12">Fern Field</option><option value="fernecho13">Fern Echo</option><option value="fernloom14">Fern Loom</option><option value="ferncrest15">Fern Crest</option><option value="ferngrove16">Fern Grove</option><option value="ferncurrent17">Fern Current</option><option value="fernframe18">Fern Frame</option><option value="fernember19">Fern Ember</option><option value="fernatlas20">Fern Atlas</option><option value="fernspiral21">Fern Spiral</option><option value="fernhaze22">Fern Haze</option><option value="fernshard23">Fern Shard</option><option value="fernvista24">Fern Vista</option><option value="fernglow25">Fern Glow</option><option value="laserveil1">Laser Veil</option><option value="lasermeridian2">Laser Meridian</option><option value="laserbloom3">Laser Bloom</option><option value="laserhush4">Laser Hush</option><option value="laserarc5">Laser Arc</option><option value="laserdrift6">Laser Drift</option><option value="laserhalo7">Laser Halo</option><option value="laserthread8">Laser Thread</option><option value="lasergarden9">Laser Garden</option><option value="laserridge10">Laser Ridge</option><option value="laserpulse11">Laser Pulse</option><option value="laserfield12">Laser Field</option><option value="laserecho13">Laser Echo</option><option value="laserloom14">Laser Loom</option><option value="lasercrest15">Laser Crest</option><option value="lasergrove16">Laser Grove</option><option value="lasercurrent17">Laser Current</option><option value="laserframe18">Laser Frame</option><option value="laserember19">Laser Ember</option><option value="laseratlas20">Laser Atlas</option><option value="laserspiral21">Laser Spiral</option><option value="laserhaze22">Laser Haze</option><option value="lasershard23">Laser Shard</option><option value="laservista24">Laser Vista</option><option value="laserglow25">Laser Glow</option><option value="vhsveil1">VHS Veil</option><option value="vhsmeridian2">VHS Meridian</option><option value="vhsbloom3">VHS Bloom</option><option value="vhshush4">VHS Hush</option><option value="vhsarc5">VHS Arc</option><option value="vhsdrift6">VHS Drift</option><option value="vhshalo7">VHS Halo</option><option value="vhsthread8">VHS Thread</option><option value="vhsgarden9">VHS Garden</option><option value="vhsridge10">VHS Ridge</option><option value="vhspulse11">VHS Pulse</option><option value="vhsfield12">VHS Field</option><option value="vhsecho13">VHS Echo</option><option value="vhsloom14">VHS Loom</option><option value="vhscrest15">VHS Crest</option><option value="vhsgrove16">VHS Grove</option><option value="vhscurrent17">VHS Current</option><option value="vhsframe18">VHS Frame</option><option value="vhsember19">VHS Ember</option><option value="vhsatlas20">VHS Atlas</option><option value="vhsspiral21">VHS Spiral</option><option value="vhshaze22">VHS Haze</option><option value="vhsshard23">VHS Shard</option><option value="vhsvista24">VHS Vista</option><option value="vhsglow25">VHS Glow</option><option value="orbitveil1">Orbit Veil</option><option value="orbitmeridian2">Orbit Meridian</option><option value="orbitbloom3">Orbit Bloom</option><option value="orbithush4">Orbit Hush</option><option value="orbitarc5">Orbit Arc</option><option value="orbitdrift6">Orbit Drift</option><option value="orbithalo7">Orbit Halo</option><option value="orbitthread8">Orbit Thread</option><option value="orbitgarden9">Orbit Garden</option><option value="orbitridge10">Orbit Ridge</option><option value="orbitpulse11">Orbit Pulse</option><option value="orbitfield12">Orbit Field</option><option value="orbitecho13">Orbit Echo</option><option value="orbitloom14">Orbit Loom</option><option value="orbitcrest15">Orbit Crest</option><option value="orbitgrove16">Orbit Grove</option><option value="orbitcurrent17">Orbit Current</option><option value="orbitframe18">Orbit Frame</option><option value="orbitember19">Orbit Ember</option><option value="orbitatlas20">Orbit Atlas</option><option value="orbitspiral21">Orbit Spiral</option><option value="orbithaze22">Orbit Haze</option><option value="orbitshard23">Orbit Shard</option><option value="orbitvista24">Orbit Vista</option><option value="orbitglow25">Orbit Glow</option><option value="contourveil1">Contour Veil</option><option value="contourmeridian2">Contour Meridian</option><option value="contourbloom3">Contour Bloom</option><option value="contourhush4">Contour Hush</option><option value="contourarc5">Contour Arc</option><option value="contourdrift6">Contour Drift</option><option value="contourhalo7">Contour Halo</option><option value="contourthread8">Contour Thread</option><option value="contourgarden9">Contour Garden</option><option value="contourridge10">Contour Ridge</option><option value="contourpulse11">Contour Pulse</option><option value="contourfield12">Contour Field</option><option value="contourecho13">Contour Echo</option><option value="contourloom14">Contour Loom</option><option value="contourcrest15">Contour Crest</option><option value="contourgrove16">Contour Grove</option><option value="contourcurrent17">Contour Current</option><option value="contourframe18">Contour Frame</option><option value="contourember19">Contour Ember</option><option value="contouratlas20">Contour Atlas</option><option value="contourspiral21">Contour Spiral</option><option value="contourhaze22">Contour Haze</option><option value="contourshard23">Contour Shard</option><option value="contourvista24">Contour Vista</option><option value="contourglow25">Contour Glow</option><option value="rippleveil1">Ripple Veil</option><option value="ripplemeridian2">Ripple Meridian</option><option value="ripplebloom3">Ripple Bloom</option><option value="ripplehush4">Ripple Hush</option><option value="ripplearc5">Ripple Arc</option><option value="rippledrift6">Ripple Drift</option><option value="ripplehalo7">Ripple Halo</option><option value="ripplethread8">Ripple Thread</option><option value="ripplegarden9">Ripple Garden</option><option value="rippleridge10">Ripple Ridge</option><option value="ripplepulse11">Ripple Pulse</option><option value="ripplefield12">Ripple Field</option><option value="rippleecho13">Ripple Echo</option><option value="rippleloom14">Ripple Loom</option><option value="ripplecrest15">Ripple Crest</option><option value="ripplegrove16">Ripple Grove</option><option value="ripplecurrent17">Ripple Current</option><option value="rippleframe18">Ripple Frame</option><option value="rippleember19">Ripple Ember</option><option value="rippleatlas20">Ripple Atlas</option><option value="ripplespiral21">Ripple Spiral</option><option value="ripplehaze22">Ripple Haze</option><option value="rippleshard23">Ripple Shard</option><option value="ripplevista24">Ripple Vista</option><option value="rippleglow25">Ripple Glow</option><option value="draftveil1">Draft Veil</option><option value="draftmeridian2">Draft Meridian</option><option value="draftbloom3">Draft Bloom</option><option value="drafthush4">Draft Hush</option><option value="draftarc5">Draft Arc</option><option value="draftdrift6">Draft Drift</option><option value="drafthalo7">Draft Halo</option><option value="draftthread8">Draft Thread</option><option value="draftgarden9">Draft Garden</option><option value="draftridge10">Draft Ridge</option><option value="draftpulse11">Draft Pulse</option><option value="draftfield12">Draft Field</option><option value="draftecho13">Draft Echo</option><option value="draftloom14">Draft Loom</option><option value="draftcrest15">Draft Crest</option><option value="draftgrove16">Draft Grove</option><option value="draftcurrent17">Draft Current</option><option value="draftframe18">Draft Frame</option><option value="draftember19">Draft Ember</option><option value="draftatlas20">Draft Atlas</option><option value="draftspiral21">Draft Spiral</option><option value="drafthaze22">Draft Haze</option><option value="draftshard23">Draft Shard</option><option value="draftvista24">Draft Vista</option><option value="draftglow25">Draft Glow</option><option value="vellumveil1">Vellum Veil</option><option value="vellummeridian2">Vellum Meridian</option><option value="vellumbloom3">Vellum Bloom</option><option value="vellumhush4">Vellum Hush</option><option value="vellumarc5">Vellum Arc</option><option value="vellumdrift6">Vellum Drift</option><option value="vellumhalo7">Vellum Halo</option><option value="vellumthread8">Vellum Thread</option><option value="vellumgarden9">Vellum Garden</option><option value="vellumridge10">Vellum Ridge</option><option value="vellumpulse11">Vellum Pulse</option><option value="vellumfield12">Vellum Field</option><option value="vellumecho13">Vellum Echo</option><option value="vellumloom14">Vellum Loom</option><option value="vellumcrest15">Vellum Crest</option><option value="vellumgrove16">Vellum Grove</option><option value="vellumcurrent17">Vellum Current</option><option value="vellumframe18">Vellum Frame</option><option value="vellumember19">Vellum Ember</option><option value="vellumatlas20">Vellum Atlas</option><option value="vellumspiral21">Vellum Spiral</option><option value="vellumhaze22">Vellum Haze</option><option value="vellumshard23">Vellum Shard</option><option value="vellumvista24">Vellum Vista</option><option value="vellumglow25">Vellum Glow</option><option value="cinderveil1">Cinder Veil</option><option value="cindermeridian2">Cinder Meridian</option><option value="cinderbloom3">Cinder Bloom</option><option value="cinderhush4">Cinder Hush</option><option value="cinderarc5">Cinder Arc</option><option value="cinderdrift6">Cinder Drift</option><option value="cinderhalo7">Cinder Halo</option><option value="cinderthread8">Cinder Thread</option><option value="cindergarden9">Cinder Garden</option><option value="cinderridge10">Cinder Ridge</option><option value="cinderpulse11">Cinder Pulse</option><option value="cinderfield12">Cinder Field</option><option value="cinderecho13">Cinder Echo</option><option value="cinderloom14">Cinder Loom</option><option value="cindercrest15">Cinder Crest</option><option value="cindergrove16">Cinder Grove</option><option value="cindercurrent17">Cinder Current</option><option value="cinderframe18">Cinder Frame</option><option value="cinderember19">Cinder Ember</option><option value="cinderatlas20">Cinder Atlas</option><option value="cinderspiral21">Cinder Spiral</option><option value="cinderhaze22">Cinder Haze</option><option value="cindershard23">Cinder Shard</option><option value="cindervista24">Cinder Vista</option><option value="cinderglow25">Cinder Glow</option><option value="tideveil1">Tide Veil</option><option value="tidemeridian2">Tide Meridian</option><option value="tidebloom3">Tide Bloom</option><option value="tidehush4">Tide Hush</option><option value="tidearc5">Tide Arc</option><option value="tidedrift6">Tide Drift</option><option value="tidehalo7">Tide Halo</option><option value="tidethread8">Tide Thread</option><option value="tidegarden9">Tide Garden</option><option value="tideridge10">Tide Ridge</option><option value="tidepulse11">Tide Pulse</option><option value="tidefield12">Tide Field</option><option value="tideecho13">Tide Echo</option><option value="tideloom14">Tide Loom</option><option value="tidecrest15">Tide Crest</option><option value="tidegrove16">Tide Grove</option><option value="tidecurrent17">Tide Current</option><option value="tideframe18">Tide Frame</option><option value="tideember19">Tide Ember</option><option value="tideatlas20">Tide Atlas</option><option value="tidespiral21">Tide Spiral</option><option value="tidehaze22">Tide Haze</option><option value="tideshard23">Tide Shard</option><option value="tidevista24">Tide Vista</option><option value="tideglow25">Tide Glow</option><option value="packetveil1">Packet Veil</option><option value="packetmeridian2">Packet Meridian</option><option value="packetbloom3">Packet Bloom</option><option value="packethush4">Packet Hush</option><option value="packetarc5">Packet Arc</option><option value="packetdrift6">Packet Drift</option><option value="packethalo7">Packet Halo</option><option value="packetthread8">Packet Thread</option><option value="packetgarden9">Packet Garden</option><option value="packetridge10">Packet Ridge</option><option value="packetpulse11">Packet Pulse</option><option value="packetfield12">Packet Field</option><option value="packetecho13">Packet Echo</option><option value="packetloom14">Packet Loom</option><option value="packetcrest15">Packet Crest</option><option value="packetgrove16">Packet Grove</option><option value="packetcurrent17">Packet Current</option><option value="packetframe18">Packet Frame</option><option value="packetember19">Packet Ember</option><option value="packetatlas20">Packet Atlas</option><option value="packetspiral21">Packet Spiral</option><option value="packethaze22">Packet Haze</option><option value="packetshard23">Packet Shard</option><option value="packetvista24">Packet Vista</option><option value="packetglow25">Packet Glow</option><option value="opalveil1">Opal Veil</option><option value="opalmeridian2">Opal Meridian</option><option value="opalbloom3">Opal Bloom</option><option value="opalhush4">Opal Hush</option><option value="opalarc5">Opal Arc</option><option value="opaldrift6">Opal Drift</option><option value="opalhalo7">Opal Halo</option><option value="opalthread8">Opal Thread</option><option value="opalgarden9">Opal Garden</option><option value="opalridge10">Opal Ridge</option><option value="opalpulse11">Opal Pulse</option><option value="opalfield12">Opal Field</option><option value="opalecho13">Opal Echo</option><option value="opalloom14">Opal Loom</option><option value="opalcrest15">Opal Crest</option><option value="opalgrove16">Opal Grove</option><option value="opalcurrent17">Opal Current</option><option value="opalframe18">Opal Frame</option><option value="opalember19">Opal Ember</option><option value="opalatlas20">Opal Atlas</option><option value="opalspiral21">Opal Spiral</option><option value="opalhaze22">Opal Haze</option><option value="opalshard23">Opal Shard</option><option value="opalvista24">Opal Vista</option><option value="opalglow25">Opal Glow</option><option value="sundownveil1">Sundown Veil</option><option value="sundownmeridian2">Sundown Meridian</option><option value="sundownbloom3">Sundown Bloom</option><option value="sundownhush4">Sundown Hush</option><option value="sundownarc5">Sundown Arc</option><option value="sundowndrift6">Sundown Drift</option><option value="sundownhalo7">Sundown Halo</option><option value="sundownthread8">Sundown Thread</option><option value="sundowngarden9">Sundown Garden</option><option value="sundownridge10">Sundown Ridge</option><option value="sundownpulse11">Sundown Pulse</option><option value="sundownfield12">Sundown Field</option><option value="sundownecho13">Sundown Echo</option><option value="sundownloom14">Sundown Loom</option><option value="sundowncrest15">Sundown Crest</option><option value="sundowngrove16">Sundown Grove</option><option value="sundowncurrent17">Sundown Current</option><option value="sundownframe18">Sundown Frame</option><option value="sundownember19">Sundown Ember</option><option value="sundownatlas20">Sundown Atlas</option><option value="sundownspiral21">Sundown Spiral</option><option value="sundownhaze22">Sundown Haze</option><option value="sundownshard23">Sundown Shard</option><option value="sundownvista24">Sundown Vista</option><option value="sundownglow25">Sundown Glow</option><option value="mirageveil1">Mirage Veil</option><option value="miragemeridian2">Mirage Meridian</option><option value="miragebloom3">Mirage Bloom</option><option value="miragehush4">Mirage Hush</option><option value="miragearc5">Mirage Arc</option><option value="miragedrift6">Mirage Drift</option><option value="miragehalo7">Mirage Halo</option><option value="miragethread8">Mirage Thread</option><option value="miragegarden9">Mirage Garden</option><option value="mirageridge10">Mirage Ridge</option><option value="miragepulse11">Mirage Pulse</option><option value="miragefield12">Mirage Field</option><option value="mirageecho13">Mirage Echo</option><option value="mirageloom14">Mirage Loom</option><option value="miragecrest15">Mirage Crest</option><option value="miragegrove16">Mirage Grove</option><option value="miragecurrent17">Mirage Current</option><option value="mirageframe18">Mirage Frame</option><option value="mirageember19">Mirage Ember</option><option value="mirageatlas20">Mirage Atlas</option><option value="miragespiral21">Mirage Spiral</option><option value="miragehaze22">Mirage Haze</option><option value="mirageshard23">Mirage Shard</option><option value="miragevista24">Mirage Vista</option><option value="mirageglow25">Mirage Glow</option><option value="quartzveil1">Quartz Veil</option><option value="quartzmeridian2">Quartz Meridian</option><option value="quartzbloom3">Quartz Bloom</option><option value="quartzhush4">Quartz Hush</option><option value="quartzarc5">Quartz Arc</option><option value="quartzdrift6">Quartz Drift</option><option value="quartzhalo7">Quartz Halo</option><option value="quartzthread8">Quartz Thread</option><option value="quartzgarden9">Quartz Garden</option><option value="quartzridge10">Quartz Ridge</option><option value="quartzpulse11">Quartz Pulse</option><option value="quartzfield12">Quartz Field</option><option value="quartzecho13">Quartz Echo</option><option value="quartzloom14">Quartz Loom</option><option value="quartzcrest15">Quartz Crest</option><option value="quartzgrove16">Quartz Grove</option><option value="quartzcurrent17">Quartz Current</option><option value="quartzframe18">Quartz Frame</option><option value="quartzember19">Quartz Ember</option><option value="quartzatlas20">Quartz Atlas</option><option value="quartzspiral21">Quartz Spiral</option><option value="quartzhaze22">Quartz Haze</option><option value="quartzshard23">Quartz Shard</option><option value="quartzvista24">Quartz Vista</option><option value="quartzglow25">Quartz Glow</option><option value="nimbusveil1">Nimbus Veil</option><option value="nimbusmeridian2">Nimbus Meridian</option><option value="nimbusbloom3">Nimbus Bloom</option><option value="nimbushush4">Nimbus Hush</option><option value="nimbusarc5">Nimbus Arc</option><option value="nimbusdrift6">Nimbus Drift</option><option value="nimbushalo7">Nimbus Halo</option><option value="nimbusthread8">Nimbus Thread</option><option value="nimbusgarden9">Nimbus Garden</option><option value="nimbusridge10">Nimbus Ridge</option><option value="nimbuspulse11">Nimbus Pulse</option><option value="nimbusfield12">Nimbus Field</option><option value="nimbusecho13">Nimbus Echo</option><option value="nimbusloom14">Nimbus Loom</option><option value="nimbuscrest15">Nimbus Crest</option><option value="nimbusgrove16">Nimbus Grove</option><option value="nimbuscurrent17">Nimbus Current</option><option value="nimbusframe18">Nimbus Frame</option><option value="nimbusember19">Nimbus Ember</option><option value="nimbusatlas20">Nimbus Atlas</option><option value="nimbusspiral21">Nimbus Spiral</option><option value="nimbushaze22">Nimbus Haze</option><option value="nimbusshard23">Nimbus Shard</option><option value="nimbusvista24">Nimbus Vista</option><option value="nimbusglow25">Nimbus Glow</option><option value="signalveil1">Signal Veil</option><option value="signalmeridian2">Signal Meridian</option><option value="signalbloom3">Signal Bloom</option><option value="signalhush4">Signal Hush</option><option value="signalarc5">Signal Arc</option><option value="signaldrift6">Signal Drift</option><option value="signalhalo7">Signal Halo</option><option value="signalthread8">Signal Thread</option><option value="signalgarden9">Signal Garden</option><option value="signalridge10">Signal Ridge</option><option value="signalpulse11">Signal Pulse</option><option value="signalfield12">Signal Field</option><option value="signalecho13">Signal Echo</option><option value="signalloom14">Signal Loom</option><option value="signalcrest15">Signal Crest</option><option value="signalgrove16">Signal Grove</option><option value="signalcurrent17">Signal Current</option><option value="signalframe18">Signal Frame</option><option value="signalember19">Signal Ember</option><option value="signalatlas20">Signal Atlas</option><option value="signalspiral21">Signal Spiral</option><option value="signalhaze22">Signal Haze</option><option value="signalshard23">Signal Shard</option><option value="signalvista24">Signal Vista</option><option value="signalglow25">Signal Glow</option>';
const REQUIRED_THEME_OPTIONS = [
  ['nova', 'Nova (Default)'],
  ['flux', 'Flux'],
  ['space', 'Space OLED'],
  ['ocean', 'Jellyfish'],
  ['volcanic', 'Volcanic Eclipse'],
  ['forest', 'Haunted Forest'],
  ['campfire', 'Campfire Glow'],
  ['hacker', 'Hacker'],
  ['v8dark', 'V8 Dark'],
  ['midnightoled', 'VSCode'],
  ['rift', 'Rift'],
  ['echo', 'Echo'],
  ['drift', 'Drift'],
  ['coal', 'Coal'],
  ['mintx', 'Mint'],
  ['bloom', 'Bloom'],
  ['frostx', 'Frost'],
  ['duskx', 'Dusk'],
  ['voidpurple', 'Void Purple'],
  ['burgundy', 'RGB Grid'],
  ['anniversary', '1 Year Anniversary'],
  ['tompearl', 'Tom Pearl'],
  ['v8light', 'V8 Light'],
  ['aurora', 'Aurora'],
  ['cyberpunk', 'Cyberpunk'],
  ['ember', 'Ember'],
  ['lavender', 'Lavender'],
  ['sapphire', 'Sapphire'],
  ['rosewood', 'Rosewood'],
  ['emerald', 'Emerald'],
  ['solar', 'Solar Flare'],
  ['nebula', 'Nebula'],
  ['midnight', 'Midnight'],
  ['synthwave', 'Synthwave'],
  ['terminal', 'Terminal'],
  ['paper', 'Paper'],
  ['coffee', 'Coffee'],
  ['sakura', 'Sakura'],
  ['arctic', 'Arctic'],
  ['desert', 'Desert'],
  ['toxic', 'Toxic'],
  ['oceanic', 'Oceanic'],
  ['monochrome', 'Monochrome'],
  ['plasma', 'Plasma'],
  ['sunset', 'Sunset'],
  ['rainforest', 'Rainforest'],
  ['royal', 'Royal'],
  ['copper', 'Copper'],
  ['grape', 'Grape'],
  ['icefire', 'Icefire'],
  ['matrix', 'Matrix'],
  ['candy', 'Candy'],
  ['graphite', 'Graphite'],
  ['neonlime', 'Neon Lime'],
  ['deepsea', 'Deep Sea'],
  ['cosmic', 'Cosmic'],
  ['ultraviolet', 'Ultraviolet'],
  ['watermelon', 'Watermelon'],
  ['glassmorphism', 'Glassmorphism'],
  ['blueprint', 'Blueprint'],
  ['papertrail', 'Paper Trail'],
  ['synthgrid', 'Synth Grid'],
  ['neonnoir', 'Neon Noir'],
  ['biolume', 'Biolume'],
  ['desertnight', 'Desert Night'],
  ['moonlit', 'Moonlit'],
  ['copperforge', 'Copper Forge'],
  ['lavenderfog', 'Lavender Fog'],
  ['pixelwave', 'Pixelwave'],
  ['terminalrain', 'Terminal Rain'],
  ['auroraveil', 'Aurora Veil'],
  ['prism', 'Prism'],
  ['inkwash', 'Ink Wash'],
  ['velvet', 'Velvet'],
  ['citrus', 'Citrus Pop'],
  ['rosegalaxy', 'Rose Galaxy'],
  ['circuit', 'Circuit Board'],
  ['topaz', 'Topaz'],
  ['obsidian', 'Obsidian'],
  ['cloudnine', 'Cloud Nine'],
  ['mintglass', 'Mint Glass'],
  ['magma', 'Magma'],
  ['starforge', 'Star Forge'],
  ['oceanfloor', 'Ocean Floor'],
  ['hologram', 'Hologram'],
  ['arcade', 'Arcade Cabinet'],
  ['sakuradrift', 'Sakura Drift'],
  ['carbon', 'Carbon Fiber'],
  ['twilight', 'Twilight'],
  ['storm', 'Stormfront'],
  ['glacier', 'Glacier'],
  ['candyland', 'Candyland'],
  ['fractal', 'Fractal Bloom'],
  ['moss', 'Mossy Stone'],
  ['honeycomb', 'Honeycomb'],
  ['blacklight', 'Blacklight'],
  ['chrome', 'Chrome'],
  ['vapor', 'Vapor Trails'],
  ['deepviolet', 'Deep Violet'],
  ['firewatch', 'Firewatch'],
  ['seaglass', 'Sea Glass'],
  ['plum', 'Plum Wine'],
  ['sandstorm', 'Sandstorm'],
  ['electricblue', 'Electric Blue'],
  ['redshift', 'Redshift'],
  ['datawave', 'Datawave'],
  ['lunar', 'Lunar Surface'],
  ['koi', 'Koi Pond'],
  ['monochromegrid', 'Monochrome Grid'],
  ['parchment', 'Parchment'],
  ['iridescent', 'Iridescent'],
  ['acidrain', 'Acid Rain'],
  ['cosmos', 'Cosmos'],
  ['nightdrive', 'Night Drive'],
  ['aurorapink', 'Aurora Pink'],
  ['inkblue', 'Ink Blue'],
  ['goldenhour', 'Golden Hour'],
  ['thunder', 'Thunder'],
  ['monsoon', 'Monsoon'],
  ['rainshadow', 'Rainshadow'],
  ['cloudbank', 'Cloudbank'],
  ['bluehour', 'Bluehour'],
  ['starlit', 'Starlit'],
  ['frostmoon', 'Frostmoon'],
  ['duskcloud', 'Duskcloud'],
  ['nightmist', 'Nightmist'],
  ['sunhalo', 'Sunhalo'],
  ['overcast', 'Overcast'],
  ['brass', 'Brass'],
  ['bronze', 'Bronze'],
  ['pewter', 'Pewter'],
  ['silverleaf', 'Silverleaf'],
  ['ironwood', 'Ironwood'],
  ['marbled', 'Marbled'],
  ['slate', 'Slate'],
  ['alabaster', 'Alabaster'],
  ['basalt', 'Basalt'],
  ['terracotta', 'Terracotta'],
  ['fern', 'Fern'],
  ['pine', 'Pine'],
  ['cedar', 'Cedar'],
  ['wildflower', 'Wildflower'],
  ['lavenderfield', 'Lavenderfield'],
  ['meadow', 'Meadow'],
  ['alpine', 'Alpine'],
  ['riverstone', 'Riverstone'],
  ['sequoia', 'Sequoia'],
  ['eucalyptus', 'Eucalyptus'],
  ['neonpulse', 'Neonpulse'],
  ['laserline', 'Laserline'],
  ['glowstick', 'Glowstick'],
  ['cyberglow', 'Cyberglow'],
  ['lasergrid', 'Lasergrid'],
  ['chroma', 'Chroma'],
  ['neonpetal', 'Neonpetal'],
  ['plasmawave', 'Plasmawave'],
  ['afterimage', 'Afterimage'],
  ['neonflare', 'Neonflare'],
  ['vhs', 'Vhs'],
  ['cassette', 'Cassette'],
  ['polaroid', 'Polaroid'],
  ['gameboy', 'Gameboy'],
  ['atari', 'Atari'],
  ['retrowave', 'Retrowave'],
  ['pixelparty', 'Pixelparty'],
  ['crt', 'Crt'],
  ['outrun', 'Outrun'],
  ['arcadefilm', 'Arcadefilm'],
  ['tessellate', 'Tessellate'],
  ['kaleido', 'Kaleido'],
  ['orbitals', 'Orbitals'],
  ['triangulate', 'Triangulate'],
  ['hexfield', 'Hexfield'],
  ['circles', 'Circles'],
  ['chevrons', 'Chevrons'],
  ['isometric', 'Isometric'],
  ['wireframe', 'Wireframe'],
  ['diamondcut', 'Diamondcut'],
  ['contours', 'Contours'],
  ['elevation', 'Elevation'],
  ['faultline', 'Faultline'],
  ['terrain', 'Terrain'],
  ['ridgewalk', 'Ridgewalk'],
  ['canyon', 'Canyon'],
  ['basin', 'Basin'],
  ['summit', 'Summit'],
  ['depthmap', 'Depthmap'],
  ['geodesic', 'Geodesic'],
  ['inkripple', 'Inkripple'],
  ['oilspill', 'Oilspill'],
  ['rainbowink', 'Rainbowink'],
  ['mercury', 'Mercury'],
  ['tidalglass', 'Tidalglass'],
  ['bubblebath', 'Bubblebath'],
  ['liquidgold', 'Liquidgold'],
  ['seafluid', 'Seafluid'],
  ['soapfilm', 'Soapfilm'],
  ['chromedrip', 'Chromedrip'],
  ['drafting', 'Drafting'],
  ['architect', 'Architect'],
  ['schematic', 'Schematic'],
  ['gridpaper', 'Gridpaper'],
  ['machinery', 'Machinery'],
  ['blueprintred', 'Blueprintred'],
  ['engineering', 'Engineering'],
  ['workshop', 'Workshop'],
  ['circuitplan', 'Circuitplan'],
  ['floorplan', 'Floorplan'],
  ['newsprint', 'Newsprint'],
  ['vellum', 'Vellum'],
  ['notebook', 'Notebook'],
  ['ledger', 'Ledger'],
  ['bluepaper', 'Bluepaper'],
  ['graphitepaper', 'Graphitepaper'],
  ['origami', 'Origami'],
  ['postcard', 'Postcard'],
  ['bookcloth', 'Bookcloth'],
  ['risograph', 'Risograph'],
  ['wildfire', 'Wildfire'],
  ['coalglow', 'Coalglow'],
  ['hearth', 'Hearth'],
  ['sparktrail', 'Sparktrail'],
  ['ashfall', 'Ashfall'],
  ['flareup', 'Flareup'],
  ['cinder', 'Cinder'],
  ['smokestack', 'Smokestack'],
  ['hotmetal', 'Hotmetal'],
  ['sunburn', 'Sunburn'],
  ['kelpforest', 'Kelpforest'],
  ['deepcurrent', 'Deepcurrent'],
  ['tidepool', 'Tidepool'],
  ['seabed', 'Seabed'],
  ['coralreef', 'Coralreef'],
  ['saltwater', 'Saltwater'],
  ['wavecrest', 'Wavecrest'],
  ['shipwreck', 'Shipwreck'],
  ['marineroom', 'Marineroom'],
  ['undertow', 'Undertow'],
  ['datastream', 'Datastream'],
  ['codefall', 'Codefall'],
  ['terminalgreen', 'Terminalgreen'],
  ['signalnoise', 'Signalnoise'],
  ['packet', 'Packet'],
  ['mainframe', 'Mainframe'],
  ['bitshift', 'Bitshift'],
  ['greencode', 'Greencode'],
  ['syntax', 'Syntax'],
  ['serverroom', 'Serverroom'],
  ['frostedglass', 'Frostedglass'],
  ['rainonglass', 'Rainonglass'],
  ['stainedglass', 'Stainedglass'],
  ['smokeglass', 'Smokeglass'],
  ['opalglass', 'Opalglass'],
  ['glasshouse', 'Glasshouse'],
  ['crystalroom', 'Crystalroom'],
  ['mirrorglow', 'Mirrorglow'],
  ['iceglass', 'Iceglass'],
  ['prismglass', 'Prismglass'],
  ['coralhour', 'Coralhour'],
  ['peachsky', 'Peachsky'],
  ['goldsky', 'Goldsky'],
  ['violetdusk', 'Violetdusk'],
  ['horizon', 'Horizon'],
  ['afterglow', 'Afterglow'],
  ['sundown', 'Sundown'],
  ['twilightrose', 'Twilightrose'],
  ['amberhaze', 'Amberhaze'],
  ['lastlight', 'Lastlight'],
  ['mistralveil1', 'Mistral Veil'],
  ['mistralmeridian2', 'Mistral Meridian'],
  ['mistralbloom3', 'Mistral Bloom'],
  ['mistralhush4', 'Mistral Hush'],
  ['mistralarc5', 'Mistral Arc'],
  ['mistraldrift6', 'Mistral Drift'],
  ['mistralhalo7', 'Mistral Halo'],
  ['mistralthread8', 'Mistral Thread'],
  ['mistralgarden9', 'Mistral Garden'],
  ['mistralridge10', 'Mistral Ridge'],
  ['mistralpulse11', 'Mistral Pulse'],
  ['mistralfield12', 'Mistral Field'],
  ['mistralecho13', 'Mistral Echo'],
  ['mistralloom14', 'Mistral Loom'],
  ['mistralcrest15', 'Mistral Crest'],
  ['mistralgrove16', 'Mistral Grove'],
  ['mistralcurrent17', 'Mistral Current'],
  ['mistralframe18', 'Mistral Frame'],
  ['mistralember19', 'Mistral Ember'],
  ['mistralatlas20', 'Mistral Atlas'],
  ['mistralspiral21', 'Mistral Spiral'],
  ['mistralhaze22', 'Mistral Haze'],
  ['mistralshard23', 'Mistral Shard'],
  ['mistralvista24', 'Mistral Vista'],
  ['mistralglow25', 'Mistral Glow'],
  ['copperveil1', 'Copper Veil'],
  ['coppermeridian2', 'Copper Meridian'],
  ['copperbloom3', 'Copper Bloom'],
  ['copperhush4', 'Copper Hush'],
  ['copperarc5', 'Copper Arc'],
  ['copperdrift6', 'Copper Drift'],
  ['copperhalo7', 'Copper Halo'],
  ['copperthread8', 'Copper Thread'],
  ['coppergarden9', 'Copper Garden'],
  ['copperridge10', 'Copper Ridge'],
  ['copperpulse11', 'Copper Pulse'],
  ['copperfield12', 'Copper Field'],
  ['copperecho13', 'Copper Echo'],
  ['copperloom14', 'Copper Loom'],
  ['coppercrest15', 'Copper Crest'],
  ['coppergrove16', 'Copper Grove'],
  ['coppercurrent17', 'Copper Current'],
  ['copperframe18', 'Copper Frame'],
  ['copperember19', 'Copper Ember'],
  ['copperatlas20', 'Copper Atlas'],
  ['copperspiral21', 'Copper Spiral'],
  ['copperhaze22', 'Copper Haze'],
  ['coppershard23', 'Copper Shard'],
  ['coppervista24', 'Copper Vista'],
  ['copperglow25', 'Copper Glow'],
  ['fernveil1', 'Fern Veil'],
  ['fernmeridian2', 'Fern Meridian'],
  ['fernbloom3', 'Fern Bloom'],
  ['fernhush4', 'Fern Hush'],
  ['fernarc5', 'Fern Arc'],
  ['ferndrift6', 'Fern Drift'],
  ['fernhalo7', 'Fern Halo'],
  ['fernthread8', 'Fern Thread'],
  ['ferngarden9', 'Fern Garden'],
  ['fernridge10', 'Fern Ridge'],
  ['fernpulse11', 'Fern Pulse'],
  ['fernfield12', 'Fern Field'],
  ['fernecho13', 'Fern Echo'],
  ['fernloom14', 'Fern Loom'],
  ['ferncrest15', 'Fern Crest'],
  ['ferngrove16', 'Fern Grove'],
  ['ferncurrent17', 'Fern Current'],
  ['fernframe18', 'Fern Frame'],
  ['fernember19', 'Fern Ember'],
  ['fernatlas20', 'Fern Atlas'],
  ['fernspiral21', 'Fern Spiral'],
  ['fernhaze22', 'Fern Haze'],
  ['fernshard23', 'Fern Shard'],
  ['fernvista24', 'Fern Vista'],
  ['fernglow25', 'Fern Glow'],
  ['laserveil1', 'Laser Veil'],
  ['lasermeridian2', 'Laser Meridian'],
  ['laserbloom3', 'Laser Bloom'],
  ['laserhush4', 'Laser Hush'],
  ['laserarc5', 'Laser Arc'],
  ['laserdrift6', 'Laser Drift'],
  ['laserhalo7', 'Laser Halo'],
  ['laserthread8', 'Laser Thread'],
  ['lasergarden9', 'Laser Garden'],
  ['laserridge10', 'Laser Ridge'],
  ['laserpulse11', 'Laser Pulse'],
  ['laserfield12', 'Laser Field'],
  ['laserecho13', 'Laser Echo'],
  ['laserloom14', 'Laser Loom'],
  ['lasercrest15', 'Laser Crest'],
  ['lasergrove16', 'Laser Grove'],
  ['lasercurrent17', 'Laser Current'],
  ['laserframe18', 'Laser Frame'],
  ['laserember19', 'Laser Ember'],
  ['laseratlas20', 'Laser Atlas'],
  ['laserspiral21', 'Laser Spiral'],
  ['laserhaze22', 'Laser Haze'],
  ['lasershard23', 'Laser Shard'],
  ['laservista24', 'Laser Vista'],
  ['laserglow25', 'Laser Glow'],
  ['vhsveil1', 'VHS Veil'],
  ['vhsmeridian2', 'VHS Meridian'],
  ['vhsbloom3', 'VHS Bloom'],
  ['vhshush4', 'VHS Hush'],
  ['vhsarc5', 'VHS Arc'],
  ['vhsdrift6', 'VHS Drift'],
  ['vhshalo7', 'VHS Halo'],
  ['vhsthread8', 'VHS Thread'],
  ['vhsgarden9', 'VHS Garden'],
  ['vhsridge10', 'VHS Ridge'],
  ['vhspulse11', 'VHS Pulse'],
  ['vhsfield12', 'VHS Field'],
  ['vhsecho13', 'VHS Echo'],
  ['vhsloom14', 'VHS Loom'],
  ['vhscrest15', 'VHS Crest'],
  ['vhsgrove16', 'VHS Grove'],
  ['vhscurrent17', 'VHS Current'],
  ['vhsframe18', 'VHS Frame'],
  ['vhsember19', 'VHS Ember'],
  ['vhsatlas20', 'VHS Atlas'],
  ['vhsspiral21', 'VHS Spiral'],
  ['vhshaze22', 'VHS Haze'],
  ['vhsshard23', 'VHS Shard'],
  ['vhsvista24', 'VHS Vista'],
  ['vhsglow25', 'VHS Glow'],
  ['orbitveil1', 'Orbit Veil'],
  ['orbitmeridian2', 'Orbit Meridian'],
  ['orbitbloom3', 'Orbit Bloom'],
  ['orbithush4', 'Orbit Hush'],
  ['orbitarc5', 'Orbit Arc'],
  ['orbitdrift6', 'Orbit Drift'],
  ['orbithalo7', 'Orbit Halo'],
  ['orbitthread8', 'Orbit Thread'],
  ['orbitgarden9', 'Orbit Garden'],
  ['orbitridge10', 'Orbit Ridge'],
  ['orbitpulse11', 'Orbit Pulse'],
  ['orbitfield12', 'Orbit Field'],
  ['orbitecho13', 'Orbit Echo'],
  ['orbitloom14', 'Orbit Loom'],
  ['orbitcrest15', 'Orbit Crest'],
  ['orbitgrove16', 'Orbit Grove'],
  ['orbitcurrent17', 'Orbit Current'],
  ['orbitframe18', 'Orbit Frame'],
  ['orbitember19', 'Orbit Ember'],
  ['orbitatlas20', 'Orbit Atlas'],
  ['orbitspiral21', 'Orbit Spiral'],
  ['orbithaze22', 'Orbit Haze'],
  ['orbitshard23', 'Orbit Shard'],
  ['orbitvista24', 'Orbit Vista'],
  ['orbitglow25', 'Orbit Glow'],
  ['contourveil1', 'Contour Veil'],
  ['contourmeridian2', 'Contour Meridian'],
  ['contourbloom3', 'Contour Bloom'],
  ['contourhush4', 'Contour Hush'],
  ['contourarc5', 'Contour Arc'],
  ['contourdrift6', 'Contour Drift'],
  ['contourhalo7', 'Contour Halo'],
  ['contourthread8', 'Contour Thread'],
  ['contourgarden9', 'Contour Garden'],
  ['contourridge10', 'Contour Ridge'],
  ['contourpulse11', 'Contour Pulse'],
  ['contourfield12', 'Contour Field'],
  ['contourecho13', 'Contour Echo'],
  ['contourloom14', 'Contour Loom'],
  ['contourcrest15', 'Contour Crest'],
  ['contourgrove16', 'Contour Grove'],
  ['contourcurrent17', 'Contour Current'],
  ['contourframe18', 'Contour Frame'],
  ['contourember19', 'Contour Ember'],
  ['contouratlas20', 'Contour Atlas'],
  ['contourspiral21', 'Contour Spiral'],
  ['contourhaze22', 'Contour Haze'],
  ['contourshard23', 'Contour Shard'],
  ['contourvista24', 'Contour Vista'],
  ['contourglow25', 'Contour Glow'],
  ['rippleveil1', 'Ripple Veil'],
  ['ripplemeridian2', 'Ripple Meridian'],
  ['ripplebloom3', 'Ripple Bloom'],
  ['ripplehush4', 'Ripple Hush'],
  ['ripplearc5', 'Ripple Arc'],
  ['rippledrift6', 'Ripple Drift'],
  ['ripplehalo7', 'Ripple Halo'],
  ['ripplethread8', 'Ripple Thread'],
  ['ripplegarden9', 'Ripple Garden'],
  ['rippleridge10', 'Ripple Ridge'],
  ['ripplepulse11', 'Ripple Pulse'],
  ['ripplefield12', 'Ripple Field'],
  ['rippleecho13', 'Ripple Echo'],
  ['rippleloom14', 'Ripple Loom'],
  ['ripplecrest15', 'Ripple Crest'],
  ['ripplegrove16', 'Ripple Grove'],
  ['ripplecurrent17', 'Ripple Current'],
  ['rippleframe18', 'Ripple Frame'],
  ['rippleember19', 'Ripple Ember'],
  ['rippleatlas20', 'Ripple Atlas'],
  ['ripplespiral21', 'Ripple Spiral'],
  ['ripplehaze22', 'Ripple Haze'],
  ['rippleshard23', 'Ripple Shard'],
  ['ripplevista24', 'Ripple Vista'],
  ['rippleglow25', 'Ripple Glow'],
  ['draftveil1', 'Draft Veil'],
  ['draftmeridian2', 'Draft Meridian'],
  ['draftbloom3', 'Draft Bloom'],
  ['drafthush4', 'Draft Hush'],
  ['draftarc5', 'Draft Arc'],
  ['draftdrift6', 'Draft Drift'],
  ['drafthalo7', 'Draft Halo'],
  ['draftthread8', 'Draft Thread'],
  ['draftgarden9', 'Draft Garden'],
  ['draftridge10', 'Draft Ridge'],
  ['draftpulse11', 'Draft Pulse'],
  ['draftfield12', 'Draft Field'],
  ['draftecho13', 'Draft Echo'],
  ['draftloom14', 'Draft Loom'],
  ['draftcrest15', 'Draft Crest'],
  ['draftgrove16', 'Draft Grove'],
  ['draftcurrent17', 'Draft Current'],
  ['draftframe18', 'Draft Frame'],
  ['draftember19', 'Draft Ember'],
  ['draftatlas20', 'Draft Atlas'],
  ['draftspiral21', 'Draft Spiral'],
  ['drafthaze22', 'Draft Haze'],
  ['draftshard23', 'Draft Shard'],
  ['draftvista24', 'Draft Vista'],
  ['draftglow25', 'Draft Glow'],
  ['vellumveil1', 'Vellum Veil'],
  ['vellummeridian2', 'Vellum Meridian'],
  ['vellumbloom3', 'Vellum Bloom'],
  ['vellumhush4', 'Vellum Hush'],
  ['vellumarc5', 'Vellum Arc'],
  ['vellumdrift6', 'Vellum Drift'],
  ['vellumhalo7', 'Vellum Halo'],
  ['vellumthread8', 'Vellum Thread'],
  ['vellumgarden9', 'Vellum Garden'],
  ['vellumridge10', 'Vellum Ridge'],
  ['vellumpulse11', 'Vellum Pulse'],
  ['vellumfield12', 'Vellum Field'],
  ['vellumecho13', 'Vellum Echo'],
  ['vellumloom14', 'Vellum Loom'],
  ['vellumcrest15', 'Vellum Crest'],
  ['vellumgrove16', 'Vellum Grove'],
  ['vellumcurrent17', 'Vellum Current'],
  ['vellumframe18', 'Vellum Frame'],
  ['vellumember19', 'Vellum Ember'],
  ['vellumatlas20', 'Vellum Atlas'],
  ['vellumspiral21', 'Vellum Spiral'],
  ['vellumhaze22', 'Vellum Haze'],
  ['vellumshard23', 'Vellum Shard'],
  ['vellumvista24', 'Vellum Vista'],
  ['vellumglow25', 'Vellum Glow'],
  ['cinderveil1', 'Cinder Veil'],
  ['cindermeridian2', 'Cinder Meridian'],
  ['cinderbloom3', 'Cinder Bloom'],
  ['cinderhush4', 'Cinder Hush'],
  ['cinderarc5', 'Cinder Arc'],
  ['cinderdrift6', 'Cinder Drift'],
  ['cinderhalo7', 'Cinder Halo'],
  ['cinderthread8', 'Cinder Thread'],
  ['cindergarden9', 'Cinder Garden'],
  ['cinderridge10', 'Cinder Ridge'],
  ['cinderpulse11', 'Cinder Pulse'],
  ['cinderfield12', 'Cinder Field'],
  ['cinderecho13', 'Cinder Echo'],
  ['cinderloom14', 'Cinder Loom'],
  ['cindercrest15', 'Cinder Crest'],
  ['cindergrove16', 'Cinder Grove'],
  ['cindercurrent17', 'Cinder Current'],
  ['cinderframe18', 'Cinder Frame'],
  ['cinderember19', 'Cinder Ember'],
  ['cinderatlas20', 'Cinder Atlas'],
  ['cinderspiral21', 'Cinder Spiral'],
  ['cinderhaze22', 'Cinder Haze'],
  ['cindershard23', 'Cinder Shard'],
  ['cindervista24', 'Cinder Vista'],
  ['cinderglow25', 'Cinder Glow'],
  ['tideveil1', 'Tide Veil'],
  ['tidemeridian2', 'Tide Meridian'],
  ['tidebloom3', 'Tide Bloom'],
  ['tidehush4', 'Tide Hush'],
  ['tidearc5', 'Tide Arc'],
  ['tidedrift6', 'Tide Drift'],
  ['tidehalo7', 'Tide Halo'],
  ['tidethread8', 'Tide Thread'],
  ['tidegarden9', 'Tide Garden'],
  ['tideridge10', 'Tide Ridge'],
  ['tidepulse11', 'Tide Pulse'],
  ['tidefield12', 'Tide Field'],
  ['tideecho13', 'Tide Echo'],
  ['tideloom14', 'Tide Loom'],
  ['tidecrest15', 'Tide Crest'],
  ['tidegrove16', 'Tide Grove'],
  ['tidecurrent17', 'Tide Current'],
  ['tideframe18', 'Tide Frame'],
  ['tideember19', 'Tide Ember'],
  ['tideatlas20', 'Tide Atlas'],
  ['tidespiral21', 'Tide Spiral'],
  ['tidehaze22', 'Tide Haze'],
  ['tideshard23', 'Tide Shard'],
  ['tidevista24', 'Tide Vista'],
  ['tideglow25', 'Tide Glow'],
  ['packetveil1', 'Packet Veil'],
  ['packetmeridian2', 'Packet Meridian'],
  ['packetbloom3', 'Packet Bloom'],
  ['packethush4', 'Packet Hush'],
  ['packetarc5', 'Packet Arc'],
  ['packetdrift6', 'Packet Drift'],
  ['packethalo7', 'Packet Halo'],
  ['packetthread8', 'Packet Thread'],
  ['packetgarden9', 'Packet Garden'],
  ['packetridge10', 'Packet Ridge'],
  ['packetpulse11', 'Packet Pulse'],
  ['packetfield12', 'Packet Field'],
  ['packetecho13', 'Packet Echo'],
  ['packetloom14', 'Packet Loom'],
  ['packetcrest15', 'Packet Crest'],
  ['packetgrove16', 'Packet Grove'],
  ['packetcurrent17', 'Packet Current'],
  ['packetframe18', 'Packet Frame'],
  ['packetember19', 'Packet Ember'],
  ['packetatlas20', 'Packet Atlas'],
  ['packetspiral21', 'Packet Spiral'],
  ['packethaze22', 'Packet Haze'],
  ['packetshard23', 'Packet Shard'],
  ['packetvista24', 'Packet Vista'],
  ['packetglow25', 'Packet Glow'],
  ['opalveil1', 'Opal Veil'],
  ['opalmeridian2', 'Opal Meridian'],
  ['opalbloom3', 'Opal Bloom'],
  ['opalhush4', 'Opal Hush'],
  ['opalarc5', 'Opal Arc'],
  ['opaldrift6', 'Opal Drift'],
  ['opalhalo7', 'Opal Halo'],
  ['opalthread8', 'Opal Thread'],
  ['opalgarden9', 'Opal Garden'],
  ['opalridge10', 'Opal Ridge'],
  ['opalpulse11', 'Opal Pulse'],
  ['opalfield12', 'Opal Field'],
  ['opalecho13', 'Opal Echo'],
  ['opalloom14', 'Opal Loom'],
  ['opalcrest15', 'Opal Crest'],
  ['opalgrove16', 'Opal Grove'],
  ['opalcurrent17', 'Opal Current'],
  ['opalframe18', 'Opal Frame'],
  ['opalember19', 'Opal Ember'],
  ['opalatlas20', 'Opal Atlas'],
  ['opalspiral21', 'Opal Spiral'],
  ['opalhaze22', 'Opal Haze'],
  ['opalshard23', 'Opal Shard'],
  ['opalvista24', 'Opal Vista'],
  ['opalglow25', 'Opal Glow'],
  ['sundownveil1', 'Sundown Veil'],
  ['sundownmeridian2', 'Sundown Meridian'],
  ['sundownbloom3', 'Sundown Bloom'],
  ['sundownhush4', 'Sundown Hush'],
  ['sundownarc5', 'Sundown Arc'],
  ['sundowndrift6', 'Sundown Drift'],
  ['sundownhalo7', 'Sundown Halo'],
  ['sundownthread8', 'Sundown Thread'],
  ['sundowngarden9', 'Sundown Garden'],
  ['sundownridge10', 'Sundown Ridge'],
  ['sundownpulse11', 'Sundown Pulse'],
  ['sundownfield12', 'Sundown Field'],
  ['sundownecho13', 'Sundown Echo'],
  ['sundownloom14', 'Sundown Loom'],
  ['sundowncrest15', 'Sundown Crest'],
  ['sundowngrove16', 'Sundown Grove'],
  ['sundowncurrent17', 'Sundown Current'],
  ['sundownframe18', 'Sundown Frame'],
  ['sundownember19', 'Sundown Ember'],
  ['sundownatlas20', 'Sundown Atlas'],
  ['sundownspiral21', 'Sundown Spiral'],
  ['sundownhaze22', 'Sundown Haze'],
  ['sundownshard23', 'Sundown Shard'],
  ['sundownvista24', 'Sundown Vista'],
  ['sundownglow25', 'Sundown Glow'],
  ['mirageveil1', 'Mirage Veil'],
  ['miragemeridian2', 'Mirage Meridian'],
  ['miragebloom3', 'Mirage Bloom'],
  ['miragehush4', 'Mirage Hush'],
  ['miragearc5', 'Mirage Arc'],
  ['miragedrift6', 'Mirage Drift'],
  ['miragehalo7', 'Mirage Halo'],
  ['miragethread8', 'Mirage Thread'],
  ['miragegarden9', 'Mirage Garden'],
  ['mirageridge10', 'Mirage Ridge'],
  ['miragepulse11', 'Mirage Pulse'],
  ['miragefield12', 'Mirage Field'],
  ['mirageecho13', 'Mirage Echo'],
  ['mirageloom14', 'Mirage Loom'],
  ['miragecrest15', 'Mirage Crest'],
  ['miragegrove16', 'Mirage Grove'],
  ['miragecurrent17', 'Mirage Current'],
  ['mirageframe18', 'Mirage Frame'],
  ['mirageember19', 'Mirage Ember'],
  ['mirageatlas20', 'Mirage Atlas'],
  ['miragespiral21', 'Mirage Spiral'],
  ['miragehaze22', 'Mirage Haze'],
  ['mirageshard23', 'Mirage Shard'],
  ['miragevista24', 'Mirage Vista'],
  ['mirageglow25', 'Mirage Glow'],
  ['quartzveil1', 'Quartz Veil'],
  ['quartzmeridian2', 'Quartz Meridian'],
  ['quartzbloom3', 'Quartz Bloom'],
  ['quartzhush4', 'Quartz Hush'],
  ['quartzarc5', 'Quartz Arc'],
  ['quartzdrift6', 'Quartz Drift'],
  ['quartzhalo7', 'Quartz Halo'],
  ['quartzthread8', 'Quartz Thread'],
  ['quartzgarden9', 'Quartz Garden'],
  ['quartzridge10', 'Quartz Ridge'],
  ['quartzpulse11', 'Quartz Pulse'],
  ['quartzfield12', 'Quartz Field'],
  ['quartzecho13', 'Quartz Echo'],
  ['quartzloom14', 'Quartz Loom'],
  ['quartzcrest15', 'Quartz Crest'],
  ['quartzgrove16', 'Quartz Grove'],
  ['quartzcurrent17', 'Quartz Current'],
  ['quartzframe18', 'Quartz Frame'],
  ['quartzember19', 'Quartz Ember'],
  ['quartzatlas20', 'Quartz Atlas'],
  ['quartzspiral21', 'Quartz Spiral'],
  ['quartzhaze22', 'Quartz Haze'],
  ['quartzshard23', 'Quartz Shard'],
  ['quartzvista24', 'Quartz Vista'],
  ['quartzglow25', 'Quartz Glow'],
  ['nimbusveil1', 'Nimbus Veil'],
  ['nimbusmeridian2', 'Nimbus Meridian'],
  ['nimbusbloom3', 'Nimbus Bloom'],
  ['nimbushush4', 'Nimbus Hush'],
  ['nimbusarc5', 'Nimbus Arc'],
  ['nimbusdrift6', 'Nimbus Drift'],
  ['nimbushalo7', 'Nimbus Halo'],
  ['nimbusthread8', 'Nimbus Thread'],
  ['nimbusgarden9', 'Nimbus Garden'],
  ['nimbusridge10', 'Nimbus Ridge'],
  ['nimbuspulse11', 'Nimbus Pulse'],
  ['nimbusfield12', 'Nimbus Field'],
  ['nimbusecho13', 'Nimbus Echo'],
  ['nimbusloom14', 'Nimbus Loom'],
  ['nimbuscrest15', 'Nimbus Crest'],
  ['nimbusgrove16', 'Nimbus Grove'],
  ['nimbuscurrent17', 'Nimbus Current'],
  ['nimbusframe18', 'Nimbus Frame'],
  ['nimbusember19', 'Nimbus Ember'],
  ['nimbusatlas20', 'Nimbus Atlas'],
  ['nimbusspiral21', 'Nimbus Spiral'],
  ['nimbushaze22', 'Nimbus Haze'],
  ['nimbusshard23', 'Nimbus Shard'],
  ['nimbusvista24', 'Nimbus Vista'],
  ['nimbusglow25', 'Nimbus Glow'],
  ['signalveil1', 'Signal Veil'],
  ['signalmeridian2', 'Signal Meridian'],
  ['signalbloom3', 'Signal Bloom'],
  ['signalhush4', 'Signal Hush'],
  ['signalarc5', 'Signal Arc'],
  ['signaldrift6', 'Signal Drift'],
  ['signalhalo7', 'Signal Halo'],
  ['signalthread8', 'Signal Thread'],
  ['signalgarden9', 'Signal Garden'],
  ['signalridge10', 'Signal Ridge'],
  ['signalpulse11', 'Signal Pulse'],
  ['signalfield12', 'Signal Field'],
  ['signalecho13', 'Signal Echo'],
  ['signalloom14', 'Signal Loom'],
  ['signalcrest15', 'Signal Crest'],
  ['signalgrove16', 'Signal Grove'],
  ['signalcurrent17', 'Signal Current'],
  ['signalframe18', 'Signal Frame'],
  ['signalember19', 'Signal Ember'],
  ['signalatlas20', 'Signal Atlas'],
  ['signalspiral21', 'Signal Spiral'],
  ['signalhaze22', 'Signal Haze'],
  ['signalshard23', 'Signal Shard'],
  ['signalvista24', 'Signal Vista'],
  ['signalglow25', 'Signal Glow'],
];
const LUCIDE_SCRIPT = `<script src="https://unpkg.com/lucide@${LUCIDE_VERSION}/dist/umd/lucide.min.js" data-xandersarcade-lucide="true"></script>`;
const POPUP_OVERRIDE_SCRIPT = `<script data-xandersarcade-popup-override="true">
(() => {
  const HARD_REFRESH_NOTICE_KEY = "xandersarcade-hard-refresh-notice-dismissed-v2";
  const HARD_REFRESH_NOTICE_ID = "xandersarcade-hard-refresh-notice";
  const HARD_REFRESH_STYLE_ID = "xandersarcade-hard-refresh-notice-style";
  const noopToastify = () => ({
    showToast() {},
    hideToast() {},
  });
  const noopSwalResult = Promise.resolve({
    isConfirmed: false,
    isDenied: false,
    isDismissed: true,
    value: null,
  });
  const noopSwal = {
    fire: () => noopSwalResult,
    close: () => {},
    showValidationMessage: () => {},
    stopTimer: () => {},
    resumeTimer: () => {},
    mixin: () => ({ fire: () => noopSwalResult }),
  };

  Object.defineProperty(window, "Toastify", {
    configurable: true,
    get() {
      return noopToastify;
    },
    set() {},
  });

  Object.defineProperty(window, "Swal", {
    configurable: true,
    get() {
      return noopSwal;
    },
    set() {},
  });

  window.swal = noopSwal.fire;

  const markNoticeDismissed = () => {
    try {
      localStorage.setItem(HARD_REFRESH_NOTICE_KEY, "true");
    } catch (error) {
      console.warn("Failed to persist hard refresh notice state", error);
    }
  };

  const shouldSkipNotice = () => {
    try {
      return localStorage.getItem(HARD_REFRESH_NOTICE_KEY) === "true";
    } catch (error) {
      console.warn("Failed to read hard refresh notice state", error);
      return false;
    }
  };

  const ensureNoticeStyles = () => {
    if (document.getElementById(HARD_REFRESH_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = HARD_REFRESH_STYLE_ID;
    style.textContent = "#"+HARD_REFRESH_NOTICE_ID+"{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(5,10,18,.82);backdrop-filter:blur(18px)}#"+HARD_REFRESH_NOTICE_ID+" .xandersarcade-hard-refresh-card{width:min(92vw,680px);padding:32px 28px;border:1px solid rgba(255,255,255,.14);border-radius:28px;background:linear-gradient(180deg,rgba(16,24,38,.98),rgba(8,12,22,.98));box-shadow:0 30px 80px rgba(0,0,0,.45);color:#f5f7fb;text-align:center;font-family:inherit}#"+HARD_REFRESH_NOTICE_ID+" .xandersarcade-hard-refresh-title{margin:0 0 16px;font-size:clamp(2.4rem,7vw,4.3rem);line-height:.96;font-weight:800;letter-spacing:-.04em}#"+HARD_REFRESH_NOTICE_ID+" .xandersarcade-hard-refresh-body{margin:0;font-size:clamp(1rem,2.7vw,1.3rem);line-height:1.7;color:rgba(245,247,251,.9)}#"+HARD_REFRESH_NOTICE_ID+" strong{font-weight:800;color:#fff}@media (max-width:640px){#"+HARD_REFRESH_NOTICE_ID+"{padding:18px}#"+HARD_REFRESH_NOTICE_ID+" .xandersarcade-hard-refresh-card{padding:24px 20px;border-radius:22px}}";
    document.head.appendChild(style);
  };

  const lockPageBehindNotice = () => {
    document.documentElement.style.overflow = "hidden";
    if (document.body) {
      document.body.style.overflow = "hidden";
    }
  };

  const createNotice = () => {
    const notice = document.createElement("div");
    notice.id = HARD_REFRESH_NOTICE_ID;
    notice.setAttribute("role", "alertdialog");
    notice.setAttribute("aria-modal", "true");
    notice.setAttribute("aria-labelledby", "xandersarcade-hard-refresh-title");
    notice.setAttribute("aria-describedby", "xandersarcade-hard-refresh-body");
    notice.innerHTML = '<div class="xandersarcade-hard-refresh-card"><h1 id="xandersarcade-hard-refresh-title" class="xandersarcade-hard-refresh-title">Hold Up!</h1><p id="xandersarcade-hard-refresh-body" class="xandersarcade-hard-refresh-body">Your site may not be up-to-date, unfortunately, I cannot find a fix for this right now. So to see updates, Press <strong>Ctrl+Shift+R</strong></p></div>';
    notice.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    return notice;
  };

  const mountNotice = () => {
    if (shouldSkipNotice()) {
      return;
    }

    ensureNoticeStyles();
    lockPageBehindNotice();

    let notice = document.getElementById(HARD_REFRESH_NOTICE_ID);
    if (!notice) {
      notice = createNotice();
      document.body.appendChild(notice);
    }

    if (!notice.__xandersarcadeNoticeObserver) {
      const observer = new MutationObserver(() => {
        if (shouldSkipNotice()) {
          observer.disconnect();
          return;
        }

        lockPageBehindNotice();

        if (!document.body.contains(notice)) {
          document.body.appendChild(notice);
        }
      });
      observer.observe(document.body, { childList: true });
      notice.__xandersarcadeNoticeObserver = observer;
    }
  };

  document.addEventListener(
    "keydown",
    (event) => {
      const key = String(event.key || "").toLowerCase();
      const wantsHardRefresh = (event.ctrlKey || event.metaKey) && event.shiftKey && key === "r";

      if (wantsHardRefresh) {
        markNoticeDismissed();
      }

      if (!shouldSkipNotice() && key === "escape") {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );

  const startNotice = () => {
    if (document.body) {
      mountNotice();
      return;
    }

    window.requestAnimationFrame(startNotice);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startNotice, { once: true });
  } else {
    startNotice();
  }
})();
</script>`;
const MORE_TAB_CLEANUP_SCRIPT = `<script data-xandersarcade-more-cleanup="true">
(() => {
  const bypassItems = [
    "🔒 Securly",
    "💻 Content Keeper",
    "💂‍♂️ GoGuardian",
    "⚡Lightspeed",
    "🟢 Limewize",
    "🔰 Hapara",
    "☂️ Cisco Umbrella",
    "💫 Aristotle",
    "🔥 Palo Alto",
    "🏫 Lan School",
    "🛡️FortiGuard",
    "🌳 Senso Cloud",
    "💼 iBoss",
  ];

  const ensureStyles = () => {
    if (document.querySelector("style[data-xandersarcade-more-styles]")) {
      return;
    }

    const style = document.createElement("style");
    style.setAttribute("data-xandersarcade-more-styles", "true");
    style.textContent = ".xandersarcade-more-grid{display:flex!important;flex-direction:row!important;flex-wrap:wrap!important;gap:30px!important;align-items:stretch!important}.xandersarcade-more-grid>.section-card{min-width:min(100%,320px)!important}.xandersarcade-credits-card{flex:0 0 500px!important;width:500px!important}.xandersarcade-bypass-card{display:flex;flex-direction:column;flex:1 1 0!important}.xandersarcade-bypass-list{list-style:none;margin:22px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:12px;align-content:flex-start}.xandersarcade-bypass-list li{display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--border-color);border-radius:calc(var(--border-radius) - 2px);background:color-mix(in srgb,var(--bg-2-color) 84%,white 4%);font-weight:600;color:var(--text-color);width:fit-content;max-width:100%}@media (max-width:768px){.xandersarcade-more-grid{gap:20px!important}.xandersarcade-credits-card,.xandersarcade-bypass-card{flex:1 1 100%!important;width:auto!important}.xandersarcade-bypass-list{gap:10px}.xandersarcade-bypass-list li{padding:10px 12px}}";
    document.head.appendChild(style);
  };

  const createBypassCard = () => {
    const card = document.createElement("div");
    card.className = "section-card xandersarcade-bypass-card";
    card.setAttribute("data-xandersarcade-total-bypassed", "true");
    card.innerHTML = '<div class="section-header"><i class="fa-solid fa-shield-halved section-icon"></i><h1 class="section-title">Total Bypassed</h1><p class="section-subtitle">The main filters this site is built to get around.</p></div><ul class="xandersarcade-bypass-list">' + bypassItems.map((item) => "<li>" + item + "</li>").join("") + "</ul>";
    return card;
  };

  const syncMoreLayout = () => {
    document.querySelectorAll(".section-card").forEach((card) => {
      const title = card.querySelector(".section-title")?.textContent?.trim().toLowerCase();

      if (title === "partners" || title === "donate") {
        card.remove();
      }
    });

    ensureStyles();

    const creditsCard = Array.from(document.querySelectorAll(".section-card")).find((card) => {
      const title = card.querySelector(".section-title")?.textContent?.trim().toLowerCase();
      return title === "credits";
    });

    if (!creditsCard) {
      return;
    }

    const row = creditsCard.parentElement;
    if (!row) {
      return;
    }

    row.classList.add("xandersarcade-more-grid");
    creditsCard.classList.add("xandersarcade-credits-card");

    if (!row.querySelector("[data-xandersarcade-total-bypassed]")) {
      row.appendChild(createBypassCard());
    }
  };

  syncMoreLayout();

  const observer = new MutationObserver(syncMoreLayout);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
</script>`;
const SETTINGS_OTHER_CLEANUP_SCRIPT = `<script data-xandersarcade-settings-cleanup="true">
(() => {
  const blockedTitles = new Set(["status page", "lunaar docs", "xanders arcade docs", "discord"]);

  const removeSettingsCards = () => {
    document.querySelectorAll(".settings-card").forEach((card) => {
      const title = card.querySelector("h2")?.textContent?.trim().toLowerCase();

      if (title && blockedTitles.has(title)) {
        card.remove();
      }
    });
  };

  removeSettingsCards();

  const observer = new MutationObserver(removeSettingsCards);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
</script>`;
const GO_TAB_CLEANUP_STYLE =
  '<style data-xandersarcade-go-cleanup="true">.loader{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}</style>';
const HOME_SEARCH_STYLE =
  '<style data-xandersarcade-home-search="true">.search-container{position:relative!important;width:min(720px,calc(100vw - 36px))!important;max-width:720px!important;min-height:64px!important;padding:0 22px!important;margin-top:10px!important;border-radius:999px!important;border:2px solid color-mix(in srgb,var(--border-color) 92%,transparent)!important;background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.025)),color-mix(in srgb,var(--bg-2-color) 92%,transparent)!important;box-shadow:0 16px 34px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.05)!important;backdrop-filter:blur(16px) saturate(1.04)!important;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease!important}.search-container:focus-within{transform:translateY(-1px)!important;border-color:color-mix(in srgb,var(--primary-color) 72%,transparent)!important;box-shadow:0 20px 40px rgba(0,0,0,.2),0 0 0 4px color-mix(in srgb,var(--primary-color) 16%,transparent)!important}.search-container .search{height:60px!important;font-size:1.02rem!important}.search-container #search-icon{width:22px!important;height:22px!important;flex:0 0 22px!important;color:color-mix(in srgb,var(--primary-color) 82%,white 8%)!important}.search-container .search::placeholder{color:color-mix(in srgb,var(--text-color) 76%,transparent)!important}#autocomplete{max-width:720px!important}</style>';
const GAMES_GENRE_STYLE =
  '<style data-xandersarcade-games-genres="true">#games-list{display:block}.xandersarcade-games-layout{display:grid;grid-template-columns:minmax(190px,240px) minmax(0,1fr);gap:24px;align-items:start}.xandersarcade-genre-sidebar{position:sticky;top:108px;display:flex;flex-direction:column;gap:14px;max-height:calc(100vh - 136px);padding:18px;border:1px solid var(--border-color);border-radius:20px;background:color-mix(in srgb,var(--bg-2-color) 88%,transparent);backdrop-filter:blur(14px);box-shadow:0 18px 48px rgba(0,0,0,.18);overflow:hidden}.xandersarcade-genre-sidebar-title{margin:0;font-size:1rem;font-weight:700;color:var(--text-color)}.xandersarcade-genre-nav{display:flex;flex-direction:column;gap:10px;overflow-y:auto;padding-right:4px;scrollbar-width:thin;scrollbar-color:var(--primary-color) transparent}.xandersarcade-genre-nav::-webkit-scrollbar{width:8px}.xandersarcade-genre-nav::-webkit-scrollbar-track{background:transparent}.xandersarcade-genre-nav::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--primary-color) 75%,transparent);border-radius:999px}.xandersarcade-genre-link{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:10px 12px;border-radius:14px;border:1px solid transparent;background:rgba(255,255,255,.03);color:var(--text-color);font:inherit;text-align:left;cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease}.xandersarcade-genre-link:hover{transform:translateX(4px);border-color:var(--primary-color);background:rgba(255,255,255,.06)}.xandersarcade-genre-link.active{border-color:var(--primary-color);background:rgba(146,130,251,.16)}.xandersarcade-genre-link-name{font-weight:600}.xandersarcade-genre-link-count{font-size:.85rem;opacity:.72}.xandersarcade-genre-content{display:flex;flex-direction:column;gap:28px;min-width:0}.xandersarcade-genre-section{display:flex;flex-direction:column;gap:14px;scroll-margin-top:120px}.xandersarcade-genre-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 6px}.xandersarcade-genre-title{margin:0;font-size:1.2rem;font-weight:700;color:var(--text-color)}.xandersarcade-genre-count{font-size:.9rem;opacity:.7}.xandersarcade-genre-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:18px}@media (max-width:980px){.xandersarcade-games-layout{grid-template-columns:1fr}.xandersarcade-genre-sidebar{position:relative;top:0;max-height:none;padding:14px 14px 10px;overflow:visible}.xandersarcade-genre-nav{flex-direction:row;flex-wrap:wrap;overflow:visible;padding-right:0}.xandersarcade-genre-link{width:auto;min-width:fit-content}.xandersarcade-genre-link:hover{transform:none}}@media (max-width:640px){.xandersarcade-genre-grid{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.xandersarcade-genre-link{flex:1 1 calc(50% - 10px);justify-content:center}}</style>';
const GAMES_GENRE_SCRIPT = `<script data-xandersarcade-games-script="true">
(() => {
  const genreOrder = [
    "Horror",
    "Platformer",
    "Action",
    "Shooter",
    "Racing",
    "Sports",
    "Puzzle",
    "Strategy",
    "Simulation",
    "Rhythm",
    "Sandbox",
    "Trivia",
    "Arcade",
    "Misc",
  ];

  const manualGenres = new Map([
    ["five nights at epstein's", "Horror"],
    ["bowmasters", "Action"],
    ["ovo", "Platformer"],
    ["ovo 2", "Platformer"],
    ["ovo 3 dimensions", "Platformer"],
    ["gladihoppers", "Action"],
    ["ice dodo", "Platformer"],
    ["block blast", "Puzzle"],
    ["jetpack joyride", "Platformer"],
    ["friday night funkin", "Rhythm"],
    ["sprunki", "Rhythm"],
    ["slow roads", "Simulation"],
    ["poxel.io", "Shooter"],
    ["survival karts", "Racing"],
    ["capybara clicker", "Simulation"],
    ["bitlife", "Simulation"],
    ["eaglercraft", "Sandbox"],
    ["territorial.io", "Strategy"],
    ["ages of conflict", "Strategy"],
    ["globle unlimited", "Trivia"],
    ["geoguessr", "Trivia"],
    ["request a game", "Misc"],
  ]);

  const genreRules = [
    ["Horror", [/five nights/, /freddy/, /backrooms/, /baldi/, /horror/, /scary/, /creepy/]],
    ["Rhythm", [/friday night funkin/, /fnf/, /sprunki/, /rhythm/, /music/, /dance/]],
    ["Shooter", [/shooter/, /sniper/, /fps/, /gun/, /strike/, /assault/, /zombie/, /shell shock/, /krunker/, /poxel/, /doom/]],
    ["Racing", [/kart/, /drift/, /racing/, /driver/, /driving/, /parking/, /moto/, /bike/, /car/, /traffic/, /road/, /speed/]],
    ["Sports", [/basketball/, /soccer/, /football/, /baseball/, /tennis/, /golf/, /pool/, /boxing/, /wrestling/, /hockey/, /skate/, /bmx/]],
    ["Puzzle", [/2048/, /sudoku/, /minesweeper/, /chess/, /checkers/, /puzzle/, /merge/, /block blast/, /mahjong/, /wordle/, /solitaire/]],
    ["Strategy", [/territorial/, /conflict/, /tower defense/, /kingdom/, /war/, /commander/, /civilization/, /tycoon/, /idle empire/, /battle sim/]],
    ["Sandbox", [/minecraft/, /eaglercraft/, /sandbox/, /build/, /worldbox/, /creative/]],
    ["Simulation", [/simulator/, /simulation/, /bitlife/, /life/, /roads/, /geofs/, /flight/, /papa's/, /cooking/, /clicker/, /idle/, /business/, /management/]],
    ["Platformer", [/ovo/, /vex/, /run /, /^run\\b/, /temple run/, /jetpack/, /mario/, /parkour/, /doodle/, /flappy/, /dodo/]],
    ["Action", [/fighter/, /action/, /battle/, /combat/, /mayhem/, /slash/, /warrior/, /bros/, /adventure/]],
    ["Trivia", [/geoguessr/, /globle/, /quiz/, /trivia/, /word/, /guess/]],
  ];

  function normalizeName(value) {
    return (value || "").toLowerCase().replace(/\\s+/g, " ").trim();
  }

  function repairGameImageUrl(image) {
    return String(image || "").replace(
      /^https:\/\/cdn\\.jsdelivr\\.net\\/gh\\/gn-math\\/covers@main\\//i,
      "https://raw.githubusercontent.com/gn-math/covers/main/",
    );
  }

  function getGenre(game) {
    const name = normalizeName(game.name);

    if (manualGenres.has(name)) {
      return manualGenres.get(name);
    }

    for (const [genre, patterns] of genreRules) {
      if (patterns.some((pattern) => pattern.test(name))) {
        return genre;
      }
    }

    return "Arcade";
  }

  function sortGames(games) {
    return [...games].sort((a, b) => {
      const getStatusPriority = (game) => {
        if (game.new) return 0;
        if (game.updated) return 1;
        if (game.top) return 2;
        if (game.name === "Request a game") return 4;
        return 3;
      };
      const priorityDifference = getStatusPriority(a) - getStatusPriority(b);
      if (priorityDifference) return priorityDifference;
      return a.name.localeCompare(b.name);
    });
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async function openGame(game) {
    if (game.proxy) {
      if (game.url.includes("jsdelivr")) {
        sessionStorage.setItem("lpurl", game.url);
        sessionStorage.setItem("rawurl", game.url);
        window.location.href = "/go?__xav=" + Date.now();
        return;
      }

      let proxiedUrl = null;

      if (localStorage.getItem("proxy-backend") === "ultraviolet") {
        await window.ensureUltravioletReady?.();
        if (window.encodeAny) {
          proxiedUrl = window.encodeAny(game.url);
        } else if (typeof __uv$config !== "undefined" && __uv$config.encodeUrl) {
          proxiedUrl = __uv$config.prefix + __uv$config.encodeUrl(game.url);
        }
      } else {
        await window.ensureScramjetReady?.();
        if (window.sjEncodeAndGo) {
          proxiedUrl = window.sjEncodeAndGo(game.url);
        }
      }

      if (!proxiedUrl || proxiedUrl === "?" || proxiedUrl === "/?") {
        proxiedUrl = "/new";
      }

      sessionStorage.setItem("lpurl", proxiedUrl);
      sessionStorage.setItem("rawurl", game.url);
      window.location.href = "/go?__xav=" + Date.now();
      return;
    }

    sessionStorage.setItem("lpurl", game.url);
    sessionStorage.setItem("rawurl", game.url);
    window.location.href = "/go?__xav=" + Date.now();
  }

  function createBadge(label, icon) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.innerHTML = '<i class="' + icon + '"></i> ' + label;
    return badge;
  }

  function createGameCard(game) {
    const gameItem = document.createElement("div");
    gameItem.className = "game-item";

    const img = document.createElement("img");
    img.alt = game.name;
    img.loading = "lazy";
    const imageUrl = repairGameImageUrl(game.image);
    img.src =
      imageUrl && imageUrl.startsWith("http")
        ? imageUrl
        : "/media/games/" + game.image;

    img.addEventListener("click", async (event) => {
      event.preventDefault();
      await openGame(game);
    });

    const badgeContainer = document.createElement("div");
    badgeContainer.className = "badge-container";

    if (game.top) badgeContainer.appendChild(createBadge("HOT", "fa-solid fa-fire"));
    if (game.new) badgeContainer.appendChild(createBadge("NEW", "fa-solid fa-sparkles"));
    if (game.fixed) badgeContainer.appendChild(createBadge("FIXED", "fa-solid fa-wrench"));
    if (game.exp) badgeContainer.appendChild(createBadge("EXP", "fa-solid fa-vial"));
    if (game.updated) badgeContainer.appendChild(createBadge("UPDATED", "fa-solid fa-sparkles"));
    badgeContainer.appendChild(createBadge(getGenre(game), "fa-solid fa-folder-tree"));

    const name = document.createElement("p");
    name.className = "game-link";
    name.textContent = game.name;

    gameItem.appendChild(img);
    gameItem.appendChild(badgeContainer);
    gameItem.appendChild(name);
    return gameItem;
  }

  function getFilteredGames(allGames) {
    const showProxy = document.getElementById("proxy-btn")?.classList.contains("active");
    const showHtml5 = document.getElementById("html5-btn")?.classList.contains("active");
    let filtered = allGames;

    if (!showProxy && !showHtml5) {
      filtered = [];
    } else if (!(showProxy && showHtml5)) {
      filtered = allGames.filter((game) => (showProxy && game.proxy) || (showHtml5 && !game.proxy));
    }

    const searchValue = (document.getElementById("search-input")?.value || "").toLowerCase().trim();
    if (searchValue) {
      filtered = filtered.filter((game) => game.name.toLowerCase().includes(searchValue));
    }

    return filtered;
  }

  function renderCategorizedGames(allGames) {
    const gamesList = document.getElementById("games-list");
    const searchInput = document.getElementById("search-input");

    if (!gamesList) {
      return;
    }

    const filtered = sortGames(getFilteredGames(allGames));
    if (searchInput) {
      searchInput.placeholder = "Search for " + filtered.length + " game" + (filtered.length === 1 ? "" : "s");
    }

    gamesList.innerHTML = "";
    if (filtered.length === 0) {
      gamesList.innerHTML =
        '<p style="color:var(--text-color);opacity:0.7;"><i class="fa-solid fa-circle-exclamation"></i> No games found.</p>';
      return;
    }

    const grouped = new Map();
    filtered.forEach((game) => {
      const genre = getGenre(game);
      if (!grouped.has(genre)) grouped.set(genre, []);
      grouped.get(genre).push(game);
    });

    const orderedGenres = Array.from(grouped.keys()).sort((a, b) => {
      const aIndex = genreOrder.indexOf(a);
      const bIndex = genreOrder.indexOf(b);
      const safeA = aIndex === -1 ? genreOrder.length : aIndex;
      const safeB = bIndex === -1 ? genreOrder.length : bIndex;
      if (safeA !== safeB) return safeA - safeB;
      return a.localeCompare(b);
    });

    const layout = document.createElement("div");
    layout.className = "xandersarcade-games-layout";

    const sidebar = document.createElement("aside");
    sidebar.className = "xandersarcade-genre-sidebar";

    const sidebarTitle = document.createElement("h2");
    sidebarTitle.className = "xandersarcade-genre-sidebar-title";
    sidebarTitle.textContent = "Genres";

    const nav = document.createElement("nav");
    nav.className = "xandersarcade-genre-nav";

    const content = document.createElement("div");
    content.className = "xandersarcade-genre-content";

    let activeButton = null;

    orderedGenres.forEach((genre) => {
      const slug = slugify(genre);
      const section = document.createElement("section");
      section.className = "xandersarcade-genre-section";
      section.id = "xandersarcade-genre-" + slug;

      const header = document.createElement("div");
      header.className = "xandersarcade-genre-header";

      const title = document.createElement("h2");
      title.className = "xandersarcade-genre-title";
      title.textContent = genre;

      const count = document.createElement("span");
      count.className = "xandersarcade-genre-count";
      count.textContent = grouped.get(genre).length + " game" + (grouped.get(genre).length === 1 ? "" : "s");

      const grid = document.createElement("div");
      grid.className = "xandersarcade-genre-grid";

      grouped.get(genre).forEach((game) => {
        grid.appendChild(createGameCard(game));
      });

      const button = document.createElement("button");
      button.type = "button";
      button.className = "xandersarcade-genre-link";
      button.innerHTML =
        '<span class="xandersarcade-genre-link-name">' +
        genre +
        "</span>" +
        '<span class="xandersarcade-genre-link-count">' +
        grouped.get(genre).length +
        "</span>";
      button.addEventListener("click", () => {
        activeButton?.classList.remove("active");
        button.classList.add("active");
        activeButton = button;
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      if (!activeButton) {
        button.classList.add("active");
        activeButton = button;
      }

      header.appendChild(title);
      header.appendChild(count);
      section.appendChild(header);
      section.appendChild(grid);
      nav.appendChild(button);
      content.appendChild(section);
    });

    sidebar.appendChild(sidebarTitle);
    sidebar.appendChild(nav);
    layout.appendChild(sidebar);
    layout.appendChild(content);
    gamesList.appendChild(layout);
  }

  async function loadGames() {
    const sources = ["/json/games.json", "/json/games-local.json", "/json/games-cdn.json"];
    const results = await Promise.allSettled(
      sources.map((source) =>
        fetch(source + "?v=${ASSET_VERSION}", { cache: "no-store" }).then((response) =>
          response.json(),
        ),
      ),
    );

    const games = results
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => result.value);
    const byName = new Map();
    games.forEach((game) => {
      if (!game?.name || !game.url) return;
      const key = normalizeName(game.name);
      const existing = byName.get(key);
      if (!existing) {
        byName.set(key, game);
        return;
      }
      byName.set(key, {
        ...game,
        ...existing,
        url: existing.url || game.url,
        image: existing.image || game.image,
        fixed: Boolean(existing.fixed || game.fixed),
        new: Boolean(existing.new ?? game.new),
        updated: Boolean(existing.updated ?? game.updated),
        top: Boolean(existing.top || game.top),
        proxy: existing.proxy ?? game.proxy,
      });
    });
    return Array.from(byName.values());
  }

  async function boot() {
    if (window.__xandersarcadeGenresBooted) return;
    window.__xandersarcadeGenresBooted = true;

    const allGames = await loadGames();
    renderCategorizedGames(allGames);

    const rerender = () => {
      window.requestAnimationFrame(() => renderCategorizedGames(allGames));
    };

    document.getElementById("search-input")?.addEventListener("input", rerender);
    document.getElementById("proxy-btn")?.addEventListener("click", rerender);
    document.getElementById("html5-btn")?.addEventListener("click", rerender);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
</script>`;
const BRANDING_SCRIPT = `<script data-xandersarcade-branding="true">
(() => {
  const voidosIcon = "${VOIDOS_ICON_PATH}";
  const replaceBranding = (value) =>
    typeof value === "string"
      ? value.replace(/\bLunaar\b/gi, "VoidOS")
      : value;

  const updateMeta = () => {
    if (document.title !== "VoidOS") document.title = "VoidOS";
    let icons = [...document.querySelectorAll('link[rel~="icon"]')];
    if (!icons.length) {
      const icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
      icons = [icon];
    }
    icons.forEach((icon) => {
      if (icon.getAttribute("href") !== voidosIcon) icon.href = voidosIcon;
      icon.type = "image/png";
    });

    document
      .querySelectorAll('meta[name="title"], meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[property="og:site_name"]')
      .forEach((meta) => {
        meta.setAttribute("content", "VoidOS");
      });
  };

  new MutationObserver(updateMeta).observe(document.head, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["href"],
  });

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  textNodes.forEach((node) => {
    if (node.nodeValue) {
      node.nodeValue = replaceBranding(node.nodeValue);
    }
  });

  updateMeta();
})();
</script>`;
const THEME_BOOTSTRAP_SCRIPT = `<script data-xandersarcade-theme-bootstrap="true">
(() => {
  try {
    let pendingTheme = null;
    let bodySyncAttached = false;

    const syncBodyTheme = () => {
      if (pendingTheme) {
        document.body?.setAttribute("theme", pendingTheme);
      }
    };

    const queueBodyThemeSync = (nextTheme) => {
      pendingTheme = nextTheme;

      if (document.body) {
        syncBodyTheme();
        return;
      }

      if (bodySyncAttached) {
        return;
      }

      bodySyncAttached = true;
      document.addEventListener("DOMContentLoaded", syncBodyTheme, { once: true });
    };

    const applyTheme = (nextTheme) => {
      if (!nextTheme) {
        return;
      }

      document.documentElement?.setAttribute("theme", nextTheme);
      queueBodyThemeSync(nextTheme);

      try {
        if (typeof window.updateParticles === "function") {
          window.updateParticles();
        }
      } catch (error) {
        console.warn("Theme particle sync failed", error);
      }
    };

    const hasMigrated = localStorage.getItem("${THEME_DEFAULT_MIGRATION_KEY}") === "true";
    let theme = localStorage.getItem("theme");

    if (
      !hasMigrated &&
      theme === "flux" &&
      localStorage.getItem("defaultThemeSet") === "true"
    ) {
      theme = "${DEFAULT_THEME}";
      localStorage.setItem("theme", theme);
    }

    if (!theme || theme === "default") {
      theme = "${DEFAULT_THEME}";
      localStorage.setItem("theme", theme);
      localStorage.setItem("defaultThemeSet", "true");
      localStorage.setItem("${THEME_DEFAULT_MIGRATION_KEY}", "true");
    }

    if (theme) {
      applyTheme(theme);
    }

    window.__xandersarcadeApplyTheme = applyTheme;

    window.addEventListener("storage", (event) => {
      if (event.key === "theme" && event.newValue) {
        applyTheme(event.newValue);
      }
    });

    window.addEventListener("xandersarcade-theme-change", (event) => {
      if (event.detail?.theme) {
        applyTheme(event.detail.theme);
      }
    });

    if ("BroadcastChannel" in window) {
      const themeChannel = new BroadcastChannel("xandersarcade-theme");
      themeChannel.addEventListener("message", (event) => {
        if (event.data?.type === "theme" && event.data.value) {
          applyTheme(event.data.value);
        }
      });
      window.__xandersarcadeThemeChannel = themeChannel;
    }
  } catch (error) {
    document.documentElement?.setAttribute("theme", "${DEFAULT_THEME}");
    document.body?.setAttribute("theme", "${DEFAULT_THEME}");
  }
})();
</script>`;
const LEGACY_SHELL_REFRESH_SCRIPT = `<script data-xandersarcade-shell-refresh="true">
(() => {
  const version = "${ASSET_VERSION}";
  const key = "${SHELL_CACHE_MIGRATION_KEY}";
  const sessionKey = key + "-session";
  const cleanupKey = key + "-workers";
  const cacheParams = ["__xav", "_xav"];

  if (window.location.pathname === "/go" || window.location.pathname.endsWith("/go.html")) {
    return;
  }

  const getVersionMarker = () => {
    try {
      const url = new URL(window.location.href);
      for (const param of cacheParams) {
        const value = url.searchParams.get(param);
        if (value) {
          return String(value).trim();
        }
      }
    } catch (error) {
      console.warn("Shell version marker read failed", error);
    }

    return "";
  };

  const cleanVersionMarker = () => {
    try {
      const url = new URL(window.location.href);
      const hadMarker = cacheParams.some((param) => url.searchParams.has(param));
      if (!hadMarker) {
        return;
      }

      cacheParams.forEach((param) => url.searchParams.delete(param));
      const nextUrl = url.pathname + url.search + url.hash;
      window.history.replaceState({}, "", nextUrl);
    } catch (error) {
      console.warn("Shell version marker cleanup failed", error);
    }
  };

  const refreshShell = async (registrations = [], shouldReload = true) => {
    try {
      if (registrations.length) {
        await Promise.allSettled(registrations.map((registration) => registration.unregister()));
      }

      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.allSettled(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }
    } catch (error) {
      console.warn("Shell refresh failed", error);
    } finally {
      localStorage.setItem(key, version);
      localStorage.setItem(cleanupKey, version);
      if (shouldReload) {
        sessionStorage.setItem(sessionKey, version);
        cleanVersionMarker();
        window.location.reload();
      } else {
        sessionStorage.removeItem(sessionKey);
        cleanVersionMarker();
      }
    }
  };

  const boot = async () => {
    const versionChanged = localStorage.getItem(key) !== version;
    const workersAlreadyCleaned = localStorage.getItem(cleanupKey) === version;
    const arrivedFromVersionMarker = Boolean(getVersionMarker());
    if (!("serviceWorker" in navigator)) {
      if (versionChanged) {
        localStorage.setItem(key, version);
      }
      localStorage.setItem(cleanupKey, version);
      cleanVersionMarker();
      return;
    }

    const registrations = await navigator.serviceWorker.getRegistrations();
    const currentScope = window.location.origin + "/";
    await Promise.allSettled(registrations.map((registration) => registration.update()));
    const rootRegistrations = registrations.filter((registration) => registration.scope === currentScope);
    const hasRootController =
      !!navigator.serviceWorker.controller &&
      String(navigator.serviceWorker.controller.scriptURL || "").startsWith(window.location.origin);
    const hasRootRegistration = rootRegistrations.length > 0;
    const shouldCleanShellWorkers = hasRootController || hasRootRegistration;

    if (!versionChanged && (!shouldCleanShellWorkers || workersAlreadyCleaned)) {
      sessionStorage.removeItem(sessionKey);
      cleanVersionMarker();
      return;
    }

    const alreadyReloadedForVersion =
      sessionStorage.getItem(sessionKey) === version || arrivedFromVersionMarker;
    await refreshShell(rootRegistrations, !alreadyReloadedForVersion);
  };

  boot().catch((error) => {
    console.warn("Shell boot refresh failed", error);
    localStorage.setItem(key, version);
    cleanVersionMarker();
  });
})();
</script>`;
const SHELL_REFRESH_SCRIPT = `<script src="/js/shell-refresh.js?v=${ASSET_VERSION}" data-xandersarcade-shell-refresh="true"></script>`;
const LUCIDE_STYLE =
  '<style data-xandersarcade-lucide-style="true">svg[data-lucide-fallback="true"]{width:1em;height:1em;stroke:currentColor;vertical-align:-0.125em;display:inline-block;flex-shrink:0}.navbar-link.pro svg[data-lucide-fallback="true"],button svg[data-lucide-fallback="true"],a svg[data-lucide-fallback="true"]{display:block}.navbar-link .icon{display:inline-flex;align-items:center;gap:.35rem}.xandersarcade-home-icon{width:1em;height:1em;display:inline-flex;align-items:center;justify-content:center}.tab .close{font-size:11px;cursor:pointer;padding:4px;border-radius:4px;transition:all .2s ease;opacity:.7}.tab .close:hover{opacity:1;background:rgba(255,255,255,.1)}.tab.active .close:hover{background:rgba(255,255,255,.2)}</style>';
const LUCIDE_ICON_OVERRIDE = `<script data-xandersarcade-lucide-override="true">
(() => {
  const iconMap = {
    "fa-arrow-left": "arrow-left",
    "fa-arrow-right": "arrow-right",
    "fa-rotate-right": "refresh-cw",
    "fa-rotate": "refresh-cw",
    "fa-house": "house",
    "fa-maximize": "maximize",
    "fa-code": "code",
    "fa-x": "x",
    "fa-plus": "plus",
    "fa-magnifying-glass": "search",
    "fa-grid-2": "grid-2x2",
    "fa-gamepad": "gamepad-2",
    "fa-cloud": "cloud",
    "fa-gear": "settings",
    "fa-cog": "settings",
    "fa-paint-brush": "paintbrush",
    "fa-network-wired": "network",
    "fa-user-secret": "shield-user",
    "fa-info-circle": "info",
    "fa-cloud-arrow-down": "cloud-download",
    "fa-file-import": "file-input",
    "fa-download": "download",
    "fa-up-right-from-square": "square-arrow-out-up-right",
    "fa-book": "book-open",
    "fa-triangle-exclamation": "triangle-alert",
    "fa-ban": "ban",
    "fa-handshake": "handshake",
    "fa-gavel": "gavel",
    "fa-envelope": "mail",
    "fa-heart": "heart",
    "fa-mug-hot": "coffee",
    "fa-circle-exclamation": "circle-alert",
    "fa-fire": "flame",
    "fa-folder-tree": "folder-tree",
    "fa-palette": "palette",
    "fa-shield-halved": "shield-half",
    "fa-sparkles": "sparkles",
    "fa-vial": "flask-conical",
    "fa-wrench": "wrench",
  };

  const fontAwesomeBaseClasses = new Set([
    "fa",
    "fa-solid",
    "fa-regular",
    "fa-light",
    "fa-thin",
    "fa-duotone",
    "fa-sharp",
    "fa-sharp-duotone",
    "fa-sharp-solid",
    "fa-fw",
  ]);

  function prepareIcon(element) {
    if (!element || element.dataset.xandersarcadeLucideReady === "true") {
      return false;
    }

    if (element.classList.contains("fa-brands")) {
      return false;
    }

    const classes = Array.from(element.classList);
    const iconClass = classes.find(
      (className) =>
        className.startsWith("fa-") &&
        !fontAwesomeBaseClasses.has(className) &&
        className !== "fa-brands",
    );

    const lucideName = iconMap[iconClass];
    if (!lucideName) {
      return false;
    }

    const keepClasses = classes.filter(
      (className) =>
        !fontAwesomeBaseClasses.has(className) &&
        className !== "fa-brands" &&
        className !== iconClass,
    );

    element.className = keepClasses.join(" ");
    element.setAttribute("data-lucide", lucideName);
    element.dataset.xandersarcadeLucideReady = "true";
    return true;
  }

  function replaceIcons(root = document.body) {
    if (!window.lucide || typeof window.lucide.createIcons !== "function") {
      return;
    }

    let changed = false;
    const icons = [];

    if (root instanceof Element && root.matches('i[class*="fa-"]')) {
      icons.push(root);
    }

    if (root && typeof root.querySelectorAll === "function") {
      icons.push(...root.querySelectorAll('i[class*="fa-"]'));
    }

    icons.forEach((icon) => {
      changed = prepareIcon(icon) || changed;
    });

    const hasDirectLucideIcons =
      root === document.body
        ? !!document.querySelector("[data-lucide]:not(svg.lucide)")
        : !!(
            (root instanceof Element &&
              root.matches("[data-lucide]:not(svg.lucide)")) ||
            root?.querySelector?.("[data-lucide]:not(svg.lucide)")
          );

    if (!changed && !hasDirectLucideIcons) {
      return;
    }

    window.lucide.createIcons({
      nameAttr: "data-lucide",
      root,
    });

    const createdIcons =
      root === document.body
        ? document.querySelectorAll("svg.lucide")
        : [
            ...(root instanceof Element && root.matches("svg.lucide")
              ? [root]
              : []),
            ...(root?.querySelectorAll?.("svg.lucide") || []),
          ];

    createdIcons.forEach((icon) => {
      icon.setAttribute("data-lucide-fallback", "true");
    });
  }

  function boot() {
    const pendingRoots = new Set();
    let refreshFrame = 0;

    const scheduleReplace = (root = document.body) => {
      if (root && root.nodeType === Node.ELEMENT_NODE) {
        pendingRoots.add(root);
      } else {
        pendingRoots.add(document.body);
      }

      if (refreshFrame) {
        return;
      }

      refreshFrame = requestAnimationFrame(() => {
        refreshFrame = 0;

        if (!pendingRoots.size) {
          replaceIcons(document.body);
          return;
        }

        pendingRoots.forEach((nextRoot) => replaceIcons(nextRoot));
        pendingRoots.clear();
      });
    };

    scheduleReplace(document.body);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) {
            return;
          }

          const element = node;
          const hasPotentialIcons =
            (element.matches &&
              (element.matches('i[class*="fa-"]') ||
                element.matches("[data-lucide]:not(svg.lucide)"))) ||
            (element.querySelector &&
              (element.querySelector('i[class*="fa-"]') ||
                element.querySelector("[data-lucide]:not(svg.lucide)")));

          if (hasPotentialIcons) {
            scheduleReplace(element);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
</script>`;
const SPACE_THEME_STYLE = `
body[theme="space"] {
  --primary-color: #ffe082;
  --secondary-color: #7bc7ff;
  --accent-color: #9d7bff;
  --bg-2-color: rgba(7, 11, 22, 0.9);
  --bg-color: #02040a;
  --text-color: #f6f7ff;
  --text-secondary-color: #b7bfd8;
  --text-placeholder-color: #6d7897;
  --border-color: rgba(133, 154, 255, 0.24);
  --border-radius: 22px;
  background:
    radial-gradient(circle at 18% 18%, rgba(123, 199, 255, 0.12), transparent 18%),
    radial-gradient(circle at 82% 12%, rgba(157, 123, 255, 0.12), transparent 24%),
    radial-gradient(circle at 52% 78%, rgba(255, 224, 130, 0.08), transparent 20%),
    linear-gradient(180deg, #03050b 0%, #02040a 42%, #010207 100%);
  background-attachment: fixed;
  color: var(--text-color);
}

body[theme="space"] #blobs,
body[theme="space"] #particles-js {
  opacity: 0.28;
  filter: saturate(1.12) brightness(0.68);
}

body[theme="space"] > *:not(.xandersarcade-cosmos) {
  position: relative;
  z-index: 1;
}

body[theme="space"] .navbar,
body[theme="space"] .card,
body[theme="space"] .section-card,
body[theme="space"] .search,
body[theme="space"] .input,
body[theme="space"] .btn,
body[theme="space"] .tab,
body[theme="space"] .navbar-proxy,
body[theme="space"] #tab-bar {
  background: rgba(5, 8, 16, 0.8) !important;
  border-color: rgba(147, 170, 255, 0.16) !important;
  box-shadow:
    0 18px 40px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.025);
  backdrop-filter: blur(18px) saturate(1.15);
}

body[theme="space"] .btn:hover,
body[theme="space"] .shortcut:hover,
body[theme="space"] .tab:hover {
  box-shadow:
    0 18px 40px rgba(0, 0, 0, 0.42),
    0 0 0 1px rgba(255, 224, 130, 0.16),
    0 0 28px rgba(123, 199, 255, 0.12);
}

body[theme="space"] .footer-version,
body[theme="space"] #rng-text,
body[theme="space"] h1,
body[theme="space"] h2,
body[theme="space"] h3 {
  text-shadow:
    0 0 10px rgba(255, 224, 130, 0.1),
    0 0 24px rgba(123, 199, 255, 0.08);
}

.xandersarcade-cosmos {
  display: none;
}

body[theme="space"] .xandersarcade-cosmos {
  display: block;
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

body[theme="space"] .xandersarcade-starfield {
  position: absolute;
  inset: -10%;
  opacity: 0.9;
}

body[theme="space"] .xandersarcade-starfield.layer-a {
  background-image:
    radial-gradient(circle, rgba(255, 224, 130, 0.95) 0 1.2px, transparent 1.7px),
    radial-gradient(circle, rgba(123, 199, 255, 0.9) 0 1px, transparent 1.5px),
    radial-gradient(circle, rgba(157, 123, 255, 0.95) 0 1.3px, transparent 1.8px);
  background-size: 220px 220px, 170px 170px, 260px 260px;
  background-position: 0 0, 60px 110px, 120px 30px;
  animation: xandersarcade-twinkle-a 7s ease-in-out infinite alternate;
}

body[theme="space"] .xandersarcade-starfield.layer-b {
  background-image:
    radial-gradient(circle, rgba(255, 224, 130, 0.75) 0 0.85px, transparent 1.4px),
    radial-gradient(circle, rgba(123, 199, 255, 0.7) 0 0.8px, transparent 1.3px),
    radial-gradient(circle, rgba(157, 123, 255, 0.82) 0 0.9px, transparent 1.45px);
  background-size: 130px 130px, 190px 190px, 150px 150px;
  background-position: 20px 70px, 80px 10px, 140px 120px;
  mix-blend-mode: screen;
  opacity: 0.55;
  animation: xandersarcade-twinkle-b 11s linear infinite;
}

body[theme="space"] .xandersarcade-nebula {
  position: absolute;
  inset: -8%;
  background:
    radial-gradient(circle at 20% 30%, rgba(123, 199, 255, 0.16), transparent 24%),
    radial-gradient(circle at 78% 22%, rgba(157, 123, 255, 0.2), transparent 26%),
    radial-gradient(circle at 58% 72%, rgba(255, 224, 130, 0.12), transparent 18%);
  filter: blur(18px);
  opacity: 0.95;
  animation: xandersarcade-nebula-drift 18s ease-in-out infinite alternate;
}

body[theme="space"] .xandersarcade-planet {
  position: absolute;
  border-radius: 50%;
  box-shadow:
    inset -26px -28px 54px rgba(10, 10, 18, 0.66),
    inset 16px 12px 32px rgba(255, 255, 255, 0.12),
    0 20px 80px rgba(0, 0, 0, 0.35);
}

body[theme="space"] .xandersarcade-planet::before,
body[theme="space"] .xandersarcade-planet::after {
  content: "";
  position: absolute;
  border-radius: 50%;
}

body[theme="space"] .xandersarcade-planet.planet-a {
  width: 320px;
  height: 320px;
  top: -115px;
  right: -90px;
  background:
    radial-gradient(circle at 28% 28%, rgba(255, 252, 232, 0.7), transparent 18%),
    linear-gradient(145deg, #ffe189 0%, #f3c064 28%, #9f7dff 64%, #4a3a86 100%);
  animation: xandersarcade-float-a 14s ease-in-out infinite;
}

body[theme="space"] .xandersarcade-planet.planet-a::before {
  inset: 22px;
  background:
    repeating-linear-gradient(155deg, rgba(255, 255, 255, 0.1) 0 12px, rgba(77, 58, 137, 0.14) 12px 24px);
  opacity: 0.5;
}

body[theme="space"] .xandersarcade-planet.planet-b {
  width: 240px;
  height: 240px;
  bottom: -110px;
  left: -70px;
  background:
    radial-gradient(circle at 34% 30%, rgba(255, 255, 255, 0.55), transparent 15%),
    linear-gradient(150deg, #74d0ff 0%, #467eff 42%, #6551d7 74%, #1e2547 100%);
  animation: xandersarcade-float-b 17s ease-in-out infinite;
}

body[theme="space"] .xandersarcade-planet.planet-b::after {
  inset: 42% -12% -18% -12%;
  border-top: 2px solid rgba(255, 224, 130, 0.55);
  border-bottom: 8px solid rgba(123, 199, 255, 0.15);
  transform: rotate(-12deg);
}

body[theme="space"] .xandersarcade-planet.planet-c {
  width: 140px;
  height: 140px;
  top: 24%;
  left: calc(100% - 110px);
  background:
    radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.45), transparent 16%),
    linear-gradient(150deg, #9b7bff 0%, #6a63ff 48%, #2d2b52 100%);
  opacity: 0.88;
  animation: xandersarcade-float-c 19s ease-in-out infinite;
}

@keyframes xandersarcade-twinkle-a {
  0% { opacity: 0.65; transform: translate3d(0, 0, 0) scale(1); }
  50% { opacity: 1; transform: translate3d(-6px, 4px, 0) scale(1.02); }
  100% { opacity: 0.78; transform: translate3d(8px, -3px, 0) scale(0.99); }
}

@keyframes xandersarcade-twinkle-b {
  0% { opacity: 0.35; transform: translate3d(0, 0, 0); }
  50% { opacity: 0.7; transform: translate3d(10px, -8px, 0); }
  100% { opacity: 0.42; transform: translate3d(-10px, 10px, 0); }
}

@keyframes xandersarcade-nebula-drift {
  0% { transform: translate3d(0, 0, 0) scale(1); }
  100% { transform: translate3d(-18px, 14px, 0) scale(1.03); }
}

@keyframes xandersarcade-float-a {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(-10px, 12px, 0); }
}

@keyframes xandersarcade-float-b {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(12px, -10px, 0); }
}

@keyframes xandersarcade-float-c {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(-8px, 8px, 0); }
}

@media (max-width: 900px) {
  body[theme="space"] .xandersarcade-planet.planet-a {
    width: 250px;
    height: 250px;
    top: -95px;
    right: -105px;
  }

  body[theme="space"] .xandersarcade-planet.planet-b {
    width: 200px;
    height: 200px;
    left: -80px;
    bottom: -85px;
  }

  body[theme="space"] .xandersarcade-planet.planet-c {
    width: 112px;
    height: 112px;
    left: calc(100% - 88px);
  }
}
`;
const SPACE_THEME_MARKUP =
  '<div class="xandersarcade-cosmos" data-xandersarcade-cosmos="true" aria-hidden="true"><div class="xandersarcade-starfield layer-a"></div><div class="xandersarcade-starfield layer-b"></div><div class="xandersarcade-nebula"></div><div class="xandersarcade-planet planet-a"></div><div class="xandersarcade-planet planet-b"></div><div class="xandersarcade-planet planet-c"></div></div>';
const OCEAN_THEME_MARKUP =
  '<div class="xandersarcade-ocean-scene" data-xandersarcade-ocean="true" aria-hidden="true"><div class="xandersarcade-jellyfish jelly-a"><div class="xandersarcade-jelly-bell"><div class="xandersarcade-jelly-core"></div></div><div class="xandersarcade-jelly-tentacles"><span></span><span></span><span></span><span></span><span></span></div></div><div class="xandersarcade-jellyfish jelly-b"><div class="xandersarcade-jelly-bell"><div class="xandersarcade-jelly-core"></div></div><div class="xandersarcade-jelly-tentacles"><span></span><span></span><span></span><span></span><span></span></div></div><div class="xandersarcade-jellyfish jelly-c"><div class="xandersarcade-jelly-bell"><div class="xandersarcade-jelly-core"></div></div><div class="xandersarcade-jelly-tentacles"><span></span><span></span><span></span><span></span><span></span></div></div></div>';
const VOLCANIC_THEME_MARKUP =
  '<div class="xandersarcade-volcanic-scene" data-xandersarcade-volcanic="true" aria-hidden="true"><div class="xandersarcade-eclipse-halo"></div><div class="xandersarcade-eclipse-core"></div><div class="xandersarcade-ash-layer ash-a"></div><div class="xandersarcade-ash-layer ash-b"></div><div class="xandersarcade-volcano"><div class="xandersarcade-volcano-cone"></div><div class="xandersarcade-volcano-crater"></div><div class="xandersarcade-volcano-lava"></div><div class="xandersarcade-volcano-plume"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div></div></div>';
const FOREST_THEME_MARKUP =
  '<div class="xandersarcade-forest-scene" data-xandersarcade-forest="true" aria-hidden="true"><div class="xandersarcade-forest-fog fog-a"></div><div class="xandersarcade-forest-fog fog-b"></div><div class="xandersarcade-dead-tree tree-left"><span class="branch b1"></span><span class="branch b2"></span><span class="branch b3"></span><span class="branch b4"></span></div><div class="xandersarcade-dead-tree tree-right"><span class="branch b1"></span><span class="branch b2"></span><span class="branch b3"></span><span class="branch b4"></span></div><div class="xandersarcade-fireflies"><span></span><span></span><span></span><span></span><span></span><span></span></div></div>';
const CAMPFIRE_THEME_MARKUP =
  '<div class="xandersarcade-campfire-scene" data-xandersarcade-campfire="true" aria-hidden="true"><div class="xandersarcade-campfire-glow"></div><div class="xandersarcade-campfire-embers"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><div class="xandersarcade-campfire"><div class="xandersarcade-fire-shadow"></div><div class="xandersarcade-fire-core"></div><div class="xandersarcade-flame flame-a"></div><div class="xandersarcade-flame flame-b"></div><div class="xandersarcade-flame flame-c"></div><div class="xandersarcade-log log-a"></div><div class="xandersarcade-log log-b"></div><div class="xandersarcade-log log-c"></div><div class="xandersarcade-log log-d"></div></div></div>';
const HACKER_BINARY_COLUMNS = [
  ["col-a", "1010101010 0101010110 1010010111 0101010011 1010101010 0110101001 1011010101 0101010101 1010100110 0101011011 1010101001 0101101010 1010101011 0010101010 1011010011 0101010101"],
  ["col-b", "0101010101 1010101001 0101011010 1010010101 0101101010 1010100111 0101010101 1010010110 0101010100 1110101010 0010101011 1010101010 0101010110 1010101001 0101011010 1010010101"],
  ["col-c", "1110101010 0010101011 1010101010 0101101010 1010110101 0101010111 1010101001 0101010100 1011010101 0101010011 1010101110 0101010101 1010011010 0101010100 1110101010 0010101011"],
  ["col-d", "0011010101 1010101110 0101010101 1101010101 0010101010 1011010010 0101010110 1010101011 0101010011 1010101010 0101101011 1010100101 0110101010 1010010101 0101011100 1010101010"],
  ["col-e", "1010010101 0101010101 1010101101 0101010010 1010111010 0101010101 1010010101 0101110101 1010101010 0101010011 1010110101 0101010101 1010010101 0111010101 1001010101 1010100110"],
  ["col-f", "0101010011 1010101010 0101101011 1010100101 0110101010 1010010101 0101011100 1010101010 0101010111 1010101001 0101010100 1110101010 0010101011 1010101010 0101101010 1010110101"],
  ["col-g", "1010101110 0101010101 1010011010 0101010100 1110101010 0010101011 1010101010 0101011010 1010010101 0101101010 1010100111 0101010101 1010010110 0101010100 1110101010 0010101011"],
  ["col-h", "0101110101 1010101010 0101010011 1010110101 0101010101 1010010101 0111010101 1001010101 1010101010 0101010011 1010110101 0101010101 1010010101 0111010101 1001010101 1010100110"],
  ["col-i", "1010101011 0101010010 1010111010 0101010101 1010010101 0101110101 1010101110 0101010101 1010011010 0101010100 1110101010 0010101011 1010101010 0101011010 1010010101 0101101010"],
  ["col-j", "0101011100 1010101010 0101010111 1010101001 0101010100 1110101010 0010101011 1010101010 0101101010 1010110101 0101010111 1010101001 0101010100 1011010101 0101010011 1010101110"],
].map(([columnClass, binaryText]) => ({
  columnClass,
  binaryText: binaryText.split(" ").join("<br>"),
}));
const HACKER_THEME_MARKUP = `<div class="xandersarcade-hacker-scene" data-xandersarcade-hacker="true" aria-hidden="true"><div class="xandersarcade-hacker-grid"></div><div class="xandersarcade-hacker-grid glow-grid"></div><div class="xandersarcade-binary-rain">${HACKER_BINARY_COLUMNS.map(({ columnClass, binaryText }) => `<span class="xandersarcade-binary-column ${columnClass}">${binaryText}</span>`).join("")}</div></div>`;

function sanitizeHtml(content, requestPath) {
  let sanitized = content;
  sanitized = sanitized.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "<title>VoidOS</title>");
  sanitized = sanitized.replace(/<link\b(?=[^>]*\brel=["'][^"']*\bicon\b[^"']*["'])[^>]*>/gi, `<link rel="icon" href="${VOIDOS_ICON_PATH}" type="image/png">`);
  if (!/<link\b(?=[^>]*\brel=["'][^"']*\bicon\b[^"']*["'])/i.test(sanitized)) {
    sanitized = sanitized.replace(/<\/head>/i, `<link rel="icon" href="${VOIDOS_ICON_PATH}" type="image/png"></head>`);
  }
  sanitized = sanitized.replace(
    /<div\b[^>]*(?:class=["'][^"']*panic-btn-div[^"']*["']|id=["']panicDiv["'])[^>]*>[\s\S]*?<\/div>\s*/gi,
    "",
  );
  sanitized = sanitized.replace(
    /<script\b[^>]*>[\s\S]*?(?:posthog|e\.__SV)[\s\S]*?<\/script>\s*/gi,
    "",
  );
  const ensureThemeOption = (html, value, label, anchorRegex) => {
    if (html.includes(`<option value="${value}">`)) {
      return html.replace(
        new RegExp(
          `<option value="${value}">[\\s\\S]*?<\\/option>`,
          "i",
        ),
        `<option value="${value}">${label}</option>`,
      );
    }

    return html.replace(
      anchorRegex,
      `<option value="${value}">${label}</option>$&`,
    );
  };

  sanitized = sanitized.replace(
    /<script\b[^>]*\bsrc=(["'])https?:\/\/(?:www\.)?pagead2\.googlesyndication\.com\/[^"']*\1[^>]*>\s*<\/script>\s*/gi,
    "",
  );

  if (requestPath.includes("/html/games") || requestPath.includes("/science")) {
    sanitized = sanitized.replace(
      /<div class="filters">[\s\S]*?<\/div>\s*/i,
      "",
    );
  }

  if (requestPath === "/" || requestPath.includes("/html/index")) {
    sanitized = sanitized.replace(
      /<div class="shortcuts">[\s\S]*?<\/div>\s*(?=<p class="xandersarcade-credit")/i,
      "",
    );
    sanitized = sanitized.replace(
      /<div[^>]*class="[^"]*\bshortcut-add\b[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
      "",
    );
    sanitized = sanitized.replace(
      /<div[^>]*id="add-shortcut"[^>]*>[\s\S]*?<\/div>/gi,
      "",
    );
    sanitized = sanitized.replace(
      /<div[^>]*class="[^"]*\bshortcuts\b[^"]*"[^>]*>\s*<\/div>/gi,
      "",
    );
  }
  // Remove the inherited social-link footer from every page variant.
  sanitized = sanitized.replace(
    /<div\s+class=["']footer["'][^>]*>[\s\S]*?<\/div>\s*/gi,
    "",
  );
  sanitized = sanitized.replace(
    /<script\b[^>]*\bsrc=(["'])https?:\/\/(?:www\.)?googletagmanager\.com\/gtag\/js\?id=[^"']*\1[^>]*>\s*<\/script>\s*/gi,
    "",
  );
  sanitized = sanitized.replace(
    /<script\b[^>]*\bsrc=(["'])https?:\/\/(?:www\.)?inclinedallusionnearby\.com\/[^"']*\1[^>]*>\s*<\/script>\s*/gi,
    "",
  );
  sanitized = sanitized.replace(
    /<script\b[^>]*\bsrc=(["'])(?:\.\.\/|\/)js\/toastify-js\.js(?:\?v=[^"']*)?\1[^>]*>\s*<\/script>\s*/gi,
    "",
  );
  sanitized = sanitized.replace(
    /<script\b[^>]*\bsrc=(["'])(?:\.\.\/|\/)js\/sweetalert2\.js(?:\?v=[^"']*)?\1[^>]*>\s*<\/script>\s*/gi,
    "",
  );
  sanitized = sanitized.replace(
    /<script\b[^>]*\bsrc=(["'])https?:\/\/cdn\.jsdelivr\.net\/particles\.js\/2\.0\.0\/particles\.min\.js\1[^>]*>\s*<\/script>\s*/gi,
    "",
  );
  sanitized = sanitized.replace(
    /<script\b[^>]*\bsrc=(["'])https?:\/\/[^"']*i\.posthog\.com\/[^"']*\1[^>]*>\s*<\/script>\s*/gi,
    "",
  );
  sanitized = sanitized.replace(
    /<script[^>]*>\s*window\.dataLayer\s*=\s*window\.dataLayer\s*\|\|\s*\[\];[\s\S]*?gtag\((["'])config\1,\s*(["'])[^"']+\2\);\s*<\/script>\s*/gi,
    "",
  );
  sanitized = sanitized.replace(
    /<script[^>]*>\s*\/\/prettier-ignore[\s\S]*?posthog\.init\([\s\S]*?<\/script>\s*/gi,
    "",
  );
  sanitized = sanitized.replace(
    /<script[^>]*>\s*atOptions\s*=\s*\{[\s\S]*?<\/script>\s*/gi,
    "",
  );
  sanitized = sanitized.replace(
    /<div class="side-ad[^"]*">[\s\S]*?<\/div>\s*/gi,
    "",
  );
  sanitized = sanitized.replace(/<div class="ad">[\s\S]*?<\/div>\s*/gi, "");
  sanitized = sanitized.replace(/<div class="promo">[\s\S]*?<\/div>\s*/gi, "");
  sanitized = sanitized.replace(/<p class="ad-info">[\s\S]*?<\/p>\s*/gi, "");
  sanitized = sanitized.replace(
    /<p[^>]*>\s*Join our[\s\S]*?for more links!\s*<\/p>\s*/gi,
    '<p class="xandersarcade-credit" style="color: var(--text-color); opacity: 0.8">Site made by Xander Cruz on a special island &lt;3</p>',
  );
  sanitized = sanitized.replace(
    /<p([^>]*)>\s*Site made by Xander Cruz on a special island <3\s*<\/p>/gi,
    '<p class="xandersarcade-credit"$1>Site made by Xander Cruz on a special island <3</p>',
  );
  sanitized = sanitized.replace(
    /<link\b[^>]*href=(["'])(?:\.\.\/|\/)css\/toastify\.min\.css(?:\?v=[^"']*)?\1[^>]*>\s*/gi,
    "",
  );
  sanitized = sanitized.replace(/\.ad-info\s*\{[\s\S]*?\}\s*/gi, "");
  sanitized = sanitized.replace(/\.promo\s*\{[\s\S]*?\}\s*/gi, "");
  sanitized = sanitized.replace(
    /<ins\b[^>]*adsbygoogle[^>]*>[\s\S]*?<\/ins>\s*/gi,
    "",
  );
  sanitized = sanitized.replace(
    /<div class="footer">[\s\S]*?<\/div>/gi,
    '<div class="footer"></div>',
  );
  sanitized = sanitized.replace(
    /if\s*\(!localStorage\.getItem\("gamesModalShown"\)\)\s*\{[\s\S]*?localStorage\.setItem\("gamesModalShown",\s*"true"\);\s*\}/g,
    "",
  );
  sanitized = sanitized.replace(
    /if\s*\(localStorage\.getItem\("showProxyWarning"\)\s*!==\s*"true"\)\s*\{[\s\S]*?localStorage\.setItem\("showProxyWarning",\s*true\);\s*\}/g,
    "",
  );

  if (
    requestPath.includes("/html/settings") ||
    requestPath.includes("/settings")
  ) {
    sanitized = sanitized.replace(
      /<option value="space">Space OLED\s*\(Default\)<\/option>/gi,
      '<option value="space">Space OLED</option>',
    );
    sanitized = sanitized.replace(
      /<option value="nova">Nova(?:\s*\(Default\))?<\/option>/gi,
      '<option value="nova">Nova (Default)</option>',
    );
    sanitized = sanitized.replace(
      /<option value="flux">Flux(?:\s*\(Default\))?<\/option>/gi,
      '<option value="flux">Flux (Default)</option>',
    );
    sanitized = sanitized.replace(
      /<option value="ocean">Deep Ocean Bioluminescent<\/option>/gi,
      '<option value="ocean">Jellyfish</option>',
    );
    if (!sanitized.includes('<option value="nova">')) {
      sanitized = sanitized.replace(
        /<option value="default">V7 Dark<\/option>/i,
        '<option value="nova">Nova</option><option value="default">V7 Dark</option>',
      );
    }
    if (!sanitized.includes('<option value="flux">')) {
      sanitized = sanitized.replace(
        /<option value="default">V7 Dark<\/option>/i,
        '<option value="flux">Flux (Default)</option><option value="default">V7 Dark</option>',
      );
    }
    if (!sanitized.includes('<option value="space">')) {
      if (sanitized.includes('<option value="flux">Flux (Default)</option>')) {
        sanitized = sanitized.replace(
          /<option value="flux">Flux \(Default\)<\/option>/i,
          '<option value="flux">Flux (Default)</option><option value="space">Space OLED</option>',
        );
      } else {
        sanitized = sanitized.replace(
          /<option value="default">V7 Dark<\/option>/i,
          '<option value="space">Space OLED</option><option value="default">V7 Dark</option>',
        );
      }
    }
    if (!sanitized.includes('<option value="ocean">')) {
      if (sanitized.includes('<option value="space">')) {
        sanitized = sanitized.replace(
          /<option value="space">Space OLED<\/option>/i,
          '<option value="space">Space OLED</option><option value="ocean">Jellyfish</option>',
        );
      } else {
        sanitized = sanitized.replace(
          /<option value="default">V7 Dark<\/option>/i,
          '<option value="ocean">Jellyfish</option><option value="default">V7 Dark</option>',
        );
      }
    }
    if (!sanitized.includes('<option value="volcanic">')) {
      if (sanitized.includes('<option value="ocean">')) {
        sanitized = sanitized.replace(
          /<option value="ocean">Jellyfish<\/option>/i,
          '<option value="ocean">Jellyfish</option><option value="volcanic">Volcanic Eclipse</option>',
        );
      } else {
        sanitized = sanitized.replace(
          /<option value="default">V7 Dark<\/option>/i,
          '<option value="volcanic">Volcanic Eclipse</option><option value="default">V7 Dark</option>',
        );
      }
    }
    if (!sanitized.includes('<option value="forest">')) {
      if (sanitized.includes('<option value="volcanic">')) {
        sanitized = sanitized.replace(
          /<option value="volcanic">Volcanic Eclipse<\/option>/i,
          '<option value="volcanic">Volcanic Eclipse</option><option value="forest">Haunted Forest</option>',
        );
      } else {
        sanitized = sanitized.replace(
          /<option value="default">V7 Dark<\/option>/i,
          '<option value="forest">Haunted Forest</option><option value="default">V7 Dark</option>',
        );
      }
    }
    if (!sanitized.includes('<option value="campfire">')) {
      if (sanitized.includes('<option value="forest">')) {
        sanitized = sanitized.replace(
          /<option value="forest">Haunted Forest<\/option>/i,
          '<option value="forest">Haunted Forest</option><option value="campfire">Campfire Glow</option>',
        );
      } else {
        sanitized = sanitized.replace(
          /<option value="default">V7 Dark<\/option>/i,
          '<option value="campfire">Campfire Glow</option><option value="default">V7 Dark</option>',
        );
      }
    }
    if (!sanitized.includes('<option value="hacker">')) {
      if (sanitized.includes('<option value="campfire">')) {
        sanitized = sanitized.replace(
          /<option value="campfire">Campfire Glow<\/option>/i,
          '<option value="campfire">Campfire Glow</option><option value="hacker">Hacker</option>',
        );
      } else {
        sanitized = sanitized.replace(
          /<option value="default">V7 Dark<\/option>/i,
          '<option value="hacker">Hacker</option><option value="default">V7 Dark</option>',
        );
      }
    }
    if (!sanitized.includes('<option value="v8dark">')) {
      if (sanitized.includes('<option value="hacker">')) {
        sanitized = sanitized.replace(
          /<option value="hacker">Hacker<\/option>/i,
          '<option value="hacker">Hacker</option><option value="v8dark">V8 Dark</option>',
        );
      } else {
        sanitized = sanitized.replace(
          /<option value="default">V7 Dark<\/option>/i,
          '<option value="v8dark">V8 Dark</option><option value="default">V7 Dark</option>',
        );
      }
    }
    if (!sanitized.includes('<option value="midnightoled">')) {
      if (sanitized.includes('<option value="v8dark">')) {
        sanitized = sanitized.replace(
          /<option value="v8dark">V8 Dark<\/option>/i,
          '<option value="v8dark">V8 Dark</option><option value="midnightoled">VSCode</option>',
        );
      } else if (sanitized.includes('<option value="hacker">')) {
        sanitized = sanitized.replace(
          /<option value="hacker">Hacker<\/option>/i,
          '<option value="hacker">Hacker</option><option value="midnightoled">VSCode</option>',
        );
      } else {
        sanitized = sanitized.replace(
          /<option value="default">V7 Dark<\/option>/i,
          '<option value="midnightoled">VSCode</option><option value="default">V7 Dark</option>',
        );
      }
    }
    if (!sanitized.includes('<option value="v8light">')) {
      if (sanitized.includes('<option value="midnightoled">')) {
        sanitized = sanitized.replace(
          /<option value="midnightoled">VSCode<\/option>|<option value="midnightoled">Midnight OLED<\/option>/i,
          '<option value="midnightoled">VSCode</option><option value="v8light">V8 Light</option>',
        );
      } else if (sanitized.includes('<option value="v8dark">')) {
        sanitized = sanitized.replace(
          /<option value="v8dark">V8 Dark<\/option>/i,
          '<option value="v8dark">V8 Dark</option><option value="v8light">V8 Light</option>',
        );
      } else if (sanitized.includes('<option value="light">')) {
        sanitized = sanitized.replace(
          /<option value="light">V7 Light<\/option>/i,
          '<option value="v8light">V8 Light</option><option value="light">V7 Light</option>',
        );
      } else {
        sanitized = sanitized.replace(
          /<option value="default">V7 Dark<\/option>/i,
          '<option value="v8light">V8 Light</option><option value="default">V7 Dark</option>',
        );
      }
    }
    if (!sanitized.includes('<option value="nova">')) {
      if (sanitized.includes('<option value="midnightoled">')) {
        sanitized = sanitized.replace(
          /<option value="midnightoled">VSCode<\/option>/i,
          `<option value="midnightoled">VSCode</option>${EXTRA_THEME_OPTIONS_HTML}${ADDITIONAL_THEME_OPTIONS_HTML}${CLEAN_EXPANDED_THEME_OPTIONS_HTML}${MASS_THEME_OPTIONS_HTML}`,
        );
      } else if (sanitized.includes('<option value="v8dark">')) {
        sanitized = sanitized.replace(
          /<option value="v8dark">V8 Dark<\/option>/i,
          `<option value="v8dark">V8 Dark</option>${EXTRA_THEME_OPTIONS_HTML}${ADDITIONAL_THEME_OPTIONS_HTML}${CLEAN_EXPANDED_THEME_OPTIONS_HTML}${MASS_THEME_OPTIONS_HTML}`,
        );
      } else {
        sanitized = sanitized.replace(
          /<option value="default">V7 Dark<\/option>/i,
          `${EXTRA_THEME_OPTIONS_HTML}${ADDITIONAL_THEME_OPTIONS_HTML}${CLEAN_EXPANDED_THEME_OPTIONS_HTML}${MASS_THEME_OPTIONS_HTML}<option value="default">V7 Dark</option>`,
        );
      }
    }
    sanitized = sanitized.replace(
      /<option value="libcurl">Libcurl \(Default\)<\/option>\s*<option value="epoxy">Epoxy<\/option>\s*<option value="bare">Bare Server<\/option>/i,
      '<option value="bare">Bare Server (Default)</option><option value="epoxy">Epoxy</option><option value="libcurl">Libcurl</option>',
    );
    sanitized = sanitized.replace(
      /<option value="ultraviolet">Ultraviolet \(Default\)<\/option>\s*<option value="scramjet">Scramjet \(Experimental\)<\/option>/i,
      '<option value="ultraviolet">Ultraviolet (Default)</option><option value="scramjet">Scramjet (Experimental)</option>',
    );
    for (const [value, rawLabel] of REQUIRED_THEME_OPTIONS) {
      const label = rawLabel.replace(/^[^—]+—\s*/, "");
      sanitized = ensureThemeOption(
        sanitized,
        value,
        label,
        /<option value="default">V7 Dark<\/option>/i,
      );
    }
  }

  if (requestPath.includes("/go")) {
    sanitized = sanitized.replace(
      /<i class="fa-solid fa-plus"><\/i>/gi,
      '<i data-lucide="plus" class="xandersarcade-go-icon"></i>',
    );
    sanitized = sanitized.replace(
      /<i class="fa-solid fa-arrow-left"><\/i>/gi,
      '<i data-lucide="arrow-left" class="xandersarcade-go-icon"></i>',
    );
    sanitized = sanitized.replace(
      /<i class="fa-solid fa-arrow-right"><\/i>/gi,
      '<i data-lucide="arrow-right" class="xandersarcade-go-icon"></i>',
    );
    sanitized = sanitized.replace(
      /<i class="fa-solid fa-rotate-right"><\/i>/gi,
      '<i data-lucide="refresh-cw" class="xandersarcade-go-icon"></i>',
    );
    sanitized = sanitized.replace(
      /<i class="fa-solid fa-house"><\/i>/gi,
      '<i data-lucide="house" class="xandersarcade-go-icon"></i>',
    );
    sanitized = sanitized.replace(
      /<i class="fa-solid fa-maximize"><\/i>/gi,
      '<i data-lucide="maximize" class="xandersarcade-go-icon"></i>',
    );
    sanitized = sanitized.replace(
      /<i class="fa-solid fa-code"><\/i>/gi,
      '<i data-lucide="code" class="xandersarcade-go-icon"></i>',
    );
    sanitized = sanitized.replace(
      /<i class="fa-solid fa-x close"><\/i>/gi,
      '<i data-lucide="x" class="close xandersarcade-go-icon"></i>',
    );
  }

  sanitized = sanitized.replace(
    /((?:\.\.\/|\/)js\/(?:home|nav|main|settings|apps|games)\.js)(?!\?v=)/gi,
    `$1?v=${ASSET_VERSION}`,
  );
  sanitized = sanitized.replace(
    /((?:\.\.\/|\/)(?:uv|sj)\/register-sw\.js)(?!\?v=)/gi,
    `$1?v=${ASSET_VERSION}`,
  );
  sanitized = sanitized.replace(
    /((?:\.\.\/|\/)(?:uv\/proxy|uv\/search|sj\/index|sj\/search|baremux\/index)\.js)(?!\?v=)/gi,
    `$1?v=${ASSET_VERSION}`,
  );
  sanitized = sanitized.replace(
    /((?:\.\.\/|\/)scram\/scramjet\.all\.js)(?!\?v=)/gi,
    `$1?v=${ASSET_VERSION}`,
  );
  sanitized = sanitized.replace(
    /((?:\.\.\/|\/)css\/(?:theme|main|toastify\.min)\.css)(?!\?v=)/gi,
    `$1?v=${ASSET_VERSION}`,
  );

  if (
    !requestPath.includes("/go") &&
    !sanitized.includes("data-xandersarcade-shell-refresh")
  ) {
    sanitized = sanitized.replace("</head>", `${SHELL_REFRESH_SCRIPT}</head>`);
  }

  if (!sanitized.includes("data-xandersarcade-app-install")) {
    sanitized = sanitized.replace("</head>", `${APP_INSTALL_SCRIPT}</head>`);
  }

  if (!sanitized.match(/<link\b[^>]*rel=["']manifest["']/i)) {
    sanitized = sanitized.replace("</head>", `${APP_MANIFEST_LINK}</head>`);
  }

  if (!sanitized.includes("data-xandersarcade-cleanup")) {
    sanitized = sanitized.replace("</head>", `${PROXY_CLEANUP_STYLE}</head>`);
  }

  if (
    (requestPath === "/" || requestPath.includes("/html/index")) &&
    !sanitized.includes("data-xandersarcade-home-search")
  ) {
    sanitized = sanitized.replace("</head>", `${HOME_SEARCH_STYLE}</head>`);
  }

  if (!sanitized.includes("data-xandersarcade-theme-bootstrap")) {
    sanitized = sanitized.replace("</head>", `${THEME_BOOTSTRAP_SCRIPT}</head>`);
  }

  if (
    (requestPath.includes("/html/go") || requestPath.includes("/go")) &&
    !sanitized.includes("data-xandersarcade-go-cleanup")
  ) {
    sanitized = sanitized.replace("</head>", `${GO_TAB_CLEANUP_STYLE}</head>`);
  }


  if (!sanitized.includes("data-xandersarcade-space-theme")) {
    sanitized = sanitized.replace(
      "</head>",
      `<style data-xandersarcade-space-theme="true">${SPACE_THEME_STYLE}</style></head>`,
    );
  }

  if (!sanitized.includes("data-xandersarcade-lucide-style")) {
    sanitized = sanitized.replace("</head>", `${LUCIDE_STYLE}</head>`);
  }

  if (!sanitized.includes("data-xandersarcade-cosmos")) {
    sanitized = sanitized.replace(
      /<body([^>]*)>/i,
      `<body$1>${SPACE_THEME_MARKUP}${OCEAN_THEME_MARKUP}${VOLCANIC_THEME_MARKUP}${FOREST_THEME_MARKUP}${CAMPFIRE_THEME_MARKUP}${HACKER_THEME_MARKUP}`,
    );
  }

  if (!sanitized.includes("data-xandersarcade-lucide-override")) {
    sanitized = sanitized.replace(
      "</body>",
      `${LUCIDE_SCRIPT}${LUCIDE_ICON_OVERRIDE}</body>`,
    );
  }

  if (!sanitized.includes("data-xandersarcade-branding")) {
    sanitized = sanitized.replace(
      "</body>",
      `${BRANDING_SCRIPT}</body>`,
    );
  }

  if (
    (requestPath.includes("/html/more") || requestPath.includes("/more")) &&
    !sanitized.includes("data-xandersarcade-more-cleanup")
  ) {
    sanitized = sanitized.replace(
      "</body>",
      `${MORE_TAB_CLEANUP_SCRIPT}</body>`,
    );
  }

  if (
    (requestPath.includes("/html/settings") || requestPath.includes("/settings")) &&
    !sanitized.includes("data-xandersarcade-settings-cleanup")
  ) {
    sanitized = sanitized.replace(
      "</body>",
      `${SETTINGS_OTHER_CLEANUP_SCRIPT}</body>`,
    );
  }

  return sanitized;
}

function sanitizeJavaScript(content, requestPath) {
  if (requestPath.includes("/js/main.js")) {
    return readCachedTextFile(path.join(staticPath, "js", "main.js"), {
      cacheKeySuffix: "js:main",
    });
  }

  if (requestPath.includes("/js/settings.js")) {
    return readCachedTextFile(path.join(staticPath, "js", "settings.js"), {
      cacheKeySuffix: "js:settings",
    });
  }

  if (requestPath.includes("/js/games.js")) {
    return readCachedTextFile(path.join(staticPath, "js", "games.js"), {
      cacheKeySuffix: "js:games",
    });
  }

  if (requestPath.includes("/js/home.js")) {
    return readCachedTextFile(path.join(staticPath, "js", "home.js"), {
      cacheKeySuffix: "js:home",
    });
  }

  if (requestPath.includes("/js/nav.js")) {
    return readCachedTextFile(path.join(staticPath, "js", "nav.js"), {
      cacheKeySuffix: "js:nav",
    });
  }

  let sanitized = content;

  sanitized = sanitized.replace(
    /if\s*\(\s*window\.localStorage\.getItem\("disableTips"\)[\s\S]*?Toastify\(\{[\s\S]*?\}\)\.showToast\(\);\s*\}/g,
    "",
  );
  sanitized = sanitized.replace(
    /if\s*\(localStorage\.getItem\("v7toast"\)\s*!==\s*"true"\)\s*\{[\s\S]*?localStorage\.setItem\("v7toast",\s*true\);\s*\}/g,
    "",
  );
  sanitized = sanitized.replace(
    /\/\/\s*Announcements modal[\s\S]*?localStorage\.setItem\("lastAnnouncement",\s*currentAnnouncement\);\s*\}\);\s*\}/g,
    "",
  );

  sanitized = sanitized.replace(
    /localStorage\.setItem\("proxy-backend",\s*"ultraviolet"\);/g,
    `localStorage.setItem("proxy-backend", "${DEFAULT_PROXY_BACKEND}");`,
  );
  sanitized = sanitized.replace(
    /\/\/ const transport = localStorage\.getItem\("proxyTransport"\);[\s\S]*?\/\/   localStorage\.setItem\("proxyTransport", "libcurl"\);\s*\/\/ }/g,
    `const transport = localStorage.getItem("transport");

  if (!transport) {
    localStorage.setItem("transport", "${DEFAULT_PROXY_TRANSPORT}");
    if (typeof window.setTransport === "function") {
      window.setTransport("${DEFAULT_PROXY_TRANSPORT}");
    }
  }`,
  );
  sanitized = sanitized.replace(
    /v7 - /g,
    "v9 - ",
  );
  sanitized = sanitized.replace(
    /Welcome To \\u004C\\u0075\\u006E\\u0061\\u0061\\u0072 V7/g,
    "Welcome To \\u004C\\u0075\\u006E\\u0061\\u0061\\u0072 V9",
  );

  if (requestPath.includes("/uv/register-sw.js")) {
    sanitized = sanitized.replace(
      /const stockSW = "\/uv\/sw\.js";/,
      `const stockSW = "/uv/sw.js?v=${ASSET_VERSION}";`,
    );
  }

  if (requestPath.includes("/sj/register-sw.js")) {
    sanitized = sanitized.replace(
      /const sjStockSW = "\.\/sw\.js";/,
      `const sjStockSW = "./sw.js?v=${ASSET_VERSION}";`,
    );
  }

  if (requestPath.includes("/js/main.js")) {
    sanitized = sanitized.replace(
      /theme = "default";/g,
      `theme = "${DEFAULT_THEME}";`,
    );
    sanitized = sanitized.replace(
      /document\.addEventListener\("DOMContentLoaded", \(\) => \{/,
      `document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("${DEFAULTS_MIGRATION_KEY}") !== "${DEFAULTS_MIGRATION_VALUE}") {
    localStorage.setItem("proxy-backend", "${DEFAULT_PROXY_BACKEND}");
    localStorage.setItem("transport", "${DEFAULT_PROXY_TRANSPORT}");
    localStorage.setItem("${DEFAULTS_MIGRATION_KEY}", "${DEFAULTS_MIGRATION_VALUE}");
    if (typeof window.setTransport === "function") {
      window.setTransport("${DEFAULT_PROXY_TRANSPORT}");
    }
  }`,
    );
    sanitized = sanitized.replace(
      /`<a class="link footer-version" href="https:\/\/github\.com\/&#x70;&#x61;&#x72;&#x63;&#x6f;&#x69;&#x6c;\/&#x6c;&#x75;&#x6e;&#x61;&#x61;&#x72;\.org"> v\$\{ver\.version\}<\/a>`/,
      `\`<a class="link footer-version"> v${DISPLAY_VERSION}</a>\``,
    );
  }

  if (requestPath.includes("/js/settings.js")) {
    sanitized = sanitized.replace(
      /document\.addEventListener\("DOMContentLoaded", \(\) => \{/,
      `document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("${DEFAULTS_MIGRATION_KEY}") !== "${DEFAULTS_MIGRATION_VALUE}") {
    localStorage.setItem("proxy-backend", "${DEFAULT_PROXY_BACKEND}");
    localStorage.setItem("transport", "${DEFAULT_PROXY_TRANSPORT}");
    localStorage.setItem("${DEFAULTS_MIGRATION_KEY}", "${DEFAULTS_MIGRATION_VALUE}");
  }`,
    );
    sanitized = sanitized.replace(
      /if \(proxyBackend\) \{\s*proxyBackendToggle\.value = proxyBackend;\s*\}/,
      `if (proxyBackend) {
    proxyBackendToggle.value = proxyBackend;
  } else {
    proxyBackendToggle.value = "${DEFAULT_PROXY_BACKEND}";
    localStorage.setItem("proxy-backend", "${DEFAULT_PROXY_BACKEND}");
  }`,
    );
    sanitized = sanitized.replace(
      /if \(proxyTransportValue\) \{\s*proxyTransport\.value = proxyTransportValue;\s*\}/,
      `if (proxyTransportValue) {
    proxyTransport.value = proxyTransportValue;
  } else {
    proxyTransport.value = "${DEFAULT_PROXY_TRANSPORT}";
    localStorage.setItem("transport", "${DEFAULT_PROXY_TRANSPORT}");
    if (typeof window.setTransport === "function") {
      window.setTransport("${DEFAULT_PROXY_TRANSPORT}");
    }
  }`,
    );
  }

  return sanitized;
}

function sanitizeCss(content, requestPath) {
  if (requestPath.includes("/css/theme.css")) {
    return readCachedTextFile(path.join(staticPath, "css", "theme.css"), {
      cacheKeySuffix: "css:theme",
    });
  }

  if (requestPath.includes("/css/main.css")) {
    return readCachedTextFile(path.join(staticPath, "css", "main.css"), {
      cacheKeySuffix: "css:main",
    });
  }

  return content;
}

function sanitizeJson(content, requestPath) {
  if (!requestPath.includes("/json/games")) {
    return content;
  }

  let sanitized = content;

  sanitized = sanitized.replace(
    /"name":\s*"Five Nights at Epstiens"/gi,
    `"name": "${FIVE_NIGHTS_AT_EPSTEINS_NAME}"`,
  );
  sanitized = sanitized.replace(
    /"url":\s*"https:\/\/harshulmoon\.github\.io\/fnae\.html"/g,
    `"url": "${FIVE_NIGHTS_AT_EPSTEINS_URL}"`,
  );

  return sanitized;
}

function sanitizeUpstreamResponse(responseBuffer, proxyRes, req) {
  const contentType = String(
    proxyRes.headers["content-type"] || "",
  ).toLowerCase();
  const requestPath = req.path || req.url || "";

  if (contentType.includes("text/html")) {
    return sanitizeHtml(responseBuffer.toString("utf8"), requestPath);
  }

  if (
    contentType.includes("javascript") ||
    requestPath.endsWith(".js") ||
    requestPath.includes("/js/")
  ) {
    const sanitized = sanitizeJavaScript(
      responseBuffer.toString("utf8"),
      requestPath,
    );
    cacheRewrittenAsset(req, proxyRes, sanitized);
    return sanitized;
  }

  if (
    contentType.includes("text/css") ||
    requestPath.endsWith(".css") ||
    requestPath.includes("/css/")
  ) {
    const sanitized = sanitizeCss(responseBuffer.toString("utf8"), requestPath);
    cacheRewrittenAsset(req, proxyRes, sanitized);
    return sanitized;
  }

  if (contentType.includes("application/json") || requestPath.includes("/json/")) {
    const sanitized = sanitizeJson(responseBuffer.toString("utf8"), requestPath);
    cacheRewrittenAsset(req, proxyRes, sanitized);
    return sanitized;
  }

  return responseBuffer;
}

function serveFallback(res, errorMessage) {
  if (fallbackHtml) {
    res.writeHead(502, { "Content-Type": "text/html; charset=UTF-8" });
    res.end(
      fallbackHtml.replace("{{ERROR_MESSAGE}}", errorMessage || "Upstream error"),
    );
    return;
  }

  res.writeHead(502, { "Content-Type": "text/plain; charset=UTF-8" });
  res.end(errorMessage || "Upstream error");
}

function shouldUseNoStoreCacheControl(cacheControl = "") {
  return /no-store|no-cache/i.test(String(cacheControl));
}

function applyCacheHeadersToObject(headers, cacheControl) {
  if (!cacheControl) {
    return;
  }

  headers["cache-control"] = cacheControl;

  if (shouldUseNoStoreCacheControl(cacheControl)) {
    headers.pragma = "no-cache";
    headers.expires = "0";
    return;
  }

  delete headers.pragma;
  delete headers.expires;
}

function applyCacheHeadersToResponse(res, cacheControl) {
  if (!cacheControl || !res || res.headersSent) {
    return;
  }

  res.setHeader("Cache-Control", cacheControl);

  if (shouldUseNoStoreCacheControl(cacheControl)) {
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return;
  }

  res.removeHeader("Pragma");
  res.removeHeader("Expires");
}

function readCachedBinaryFile(absolutePath) {
  const stat = fs.statSync(absolutePath);
  const cacheKey = `bin:${absolutePath}`;
  const cached = localBinaryCache.get(cacheKey);

  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.content;
  }

  const content = fs.readFileSync(absolutePath);
  localBinaryCache.set(cacheKey, {
    mtimeMs: stat.mtimeMs,
    content,
  });
  return content;
}

function sendLocalFile(req, res, absolutePath, contentType) {
  if (!fs.existsSync(absolutePath)) {
    res.status(404).type("text/plain").send("Not found");
    return;
  }

  const cacheControl = isVersionedAssetRequest(req.originalUrl || req.url || "")
    ? IMMUTABLE_CACHE_CONTROL
    : NO_STORE_CACHE_CONTROL;
  const content = readCachedBinaryFile(absolutePath);

  applyCacheHeadersToResponse(res, cacheControl);
  if (contentType) {
    res.type(contentType);
  }
  res.send(content);
}

function readCachedTextFile(
  absolutePath,
  { cacheKeySuffix = "raw", transform = null } = {},
) {
  const stat = fs.statSync(absolutePath);
  const cacheKey = `${cacheKeySuffix}:${absolutePath}`;
  const cached = localTextCache.get(cacheKey);

  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.content;
  }

  const source = fs.readFileSync(absolutePath, "utf8");
  const content = typeof transform === "function" ? transform(source) : source;
  localTextCache.set(cacheKey, {
    mtimeMs: stat.mtimeMs,
    content,
  });
  return content;
}

function versionLocalHtmlAssets(content) {
  let html = content;

  html = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "<title>VoidOS</title>");
  html = html.replace(/<link\b(?=[^>]*\brel=["'][^"']*\bicon\b[^"']*["'])[^>]*>/gi, `<link rel="icon" href="${VOIDOS_ICON_PATH}" type="image/png">`);
  if (!/<link\b(?=[^>]*\brel=["'][^"']*\bicon\b[^"']*["'])/i.test(html)) {
    html = html.replace(/<\/head>/i, `<link rel="icon" href="${VOIDOS_ICON_PATH}" type="image/png"></head>`);
  }

  html = html.replace(
    /(?:\.\.\/|\.\/)?media\/logo\.svg|\/media\/logo\.svg/gi,
    BRAND_LOGO_PATH,
  );

  html = html.replace(
    /<div\b[^>]*(?:class=["'][^"']*panic-btn-div[^"']*["']|id=["']panicDiv["'])[^>]*>[\s\S]*?<\/div>\s*/gi,
    "",
  );

  // Analytics is not used by this fork. Removing the inline loader avoids a
  // blocking third-party request and several hundred KB of startup work.
  html = html.replace(
    /<script\b[^>]*>[\s\S]*?(?:posthog|e\.__SV)[\s\S]*?<\/script>\s*/gi,
    "",
  );

  html = html.replace(
    /<script\s+src="\/js\/shell-refresh\.js"><\/script>/gi,
    "",
  );

  html = html.replace(
    /((?:href|src)="\/(?:css\/theme\.css|css\/main\.css|css\/toastify\.min\.css|js\/cloak\.js|js\/nav\.js|js\/main\.js|js\/toastify-js\.js|js\/sweetalert2\.js|media\/logo\.svg))(?!\?v=)/gi,
    `$1?v=${ASSET_VERSION}`,
  );

  if (!html.includes('data-xandersarcade-shell-refresh="true"')) {
    html = html.replace("</head>", `${SHELL_REFRESH_SCRIPT}</head>`);
  }

  if (!html.includes("/js/app-install.js")) {
    html = html.replace("</head>", `${APP_INSTALL_SCRIPT}</head>`);
  }

  if (!html.match(/<link\b[^>]*rel=["']manifest["']/i)) {
    html = html.replace("</head>", `${APP_MANIFEST_LINK}</head>`);
  }

  if (!html.includes("data-xandersarcade-lucide-style")) {
    html = html.replace("</head>", `${LUCIDE_STYLE}</head>`);
  }

  if (!html.includes("data-xandersarcade-lucide=\"true\"")) {
    html = html.replace("</head>", `${LUCIDE_SCRIPT}</head>`);
  }

  if (!html.includes("data-xandersarcade-lucide-override")) {
    html = html.replace("</body>", `${LUCIDE_ICON_OVERRIDE}</body>`);
  }

  if (!html.includes("data-xandersarcade-branding=")) {
    html = html.replace("</body>", `${BRANDING_SCRIPT}</body>`);
  }

  return html;
}

function sendLocalHtml(res, absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    res.status(404).type("text/plain").send("Not found");
    return;
  }

  const content = readCachedTextFile(absolutePath, {
    cacheKeySuffix: `html:${ASSET_VERSION}`,
    transform: versionLocalHtmlAssets,
  });
  applyCacheHeadersToResponse(res, NO_STORE_CACHE_CONTROL);
  res.type("html");
  res.send(content);
}

function getStoredCookieHeader() {
  if (storedCookies.size === 0) {
    return "";
  }

  return Array.from(storedCookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function persistProxyCookies(proxyRes) {
  const cookies = proxyRes.headers["set-cookie"];
  if (!Array.isArray(cookies)) {
    return;
  }

  for (const cookieStr of cookies) {
    const pair = cookieStr.split(";", 1)[0];
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const name = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1);
    if (name) {
      storedCookies.set(name, value);
    }
  }
}

function isHtmlRequest(requestPath = "") {
  return SHELL_HTML_ROUTES.has(requestPath) || requestPath.startsWith("/html/");
}

function isVersionedAssetRequest(requestUrl = "") {
  return requestUrl.includes(`?v=${ASSET_VERSION}`);
}

function isServiceWorkerRequest(requestPath = "") {
  return SERVICE_WORKER_ROUTES.has(requestPath);
}

function getProxyPath(requestUrl = "") {
  const [pathname, search = ""] = requestUrl.split("?");
  const aliasedPath = SHELL_ROUTE_ALIASES.get(pathname) || pathname;
  return search ? `${aliasedPath}?${search}` : aliasedPath;
}

function shouldRewriteRequest(requestPath = "") {
  return (
    isHtmlRequest(requestPath) ||
    requestPath.startsWith("/js/") ||
    requestPath === "/css/theme.css" ||
    requestPath === "/css/main.css" ||
    requestPath === "/uv/register-sw.js" ||
    requestPath === "/sj/register-sw.js" ||
    requestPath.includes("/json/games")
  );
}

function getRewrittenAssetType(requestPath = "") {
  if (
    requestPath.endsWith(".js") ||
    requestPath.includes("/js/") ||
    requestPath === "/uv/register-sw.js" ||
    requestPath === "/sj/register-sw.js"
  ) {
    return "javascript";
  }

  if (requestPath.endsWith(".css") || requestPath.includes("/css/")) {
    return "css";
  }

  if (requestPath.includes("/json/")) {
    return "json";
  }

  return null;
}

function pruneRewrittenAssetCache() {
  while (rewrittenAssetCache.size > REWRITTEN_ASSET_CACHE_LIMIT) {
    const oldestKey = rewrittenAssetCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    rewrittenAssetCache.delete(oldestKey);
  }
}

function getRewrittenAssetCacheKey(req) {
  return `${ASSET_VERSION}:${req.originalUrl || req.url || ""}`;
}

function getCachedRewrittenAsset(req) {
  const cacheKey = getRewrittenAssetCacheKey(req);
  const cached = rewrittenAssetCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    rewrittenAssetCache.delete(cacheKey);
    return null;
  }

  rewrittenAssetCache.delete(cacheKey);
  rewrittenAssetCache.set(cacheKey, cached);
  return cached;
}

function cacheRewrittenAsset(req, proxyRes, content) {
  if (req.method !== "GET") {
    return;
  }

  const requestPath = req.path || req.url || "";
  if (isHtmlRequest(requestPath) || isServiceWorkerRequest(requestPath)) {
    return;
  }

  const assetType = getRewrittenAssetType(requestPath);
  const ttlMs = REWRITTEN_ASSET_CACHE_TTL_MS[assetType];
  if (!ttlMs || proxyRes.statusCode !== 200) {
    return;
  }

  const cacheKey = getRewrittenAssetCacheKey(req);
  const body = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");

  rewrittenAssetCache.set(cacheKey, {
    body,
    contentType: proxyRes.headers["content-type"] || null,
    cacheControl: proxyRes.headers["cache-control"] || null,
    expiresAt: Date.now() + ttlMs,
  });
  pruneRewrittenAssetCache();
}

function applyProxyHeaders(req, proxyRes, res, { rewritten = false } = {}) {
  const requestPath = req.path || req.url || "";
  const requestUrl = req.originalUrl || req.url || "";
  let cacheControl = null;

  if (isHtmlRequest(requestPath) || isServiceWorkerRequest(requestPath)) {
    cacheControl = NO_STORE_CACHE_CONTROL;
  } else if (isVersionedAssetRequest(requestUrl)) {
    cacheControl = IMMUTABLE_CACHE_CONTROL;
  } else if (requestPath.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/)) {
    cacheControl = "public, max-age=86400, immutable";
  }

  if (cacheControl) {
    applyCacheHeadersToObject(proxyRes.headers, cacheControl);
    applyCacheHeadersToResponse(res, cacheControl);
  }

  if (rewritten) {
    delete proxyRes.headers.etag;
    delete proxyRes.headers["last-modified"];
    delete proxyRes.headers["content-length"];
    if (res && !res.headersSent) {
      res.removeHeader("ETag");
      res.removeHeader("Last-Modified");
    }
  }
}

function handleProxyRequest(proxyReq) {
  const cookieHeader = getStoredCookieHeader();
  if (cookieHeader) {
    proxyReq.setHeader("cookie", cookieHeader);
  }
}

function handleProxyError(err, req, res) {
  console.error("Proxy error:", err.message);
  serveFallback(res, err.message);
}

const passthroughProxy = createProxyMiddleware({
  target,
  agent: upstreamAgent,
  changeOrigin: true,
  pathRewrite: (path) => getProxyPath(path),
  ws: true,
  xfwd: true,
  onProxyReq: handleProxyRequest,
  onProxyRes(proxyRes, req, res) {
    persistProxyCookies(proxyRes);
    applyProxyHeaders(req, proxyRes, res);
  },
  onError: handleProxyError,
  proxyTimeout: 30000,
  timeout: 30000,
});

const rewriteProxy = createProxyMiddleware({
  target,
  agent: upstreamAgent,
  changeOrigin: true,
  pathRewrite: (path) => getProxyPath(path),
  ws: true,
  xfwd: true,
  selfHandleResponse: true,
  onProxyReq: handleProxyRequest,
  onProxyRes(proxyRes, req, res) {
    persistProxyCookies(proxyRes);
    applyProxyHeaders(req, proxyRes, res, { rewritten: true });
  },
  on: {
    proxyRes: responseInterceptor((responseBuffer, proxyRes, req) =>
      sanitizeUpstreamResponse(responseBuffer, proxyRes, req),
    ),
  },
  onError: handleProxyError,
  proxyTimeout: 30000,
  timeout: 30000,
});

app.get("/js/shell-refresh.js", (req, res) => {
  sendLocalFile(req, res, shellRefreshScriptPath, "application/javascript");
});

app.get("/js/app-install.js", (req, res) => {
  sendLocalFile(req, res, appInstallScriptPath, "application/javascript");
});

app.get("/app-manifest.json", (req, res) => {
  sendLocalFile(req, res, appManifestPath, "application/manifest+json");
});

app.get("/app-sw.js", (req, res) => {
  sendLocalFile(req, res, appServiceWorkerPath, "application/javascript");
});

app.get("/app-launcher.html", (_req, res) => {
  sendLocalFile(_req, res, appLauncherPath, "text/html");
});

app.get("/app-frame.html", (_req, res) => {
  sendLocalHtml(res, appFramePath);
});

const LOCAL_SHELL_FILES = new Map([
  ["/", path.join(staticPath, "html", "index.html")],
  ["/science", path.join(staticPath, "html", "games.html")],
  ["/math", path.join(staticPath, "html", "apps.html")],
  ["/themes", path.join(staticPath, "html", "themes.html")],
  ["/admin", path.join(staticPath, "html", "admin.html")],
  ["/settings", path.join(staticPath, "html", "settings.html")],
  ["/more", path.join(staticPath, "html", "more.html")],
  ["/account", path.join(staticPath, "html", "account.html")],
  ["/forum", path.join(staticPath, "html", "forum.html")],
  ["/tos", path.join(staticPath, "html", "tos.html")],
  ["/new", path.join(staticPath, "html", "new.html")],
]);

for (const [route, filePath] of LOCAL_SHELL_FILES) {
  app.get(route, (_req, res) => sendLocalHtml(res, filePath));
}

app.get("/json/apps.json", (req, res) => {
  sendLocalFile(req, res, appsJsonPath, "application/json");
});

app.get("/json/games.json", (req, res) => {
  sendLocalFile(req, res, gamesJsonPath, "application/json");
});

app.get("/json/games-local.json", (req, res) => {
  sendLocalFile(req, res, gamesLocalJsonPath, "application/json");
});

app.get(["/go", "/html/go.html"], (_req, res) => {
  const html = readCachedTextFile(goHtmlPath, { cacheKeySuffix: "html:go" });
  applyCacheHeadersToResponse(res, NO_STORE_CACHE_CONTROL);
  res.type("html").send(html);
});

app.get("/html/account.html", (_req, res) =>
  sendLocalHtml(res, path.join(staticPath, "html", "account.html")),
);

app.get("/json/freebuisness-html-map.json", (req, res) => {
  sendLocalFile(req, res, freebuisnessHtmlMapPath, "application/json");
});

app.get("/api/version", (_req, res) => {
  applyCacheHeadersToResponse(res, NO_STORE_CACHE_CONTROL);
  res.json({ version: DISPLAY_VERSION, build: ASSET_VERSION });
});

app.use(
  [
    "/account",
    "/users",
    "/html/users.html",
    "/js/users.js",
    "/api/auth",
  ],
  (_req, res) => res.status(404).type("text/plain").send("Not found"),
);

for (const assetDirectory of [
  "css",
  "js",
  "media",
  "sj",
  "uv",
  "baremux",
  "scram",
]) {
  app.use(
    `/${assetDirectory}`,
    express.static(path.join(staticPath, assetDirectory), {
      fallthrough: true,
      setHeaders: (res) => {
        // HTML adds the current build id to local assets. Let browsers reuse
        // those immutable URLs while keeping unversioned development assets
        // immediately fresh.
        const requestUrl = res.req?.originalUrl || res.req?.url || "";
        applyCacheHeadersToResponse(
          res,
          isVersionedAssetRequest(requestUrl)
            ? IMMUTABLE_CACHE_CONTROL
            : NO_STORE_CACHE_CONTROL,
        );
      },
    }),
  );
}

app.use((req, res, next) => {
  if (
    req.method !== "GET" ||
    !shouldRewriteRequest(req.path) ||
    isHtmlRequest(req.path) ||
    isServiceWorkerRequest(req.path)
  ) {
    next();
    return;
  }

  const cached = getCachedRewrittenAsset(req);
  if (!cached) {
    next();
    return;
  }

  if (cached.contentType) {
    res.type(cached.contentType);
  }
  applyCacheHeadersToResponse(res, cached.cacheControl);
  res.send(cached.body);
});

app.use((req, res, next) => {
  if (shouldRewriteRequest(req.path)) {
    rewriteProxy(req, res, next);
    return;
  }

  passthroughProxy(req, res, next);
});

const port = Number.parseInt(process.env.PORT || "3000", 10);

const server = app.listen(port, () => {
  console.log(`Reverse proxy running at http://localhost:${port}`);
  console.log(`Forwarding requests to ${target}`);
});

server.on("upgrade", passthroughProxy.upgrade);
