async page => {
  const origin = await page.evaluate(() => window.location.origin);
  await page.goto(`${origin}/?canvas-reference-compression-smoke=1`, { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async () => {
    const response = await fetch('/assets/Canvas-B8bY9_QL.js?v=20260721refcompress2');
    if (!response.ok) throw new Error(`Canvas asset returned ${response.status}`);
    const source = await response.text();
    const start = source.indexOf('const HJM_CANVAS_REFERENCE_MAX_SIDE=2048');
    const end = source.indexOf('const i6=', start);
    if (start < 0 || end <= start) throw new Error('Cannot locate outbound reference compression functions');
    const helpers = Function(`${source.slice(start, end)};return {Fg,hjmImageDataUrlBytes};`)();

    const imageSize = dataUrl => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = reject;
      image.src = dataUrl;
    });

    const largeCanvas = document.createElement('canvas');
    largeCanvas.width = 3840;
    largeCanvas.height = 3840;
    const largeContext = largeCanvas.getContext('2d');
    const gradient = largeContext.createLinearGradient(0, 0, 3840, 3840);
    gradient.addColorStop(0, '#f5fff7');
    gradient.addColorStop(0.5, '#4d8f6a');
    gradient.addColorStop(1, '#173f2d');
    largeContext.fillStyle = gradient;
    largeContext.fillRect(0, 0, 3840, 3840);
    for (let index = 0; index < 96; index += 1) {
      largeContext.fillStyle = `rgba(${(index * 37) % 255}, ${(index * 67) % 255}, ${(index * 97) % 255}, 0.35)`;
      largeContext.fillRect((index * 173) % 3600, (index * 271) % 3600, 240, 240);
    }
    const largeSource = largeCanvas.toDataURL('image/png');
    const largeOutput = await helpers.Fg(largeSource);
    const largeSize = await imageSize(largeOutput);

    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = 800;
    smallCanvas.height = 600;
    const smallContext = smallCanvas.getContext('2d');
    smallContext.fillStyle = '#64a37b';
    smallContext.fillRect(0, 0, 800, 600);
    const smallSource = smallCanvas.toDataURL('image/png');
    const smallOutput = await helpers.Fg(smallSource);
    const urlOutput = await helpers.Fg('/api/mock-image/reference-compression.svg');

    return {
      largeInput: { width: 3840, height: 3840, bytes: helpers.hjmImageDataUrlBytes(largeSource) },
      largeOutput: { ...largeSize, bytes: helpers.hjmImageDataUrlBytes(largeOutput), mime: largeOutput.slice(5, largeOutput.indexOf(';')) },
      smallUnchanged: smallOutput === smallSource,
      sameOriginUrlResolved: urlOutput.startsWith('data:image/webp;base64,')
    };
  });

  if (Math.max(result.largeOutput.width, result.largeOutput.height) !== 2048) {
    throw new Error(`Large reference was not resized to 2048: ${JSON.stringify(result)}`);
  }
  if (result.largeOutput.bytes > 4 * 1024 * 1024) {
    throw new Error(`Large reference still exceeds 4MB: ${JSON.stringify(result)}`);
  }
  if (result.largeOutput.mime !== 'image/webp') {
    throw new Error(`Large reference was not encoded as WebP: ${JSON.stringify(result)}`);
  }
  if (!result.smallUnchanged) {
    throw new Error(`Small supported reference should remain unchanged: ${JSON.stringify(result)}`);
  }
  if (!result.sameOriginUrlResolved) {
    throw new Error(`Same-origin reference URL was not converted to an outbound Data URL: ${JSON.stringify(result)}`);
  }

  return { completed: true, ...result };
}
