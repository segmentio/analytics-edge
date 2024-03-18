export interface ReplacementStreamProps {
  prependContent?: string;
  appendContent?: string;
  replacer?: (content: string) => string;
}

export function getReplacementStream({
  prependContent,
  appendContent,
  replacer
}: ReplacementStreamProps) {
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  let originalLengthInBytes = 0;
  let originalBytes: Uint8Array[] | null = [];
  
  return new TransformStream({
    start(controller) {
      if (prependContent) {
        controller.enqueue(textEncoder.encode(prependContent));
      }
    },
    transform(chunk: Uint8Array, controller) {
      if (!replacer) {
        return controller.enqueue(chunk);
      }
      originalBytes!.push(chunk);
      originalLengthInBytes += chunk.byteLength;
    },
    flush(controller) {
      if (replacer) {
        const body = originalBytes!.map((chunk, idx) => textDecoder.decode(chunk, { stream: idx < originalBytes!.length - 2 })).join('');
        const modifiedBody = replacer(body);
        controller.enqueue(textEncoder.encode(modifiedBody));
      }

      if (appendContent) {
        controller.enqueue(textEncoder.encode(appendContent));
      }
      originalBytes = null
    }
  })
}