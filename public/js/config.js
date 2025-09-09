// Update these values for your deployment
export const IDRIVE_ENDPOINT = 'https://j1i2.or.idrivee2-36.co';
export const BUCKET_NAME = 'videos';
export const TYPESENSE_HOST = 't1.tubie.cx';

export function getVideoUrl(filename) {
  return `${IDRIVE_ENDPOINT}/${BUCKET_NAME}/${filename}`;
}
