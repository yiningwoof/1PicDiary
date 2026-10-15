declare module "libheif-js" {
  type DisplayImage = {
    data: Uint8ClampedArray;
    width: number;
    height: number;
  };

  export type HeifImage = {
    free(): void;
    get_width(): number;
    get_height(): number;
    display(
      image: DisplayImage,
      callback: (image: DisplayImage | null) => void,
    ): void;
  };

  type HeifDecoderInstance = {
    decode(buffer: Buffer | Uint8Array): HeifImage[];
  };

  const libheif: { HeifDecoder: new () => HeifDecoderInstance };
  export default libheif;
}
