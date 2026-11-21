// ==UserScript==
// @name         Emby landscape Cards - High Quality Res
// @namespace    emby-high-q-thumbs-mub
// @version      2.0
// @description  Makes the emby landscape cards that sometimes are blurry, be little bit more quality.
// @match        <replace with full domain, eg https://emby.media>/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  if (window.embyHiResObserver) return;

  // raise to 2 for crisper, heavier images
  const oversample = 1.5;
  const jpegQuality = 95;
  const maxRequestWidth = 1920;
  const minLandscapeRatio = 1.2;
  const pixelRatio = Math.max(window.devicePixelRatio, 1);
  const cardImagePath = /\/Images\/(Primary|Backdrop|Thumb)/;

  // one measure per row cuz every card in a row is the same size
  let rowWidths = new WeakMap();

  function getLandscapeWidth(cardImage) {
    const row = cardImage.closest(".itemsContainer") ?? cardImage.parentElement;
    if (rowWidths.has(row)) return rowWidths.get(row);

    const { width, height } = cardImage.getBoundingClientRect();
    if (!width || !height) return;

    const landscapeWidth = width / height >= minLandscapeRatio ? width : 0;
    rowWidths.set(row, landscapeWidth);
    return landscapeWidth;
  }

  function upgradeCardImage(cardImage) {
    const src = cardImage.getAttribute("src");
    if (!src || !cardImagePath.test(src)) return;

    const landscapeWidth = getLandscapeWidth(cardImage);
    if (!landscapeWidth) return;

    const imageUrl = new URL(src, location.href);
    const { searchParams } = imageUrl;
    const requestedWidth = Number.parseInt(searchParams.get("maxWidth") ?? searchParams.get("width"), 10);
    const wantedWidth = Math.min(maxRequestWidth, Math.round(landscapeWidth * pixelRatio * oversample));

    // already big enough eg hero backdrops, or already upgraded
    if (requestedWidth >= landscapeWidth * pixelRatio && !searchParams.has("maxHeight")) return;

    // portrait height limits are what kill the quality on landscape cards
    searchParams.delete("maxHeight");
    searchParams.delete("height");
    searchParams.delete("width");
    searchParams.set("maxWidth", wantedWidth);
    searchParams.set("quality", jpegQuality);
    cardImage.setAttribute("src", `${imageUrl.pathname}${imageUrl.search}`);
  }

  function upgradeImagesIn(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches("img.cardImage")) return upgradeCardImage(node);
    for (const cardImage of node.querySelectorAll("img.cardImage")) {
      upgradeCardImage(cardImage);
    }
  }

  function handleMutations(mutations) {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") upgradeImagesIn(mutation.target);
      mutation.addedNodes.forEach((addedNode) => upgradeImagesIn(addedNode));
    }
  }

  window.addEventListener("resize", () => (rowWidths = new WeakMap()));

  upgradeImagesIn(document.body);

  window.embyHiResObserver = new MutationObserver(handleMutations);
  window.embyHiResObserver.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src"],
  });
})();