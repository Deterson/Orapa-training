/**
 * Code de partage d'un plateau : les poses des gemmes, encodées en une courte chaîne que l'on peut
 * copier, coller ou envoyer (pour rejouer un plateau ou le proposer en défi). Logique pure, sans DOM.
 *
 * Format : octets `[version, nombre de gemmes, 2 octets par gemme, somme de contrôle]` en base64
 * « URL-safe » sans remplissage. Une gemme tient sur 13 bits : identifiant (3 bits), rotation (2),
 * retournement (1), colonne (4) et ligne (3). Le code d'un plateau de base fait 18 caractères.
 */
import { GRID_COLS, GRID_ROWS } from './constants';
import { ALL_GEM_IDS, BASE_GEM_IDS, type GemId, type Placement } from './gems';
import { validatePlacements } from './placement';
import { isVisible } from './visibility';

/** Version du format : à incrémenter si l'encodage change (les anciens codes restent lisibles ou refusés). */
export const BOARD_CODE_VERSION = 1;

function toBase64Url(bytes: readonly number[]): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): number[] | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
  try {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    return Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function checksum(bytes: readonly number[]): number {
  return bytes.reduce((sum, byte, index) => (sum + byte * (index + 1)) % 251, 0);
}

/** Encode un plateau en code de partage. Les gemmes sont écrites dans l'ordre du jeu. */
export function encodeBoard(placements: readonly Placement[]): string {
  const ordered = [...placements].sort(
    (a, b) => ALL_GEM_IDS.indexOf(a.gem) - ALL_GEM_IDS.indexOf(b.gem),
  );
  const bytes: number[] = [BOARD_CODE_VERSION, ordered.length];
  for (const placement of ordered) {
    const packed =
      (ALL_GEM_IDS.indexOf(placement.gem) << 10) |
      (placement.orientation.rotation << 8) |
      ((placement.orientation.flipped ? 1 : 0) << 7) |
      (placement.col << 3) |
      placement.row;
    bytes.push(packed >> 8, packed & 0xff);
  }
  bytes.push(checksum(bytes));
  return toBase64Url(bytes);
}

/**
 * Décode un code de partage. Renvoie null si le code est illisible, d'une autre version, ou si le
 * plateau qu'il décrit n'est pas jouable : toutes les gemmes de base, règles a à d respectées et
 * règle e (chaque gemme atteignable en ligne droite depuis un bord).
 */
export function decodeBoard(code: string): Placement[] | null {
  const bytes = fromBase64Url(code.trim());
  if (bytes === null || bytes.length < 3) return null;
  const [version, count] = bytes;
  if (version !== BOARD_CODE_VERSION || count === undefined) return null;
  if (bytes.length !== 3 + count * 2) return null;
  if (checksum(bytes.slice(0, -1)) !== bytes.at(-1)) return null;

  const placements: Placement[] = [];
  for (let index = 0; index < count; index++) {
    const high = bytes[2 + index * 2] ?? 0;
    const low = bytes[3 + index * 2] ?? 0;
    const packed = (high << 8) | low;
    const gem: GemId | undefined = ALL_GEM_IDS[packed >> 10];
    const col = (packed >> 3) & 0x0f;
    const row = packed & 0x07;
    if (gem === undefined || col >= GRID_COLS || row >= GRID_ROWS) return null;
    placements.push({
      gem,
      orientation: {
        rotation: ((packed >> 8) & 0x03) as 0 | 1 | 2 | 3,
        flipped: ((packed >> 7) & 1) === 1,
      },
      col,
      row,
    });
  }
  if (!BASE_GEM_IDS.every((gem) => placements.some((placement) => placement.gem === gem))) {
    return null;
  }
  if (validatePlacements(placements).length > 0 || !isVisible(placements)) return null;
  return placements;
}
