import { syllable } from "syllable";

export async function checkReadability(text) {
  const words = text.split(/\s+/);
  const syllableCount = words.reduce(
    (count, word) => count + syllable(word),
    0
  );
  const wordCount = words.length;
  const sentenceCount = text.split(/[.!?]/).length - 1;

  const smogIndex =
    1.043 * Math.sqrt(syllableCount * (30 / sentenceCount)) + 3.1291;
  const fleschScore =
    206.835 -
    1.015 * (wordCount / sentenceCount) -
    84.6 * (syllableCount / wordCount);

  if (fleschScore >= 90) {
    return fleschScore;
  } else if (fleschScore >= 80) {
    return fleschScore;
  } else if (fleschScore >= 70) {
    return fleschScore;
  } else if (fleschScore >= 60) {
    return fleschScore;
  } else if (fleschScore >= 50) {
    return fleschScore;
  } else if (fleschScore >= 30) {
    return fleschScore;
  } else {
    return 0;
  }
}
