/** One pixel-based contour keeps the ticket's cuts circular at every width. */
export function ticketContour(width: number, height: number, seam: number) {
  const inset = 0.75;
  const corner = 18;
  const cut = 14;
  const right = width - inset;
  const bottom = height - inset;
  const y = Math.max(corner + cut + inset, Math.min(height - corner - cut - inset, seam));

  return {
    seam: y,
    path: `M ${corner + inset} ${inset}
      H ${right - corner} Q ${right} ${inset} ${right} ${corner + inset}
      V ${y - cut} A ${cut} ${cut} 0 0 0 ${right} ${y + cut}
      V ${bottom - corner} Q ${right} ${bottom} ${right - corner} ${bottom}
      H ${corner + inset} Q ${inset} ${bottom} ${inset} ${bottom - corner}
      V ${y + cut} A ${cut} ${cut} 0 0 0 ${inset} ${y - cut}
      V ${corner + inset} Q ${inset} ${inset} ${corner + inset} ${inset} Z`
      .replace(/\s+/g, " ")
      .trim(),
  };
}
