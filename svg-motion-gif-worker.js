import { GIFEncoder, quantize, applyPalette } from './vendor/gifenc.mjs';

const role = new URL(self.location.href).searchParams.get('role') || 'legacy';
let gif, width, height, repeat;
self.onmessage = event => {
  const message = event.data;
  try {
    if (role === 'quantize' && message.type === 'frame') {
      const rgba = new Uint8Array(message.buffer), format = message.transparent ? 'rgba4444' : 'rgb565';
      const palette = quantize(rgba, 256, { format, oneBitAlpha: true });
      const transparentIndex = message.transparent ? palette.findIndex(color => color[3] === 0) : -1;
      const indexed = applyPalette(rgba, palette, format);
      self.postMessage({
        type: 'quantized', index: message.index, indexed: indexed.buffer, palette,
        transparent: transparentIndex >= 0, transparentIndex: Math.max(0, transparentIndex), delay: message.delay,
      }, [indexed.buffer]);
    } else if (message.type === 'start') {
      ({ width, height, repeat } = message);
      gif = GIFEncoder();
      self.postMessage({ type: 'ready' });
    } else if (role === 'encode' && message.type === 'indexed-batch') {
      for (const item of message.items) {
        gif.writeFrame(new Uint8Array(item.indexed), width, height, {
          palette: item.palette, delay: item.delay, repeat, dispose: 2,
          transparent: item.transparent, transparentIndex: item.transparentIndex,
        });
      }
      self.postMessage({ type: 'batch', index: message.items.at(-1)?.index ?? -1 });
    } else if (message.type === 'frame') {
      // Compatibility path for callers that use one worker for both stages.
      const rgba = new Uint8Array(message.buffer), format = message.transparent ? 'rgba4444' : 'rgb565';
      const palette = quantize(rgba, 256, { format, oneBitAlpha: true });
      const transparentIndex = message.transparent ? palette.findIndex(color => color[3] === 0) : -1;
      const indexed = applyPalette(rgba, palette, format);
      gif.writeFrame(indexed, width, height, { palette, delay: message.delay, repeat, dispose: 2,
        transparent: transparentIndex >= 0, transparentIndex: Math.max(0, transparentIndex) });
      self.postMessage({ type: 'frame', index: message.index });
    } else if (message.type === 'finish') {
      gif.finish();
      const bytes = gif.bytes();
      self.postMessage({ type: 'done', buffer: bytes.buffer }, [bytes.buffer]);
      gif = null;
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message });
  }
};
