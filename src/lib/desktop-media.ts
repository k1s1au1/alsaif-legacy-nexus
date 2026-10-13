// Evaluate only layout features against the chosen desktop canvas. Other
// conditions, including reduced motion, contrast, color scheme and print, stay native.
const layoutFeature = /\((?:(?:min-|max-)?(?:device-)?(?:width|height)\s*[:<>=]|orientation\s*:)/i;
const truth = (matches: boolean) => matches ? "(min-width: 0px)" : "(max-width: 0px)";
const pixels = (number: string, unit: string) => Number(number) * (/rem|em/i.test(unit) ? 16 : 1);

export function desktopMediaQuery(query: string, width: number, height = 900) {
  if (!layoutFeature.test(query)) return query;
  return query.replace(/\(([^()]*)\)/g, (original, content: string) => {
    const bound = content.match(/^\s*(min-|max-)?(?:device-)?(width|height)\s*:\s*([\d.]+)(px|rem|em)\s*$/i);
    if (bound) {
      const value = bound[2].toLowerCase() === "width" ? width : height;
      const limit = pixels(bound[3], bound[4]);
      return truth(bound[1]?.toLowerCase() === "min-" ? value >= limit :
        bound[1]?.toLowerCase() === "max-" ? value <= limit : value === limit);
    }
    const range = content.match(/^\s*(width|height)\s*(>=|<=|>|<|=)\s*([\d.]+)(px|rem|em)\s*$/i);
    if (range) {
      const value = range[1].toLowerCase() === "width" ? width : height;
      const limit = pixels(range[3], range[4]);
      return truth(range[2] === ">=" ? value >= limit : range[2] === "<=" ? value <= limit :
        range[2] === ">" ? value > limit : range[2] === "<" ? value < limit : value === limit);
    }
    const orientation = content.match(/^\s*orientation\s*:\s*(portrait|landscape)\s*$/i);
    if (orientation) return truth(orientation[1].toLowerCase() === "landscape");
    const input = content.match(/^\s*(?:any-)?(pointer|hover)\s*:\s*(fine|coarse|none|hover)\s*$/i);
    if (input) return truth(input[2].toLowerCase() === (input[1].toLowerCase() === "pointer" ? "fine" : "hover"));
    return original;
  });
}

/** Keep viewport lengths in the desktop canvas; quoted strings and URLs are untouched. */
export function desktopViewportValues(css: string) {
  return css.replace(
    /url\([^)]*\)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(-?(?:\d*\.)?\d+)(?:[dsl])?v(w|h|min|max)\b/gi,
    (original, number?: string, axis?: string) => {
      if (number === undefined || axis === undefined) return original;
      const dimension = axis.toLowerCase();
      return `calc(${number} * var(--display-v${dimension}))`;
    },
  );
}
