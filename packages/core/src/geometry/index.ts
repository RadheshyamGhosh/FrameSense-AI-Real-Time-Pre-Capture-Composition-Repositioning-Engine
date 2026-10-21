/**
 * A normalized 2D point.
 *
 * Coordinate convention:
 * - origin is top-left
 * - x increases toward the right
 * - y increases toward the bottom
 * - valid normalized range is 0..1
 * - (0, 0) is top-left
 * - (0.5, 0.5) is center
 * - (1, 1) is bottom-right
 */
export interface Point2D {
  readonly x: number;
  readonly y: number;
}

/**
 * A normalized rectangular bounds region.
 *
 * x and y describe the top-left corner. width and height describe the region size.
 * All values use the same normalized 0..1 coordinate space as Point2D.
 */
export interface BoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
