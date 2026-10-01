export function isFamilySealViewport(width: number, height: number, touch: boolean) {
  if (width < 970) return false;
  if (!touch) return true;
  return height >= 600 && width > height;
}
