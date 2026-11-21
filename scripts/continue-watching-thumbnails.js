// ==UserScript==
// @name         Emby - episode thumbnails in Continue Watching Home screen.
// @namespace    emby-continue-watching-thumbs-mub
// @version      1.2.0
// @description  Shows the episode still instead of the show backdrop in Continue Watching
// @match        <replace with your full emby domain, eg https://emby.media>/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  "use strict";

  const sectionTitle = "Continue Watching";
  const episodeImageType = "Primary";
  const backdropPath = /\/Items\/([^/]+)\/Images\/Backdrop(\/\d+)?/i;

  function getContinueSections() {
    const sections = [...document.querySelectorAll(".verticalSection")];
    return sections.filter((section) => section.querySelector("h2, .sectionTitle")?.textContent?.includes(sectionTitle));
  }

  function getEpisodesBySeries(itemsContainer) {
    const episodes = (itemsContainer.getItems?.() ?? []).filter(
      (episode) => episode.Type === "Episode" && episode.SeriesId && episode.ImageTags?.[episodeImageType],
    );
    return new Map(episodes.map((episode) => [String(episode.SeriesId), episode]));
  }

  function swapCardImage(cardImage, episodesBySeries) {
    const imageUrl = new URL(cardImage.src);
    const seriesId = imageUrl.pathname.match(backdropPath)?.[1];
    if (!seriesId) return;

    const episode = episodesBySeries.get(seriesId);
    if (!episode) return;

    const { Id: episodeId, ImageTags: imageTags } = episode;
    imageUrl.pathname = imageUrl.pathname.replace(backdropPath, `/Items/${episodeId}/Images/${episodeImageType}`);
    imageUrl.searchParams.set("tag", imageTags[episodeImageType]);
    cardImage.src = imageUrl.toString();
  }

  function swapContinueWatchingImages() {
    for (const section of getContinueSections()) {
      const backdropImages = [...section.querySelectorAll('img.cardImage[src*="/Images/Backdrop"]')];
      if (!backdropImages.length) continue;

      const itemsContainer = section.querySelector(".itemsContainer");
      if (!itemsContainer) continue;

      const episodesBySeries = getEpisodesBySeries(itemsContainer);
      if (!episodesBySeries.size) continue;

      for (const cardImage of backdropImages) {
        swapCardImage(cardImage, episodesBySeries);
      }
    }
  }

  // only care about new nodes or a card img getting a backdrop src, skip the rest of emby's dom churn
  function hasRelevantChange(mutations) {
    return mutations.some((mutation) =>
      mutation.type === "childList" ? mutation.addedNodes.length : mutation.target.src?.includes("/Images/Backdrop"),
    );
  }

  let swapQueued = false;

  // batch into one swap per frame cuz emby re-renders cards a lot
  function queueSwap(mutations) {
    if (swapQueued || !hasRelevantChange(mutations)) return;
    swapQueued = true;
    requestAnimationFrame(() => {
      swapQueued = false;
      swapContinueWatchingImages();
    });
  }

  new MutationObserver(queueSwap).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"],
  });

  swapContinueWatchingImages();
})();