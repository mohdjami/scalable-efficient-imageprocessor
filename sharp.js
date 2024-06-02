import sharp from "sharp";
class BlurryDetector {
  constructor(threshold = 300) {
    this.threshold = threshold;
  }

  async computeLaplacianVariance(imagePath) {
    // Our friendly Laplacian kernel
    const laplacianKernel = {
      width: 3,
      height: 3,
      kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
    };

    // Convolve the image with the Laplacian kernel
    const laplacianImageData = await sharp(imagePath)
      .greyscale()
      .raw()
      .convolve(laplacianKernel)
      .toBuffer();

    // Calculate the variance of our convolved image
    const mean =
      laplacianImageData.reduce((sum, value) => sum + value, 0) /
      laplacianImageData.length;
    const variance =
      laplacianImageData.reduce(
        (sum, value) => sum + Math.pow(value - mean, 2),
        0
      ) / laplacianImageData.length;
    return variance;
  }

  async isImageBlurry(imagePath) {
    const variance = await this.computeLaplacianVariance(imagePath);
    return variance < this.threshold;
  }
}

export default BlurryDetector;
