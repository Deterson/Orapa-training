/**
 * Barre de défilement légère, en surimpression, pour une zone qui défile (l'historique des tirs). La barre du
 * navigateur est cachée (elle prendrait de la place) ; une poignée discrète se dessine à droite de la zone,
 * visible seulement au survol (CSS), et se fait glisser à la souris. La molette et le toucher défilent
 * comme d'habitude.
 *
 * Structure attendue (voir `historyPanel` dans app.ts) :
 *   .scroll-area > .scroll-body (défile) + .scrollbar > .scrollbar-thumb
 */

/** Taille minimale de la poignée, en pixels : elle reste attrapable même pour une très longue liste. */
const MIN_THUMB = 28;

export interface ThumbGeometry {
  /** Faux quand tout tient dans la zone : pas de barre. */
  visible: boolean;
  /** Position et hauteur de la poignée, en pixels, dans la hauteur de la zone. */
  top: number;
  height: number;
}

/** Position de la poignée pour cette zone : proportionnelle au contenu visible et au défilement. */
export function thumbGeometry(
  clientHeight: number,
  scrollHeight: number,
  scrollTop: number,
  minThumb = MIN_THUMB,
): ThumbGeometry {
  if (clientHeight <= 0 || scrollHeight <= clientHeight + 1) {
    return { visible: false, top: 0, height: 0 };
  }
  const height = Math.min(
    clientHeight,
    Math.max(minThumb, (clientHeight / scrollHeight) * clientHeight),
  );
  const maxScroll = scrollHeight - clientHeight;
  const ratio = Math.min(Math.max(scrollTop / maxScroll, 0), 1);
  return { visible: true, top: ratio * (clientHeight - height), height };
}

/** Défilement à donner à la zone pour un déplacement de la poignée de `thumbDelta` pixels. */
export function scrollDeltaFor(
  thumbDelta: number,
  clientHeight: number,
  scrollHeight: number,
  thumbHeight: number,
): number {
  const room = clientHeight - thumbHeight;
  return room <= 0 ? 0 : (thumbDelta * (scrollHeight - clientHeight)) / room;
}

function parts(area: Element): { body: HTMLElement; bar: HTMLElement; thumb: HTMLElement } | null {
  const body = area.querySelector<HTMLElement>('.scroll-body');
  const bar = area.querySelector<HTMLElement>('.scrollbar');
  const thumb = area.querySelector<HTMLElement>('.scrollbar-thumb');
  return body && bar && thumb ? { body, bar, thumb } : null;
}

/** Remet la poignée d'une zone à jour (après un affichage, un défilement ou un changement de taille). */
export function updateScrollbar(area: Element): void {
  const found = parts(area);
  if (!found) return;
  const { body, bar, thumb } = found;
  const geometry = thumbGeometry(body.clientHeight, body.scrollHeight, body.scrollTop);
  bar.hidden = !geometry.visible;
  if (!geometry.visible) return;
  thumb.style.height = `${geometry.height}px`;
  thumb.style.transform = `translateY(${geometry.top}px)`;
}

export function refreshScrollbars(root: ParentNode): void {
  root.querySelectorAll('.scroll-area').forEach(updateScrollbar);
}

/** Branche, une fois, les écouteurs de toutes les zones présentes ou à venir dans `root`. */
export function installScrollbars(root: HTMLElement): void {
  // « scroll » ne remonte pas : on l'écoute en phase de capture.
  root.addEventListener(
    'scroll',
    (event) => {
      const area = (event.target as Element).closest?.('.scroll-area');
      if (area) updateScrollbar(area);
    },
    true,
  );
  window.addEventListener('resize', () => refreshScrollbars(root));

  root.addEventListener('pointerdown', (event) => {
    const thumb = (event.target as Element).closest<HTMLElement>('.scrollbar-thumb');
    const area = thumb?.closest('.scroll-area');
    const found = area ? parts(area) : null;
    if (!thumb || !area || !found || event.button > 0) return;
    event.preventDefault();
    const { body } = found;
    const startY = event.clientY;
    const startScroll = body.scrollTop;
    area.classList.add('is-dragging');
    const onMove = (e: PointerEvent): void => {
      body.scrollTop =
        startScroll +
        scrollDeltaFor(
          e.clientY - startY,
          body.clientHeight,
          body.scrollHeight,
          thumb.offsetHeight,
        );
    };
    const onEnd = (): void => {
      area.classList.remove('is-dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  });
}
