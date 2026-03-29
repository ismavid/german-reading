import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export async function loadPdfDocument(data: ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
  const loadingTask = pdfjsLib.getDocument({ data });
  return loadingTask.promise;
}

export interface ExtractedWord {
  word: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Offscreen canvas for measuring text widths accurately
const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d')!;

function measureTextWidth(text: string, font: string): number {
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

export async function extractWordsFromPage(
  page: pdfjsLib.PDFPageProxy,
  scale: number
): Promise<ExtractedWord[]> {
  const textContent = await page.getTextContent();
  const viewport = page.getViewport({ scale });
  const words: ExtractedWord[] = [];

  // Build a font name map from the page's common objs
  const styles = textContent.styles as Record<string, { fontFamily: string; ascent?: number; descent?: number }>;

  for (const item of textContent.items) {
    if (!('str' in item) || !item.str.trim()) continue;

    // Apply viewport transform to the text item transform
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);

    // tx = [scaleX, skewY, skewX, scaleY, translateX, translateY]
    const fontHeight = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
    const fontFamily = styles[item.fontName]?.fontFamily || 'sans-serif';
    const cssFontSize = fontHeight;
    const cssFont = `${cssFontSize}px ${fontFamily}`;

    // item baseline position
    const baselineX = tx[4];
    const baselineY = tx[5];

    // Top of the text box: baseline minus ascent (approximate as 0.8 * fontHeight)
    const ascent = fontHeight * 0.85;
    const topY = baselineY - ascent;
    const lineHeight = fontHeight * 1.15;

    const fullStr = item.str;

    // Split into tokens preserving whitespace so we can track horizontal offset
    const tokens = fullStr.split(/(\s+)/);
    let charOffset = 0;

    for (const token of tokens) {
      if (!token.trim()) {
        charOffset += token.length;
        continue;
      }

      // Clean punctuation from edges for the lookup word, but use full token for positioning
      const cleanWord = token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      if (!cleanWord) {
        charOffset += token.length;
        continue;
      }

      // Measure the text before this token to get its x offset
      const prefix = fullStr.substring(0, charOffset);
      const prefixWidth = measureTextWidth(prefix, cssFont);
      const tokenWidth = measureTextWidth(token, cssFont);

      // Scale factor: PDF.js item.width (scaled) vs measured full string width
      const measuredFullWidth = measureTextWidth(fullStr, cssFont);
      const actualItemWidth = item.width * scale;
      const widthRatio = measuredFullWidth > 0 ? actualItemWidth / measuredFullWidth : 1;

      const wordX = baselineX + prefixWidth * widthRatio;
      const wordWidth = tokenWidth * widthRatio;

      words.push({
        word: cleanWord,
        x: wordX,
        y: topY,
        width: Math.max(wordWidth, 6),
        height: lineHeight,
      });

      charOffset += token.length;
    }
  }

  return words;
}
