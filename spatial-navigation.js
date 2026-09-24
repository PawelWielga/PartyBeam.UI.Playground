(() => {
  "use strict";

  function getCenter(element) {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function findDirectionalTarget(origin, direction, elements) {
    const focusables = Array.from(elements || []).filter(Boolean);
    if (!origin || !focusables.includes(origin)) {
      return null;
    }

    const current = getCenter(origin);
    const candidates = focusables
      .filter((element) => element !== origin)
      .map((element) => {
        const center = getCenter(element);
        const dx = center.x - current.x;
        const dy = center.y - current.y;
        let primary = Number.POSITIVE_INFINITY;
        let secondary = Number.POSITIVE_INFINITY;
        let valid = false;

        if (direction === "up") {
          valid = dy < -1;
          primary = -dy;
          secondary = Math.abs(dx);
        } else if (direction === "down") {
          valid = dy > 1;
          primary = dy;
          secondary = Math.abs(dx);
        } else if (direction === "left") {
          valid = dx < -1;
          primary = -dx;
          secondary = Math.abs(dy);
        } else if (direction === "right") {
          valid = dx > 1;
          primary = dx;
          secondary = Math.abs(dy);
        }

        return { element, valid, score: primary + secondary * 2.25 };
      })
      .filter((candidate) => candidate.valid)
      .sort((a, b) => a.score - b.score);

    return candidates[0]?.element || null;
  }

  window.PartyBeamSpatialNavigation = Object.freeze({
    findDirectionalTarget
  });
})();
